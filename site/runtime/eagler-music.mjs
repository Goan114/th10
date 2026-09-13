import {OggVorbisDecoder} from '../vendor/ogg-vorbis-decoder.mjs';

const PCM_BYTES_PER_FRAME=4;
const STREAM_INPUT_BYTES=128*1024;
const NATIVE_READ_WINDOW=1048576;
const MUSIC_PATH=/^\/?bgm-ogg\/(th10_\d{2})\.ogg$/;

function asBytes(value){
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  throw new TypeError('Music resource must be byte data');
}

function normalizePath(path){
  if(typeof path!=='string')throw new TypeError('Music resource path must be a string');
  const match=MUSIC_PATH.exec(path.replaceAll('\\','/'));
  if(!match)throw new Error('Invalid TH10 OGG resource path: '+path);
  return 'bgm-ogg/'+match[1]+'.ogg';
}

function sampleToInt16(value){
  const sample=Math.max(-1,Math.min(1,Number(value)||0));
  return sample<0?Math.max(-32768,Math.round(sample*32768)):Math.min(32767,Math.round(sample*32767));
}

function copyPcmRange(destination,destinationFrame,channels,sourceStart,sourceEnd){
  const left=channels[0],right=channels[1];
  if(!left||!right)throw new Error('OGG decoder did not return stereo PCM');
  const from=Math.max(0,sourceStart),to=Math.min(left.length,sourceEnd);
  const view=new DataView(destination.buffer,destination.byteOffset,destination.byteLength);
  for(let frame=from;frame<to;frame++){
    const output=(destinationFrame+frame-sourceStart)*PCM_BYTES_PER_FRAME;
    view.setInt16(output,sampleToInt16(left[frame]),true);
    view.setInt16(output+2,sampleToInt16(right[frame]),true);
  }
}

export class EaglerMusic {
  constructor(info,{resources=[],mode='ogg',decodeMode='stream',capacity=64}={}){
    if(!info||!Number.isSafeInteger(info.size)||info.size<0)throw new TypeError('Invalid music manifest');
    this.length=info.size;
    this.blockSize=Number.isSafeInteger(info.blockSize)&&info.blockSize>0?info.blockSize:262144;
    this.mode=mode;
    this.decodeMode=decodeMode;
    if(!['ogg','none','midi'].includes(mode))throw new Error('Invalid music mode: '+mode);
    if(!['stream','full'].includes(decodeMode))throw new Error('Invalid OGG decode mode: '+decodeMode);
    this.capacity=Math.max(1,capacity|0);
    this.resources=new Map();
    this.blocks=new Map();
    this.inflight=new Map();
    this.pinned=new Set();
    this.required=new Set();
    this.pending=null;
    this.tracks=[];
    this.active=new Set();
    for(const entry of resources??[]){
      if(Array.isArray(entry))this.install(entry[0],entry[1]);
      else if(entry&&typeof entry==='object')this.install(entry.path,entry.bytes);
      else throw new TypeError('Invalid managed music resource');
    }
  }

  install(path,value){
    const normalized=normalizePath(path),bytes=asBytes(value);
    this.resources.set(normalized,bytes);
    const track=this.tracks.find(track=>track.path===normalized);
    if(track){
      track.generation++;
      this._releaseTrack(track);
    }
    return bytes;
  }

  async prepare(records){
    if(!Array.isArray(records)||records.length===0)throw new Error('TH10 music layout is empty');
    this.tracks=records.map((record,index)=>this._makeTrack(record,index));
    const sorted=[...this.tracks].sort((a,b)=>a.offset-b.offset);
    if(sorted.some((track,i)=>i&&sorted[i-1].offset+sorted[i-1].length>track.offset))throw new Error('Overlapping TH10 music tracks');
    // create_file_stream immediately fills the first format (the title).
    // Later selections seek in one native frame and fill in the next. They
    // are prepared from the live file handle, never from package arrival.
    for(const track of [this.tracks[0]]){
      this.active.add(track);this._pinTrack(track);
      await this._prepareTrackRange(track,0,NATIVE_READ_WINDOW);
    }
  }

  _makeTrack(record,index){
    const offset=Number(record?.offset),loop=Number(record?.loop),length=Number(record?.length);
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(loop)||!Number.isSafeInteger(length)||offset<0||loop<0||length<=0||loop>=length||offset+length>this.length||length%PCM_BYTES_PER_FRAME)throw new Error('Invalid TH10 music track '+index);
    const path=normalizePath(record.name.replace(/\.wav$/i,'.ogg'));
    return {index,offset,loop,length,path,blocks:new Set(),generation:0,fullPcm:null,fullPromise:null,stream:null,queue:Promise.resolve()};
  }

  _pinTrack(track){
    for(const start of [0,track.loop])for(const index of this._indices(track,start,start+NATIVE_READ_WINDOW))this.pinned.add(index);
  }

  *_indices(track,start,end){
    end=Math.min(end,track.length);start=Math.max(0,start);
    if(start>=end)return;
    for(let block=Math.floor(start/this.blockSize);block<Math.ceil(end/this.blockSize);block++)yield track.index+':'+block;
  }

  _releaseTrack(track,keepEntry=false){
    for(const block of track.blocks){
      if(keepEntry&&Number(block.split(':')[1])*this.blockSize<NATIVE_READ_WINDOW){
        if(track.fullPcm)this.blocks.set(block,this.blocks.get(block).slice());
      }else{this.blocks.delete(block);track.blocks.delete(block);}
    }
    track.fullPcm=null;track.fullPromise=null;
    // A queued decode still owns its decoder; release it after that request.
    const stream=track.stream;track.stream=null;
    if(stream)track.queue.then(()=>stream.decoder.free());
  }

  _touch(index){
    const block=this.blocks.get(index);if(block){this.blocks.delete(index);this.blocks.set(index,block);}
  }

  _trim(){
    const limit=Math.max(this.capacity+this.pinned.size,this.required.size+this.pinned.size);
    if(this.blocks.size<=limit)return;
    for(const index of this.blocks.keys()){
      if(!this.pinned.has(index)&&!this.required.has(index)){this.blocks.delete(index);this.tracks[Number(index.split(':')[0])].blocks.delete(index);}
      if(this.blocks.size<=limit)break;
    }
  }

  async _loadTrackBlock(track,index){
    if(this.blocks.has(index))return this.blocks.get(index);
    if(this.inflight.has(index))return this.inflight.get(index);
    const promise=(async()=>{
      for(;;){
        const generation=track.generation,start=Number(index.split(':')[1])*this.blockSize,end=Math.min(track.length,start+this.blockSize);
        const bytes=await this._readTrackRange(track,start,end);
        if(generation!==track.generation)continue;
        const block=bytes??new Uint8Array(end-start);
        this.blocks.set(index,block);track.blocks.add(index);
        this._trim();return block;
      }
    })().finally(()=>this.inflight.delete(index));
    this.inflight.set(index,promise);return promise;
  }

  async _readTrackRange(track,start,end){
    const source=this.resources.get(track.path??'');
    if(this.mode!=='ogg'||!source)return null;
    if(track.fullPcm)return track.fullPcm.subarray(start,end);
    if(this.decodeMode==='full')return (await this._ensureFull(track,source)).subarray(start,end);
    const pending=track.queue.then(()=>this._decodeStreamRange(track,source,start,end));
    track.queue=pending.catch(()=>{});return pending;
  }

  async _ensureFull(track,source){
    if(track.fullPcm)return track.fullPcm;
    if(!track.fullPromise){const generation=track.generation;track.fullPromise=this._decodeFull(track,source).then(pcm=>{if(generation===track.generation)track.fullPcm=pcm;return pcm;});}
    return track.fullPromise;
  }

  async prepareActive(store){
    const active=new Set();
    // Recreating the native file stream synchronously fills format 0, even
    // when the previous stream was closed in an earlier frame.
    const first=this.tracks[0],ranges=[[first,0,NATIVE_READ_WINDOW]];
    for(const file of store.handles.values())if(file.name==='thbgm.dat'){
      // A read can end exactly at the next track's offset. The last native
      // seek identifies the selected track even while its cursor is at EOF.
      const selected=file.seekPosition??file.cursor;
      for(const track of this.tracks)if(selected>=track.offset&&selected<track.offset+track.length){
        active.add(track);const start=file.cursor-track.offset;
        ranges.push([track,0,NATIVE_READ_WINDOW],[track,start,start+NATIVE_READ_WINDOW]);
        if(start+NATIVE_READ_WINDOW>=track.length)ranges.push([track,track.loop,track.loop+NATIVE_READ_WINDOW]);
      }
    }
    if(!active.size)active.add(first);
    for(const track of this.active)if(!active.has(track))this._releaseTrack(track,track===first);
    this.active=active;this.pinned=new Set(this._indices(first,0,NATIVE_READ_WINDOW));for(const track of active)this._pinTrack(track);
    this.required=new Set(ranges.flatMap(([track,start,end])=>[...this._indices(track,start,end)]));
    for(const [track,start,end] of ranges)await this._prepareTrackRange(track,start,end);
    this._trim();
  }

  async _prepareTrackRange(track,start,end){
    if(this.mode!=='ogg'||!this.resources.has(track.path))return;
    for(const index of this._indices(track,start,end))await this._loadTrackBlock(track,index);
  }

  async prepareRange(start,end){
    const ranges=this.tracks.filter(track=>track.offset<end&&track.offset+track.length>start);
    this.required=new Set(ranges.flatMap(track=>[...this._indices(track,start-track.offset,end-track.offset)]));
    for(const track of ranges)await this._prepareTrackRange(track,start-track.offset,end-track.offset);
  }

  async _decodeFull(track,source){
    const decoder=new OggVorbisDecoder();await decoder.ready;
    try{
      const decoded=await decoder.decodeFile(source),frames=decoded.samplesDecoded;
      this._validateDecoded(track,decoded,frames);
      if(frames*PCM_BYTES_PER_FRAME!==track.length)throw new Error(`OGG length mismatch for track ${track.index}: ${frames*PCM_BYTES_PER_FRAME} != ${track.length}`);
      const pcm=new Uint8Array(track.length);copyPcmRange(pcm,0,decoded.channelData,0,frames);return pcm;
    }finally{decoder.free();}
  }

  async _decodeStreamRange(track,source,start,end){
    let state=track.stream;
    if(!state||state.source!==source||start<state.begin){
      state?.decoder.free();const decoder=new OggVorbisDecoder();await decoder.ready;
      state=track.stream={decoder,source,input:0,begin:0,end:0,chunks:[],finished:false};
    }
    const consume=decoded=>{
      if(decoded.errors?.length)throw new Error('Vorbis decode failed: '+JSON.stringify(decoded.errors));
      if(!decoded.samplesDecoded)return;
      this._validateDecoded(track,decoded,decoded.samplesDecoded);
      const pcm=new Uint8Array(decoded.samplesDecoded*4);copyPcmRange(pcm,0,decoded.channelData,0,decoded.samplesDecoded);
      state.chunks.push({start:state.end,pcm});state.end+=pcm.length;
    };
    while(state.end<end&&!state.finished){
      if(state.input<source.length){const next=Math.min(source.length,state.input+STREAM_INPUT_BYTES);consume(await state.decoder.decode(source.subarray(state.input,next)));state.input=next;}
      else{consume(await state.decoder.flush());state.finished=true;if(state.end!==track.length)throw new Error('OGG PCM length mismatch: '+track.path);}
      while(state.chunks.length&&state.chunks[0].start+state.chunks[0].pcm.length<=start){const chunk=state.chunks.shift();state.begin=chunk.start+chunk.pcm.length;}
    }
    if(state.end<end)throw new Error('OGG ended before PCM range: '+track.path);
    const result=new Uint8Array(end-start);
    for(const chunk of state.chunks){const from=Math.max(start,chunk.start),to=Math.min(end,chunk.start+chunk.pcm.length);if(to>from)result.set(chunk.pcm.subarray(from-chunk.start,to-chunk.start),from-start);}
    return result;
  }

  _validateDecoded(track,decoded,frames){
    if(decoded.errors?.length)throw new Error('Vorbis decode failed: '+JSON.stringify(decoded.errors));
    if(decoded.sampleRate!==44100||decoded.channelData?.length!==2||decoded.bitDepth!==16)throw new Error(`Unsupported OGG format for track ${track.index}`);
    if(!Number.isSafeInteger(frames)||frames<0)throw new Error('Invalid OGG decoder frame count');
  }

  subarray(start,end){
    start=Math.max(0,Math.min(this.length,Number(start)||0));end=Math.max(start,Math.min(this.length,Number(end)||0));
    if(start===end)return new Uint8Array(0);
    const result=new Uint8Array(end-start);
    if(this.mode!=='ogg')return result;
    for(const track of this.tracks){
      if(track.offset>=end||track.offset+track.length<=start||!this.resources.has(track.path))continue;
      for(const index of this._indices(track,start-track.offset,end-track.offset)){
        const block=this.blocks.get(index);
        // Wasm file reads cannot suspend. Its current track and read window
        // must be prepared before entering a native frame.
        if(!block){this.pending=this.prepareRange(start,end);return null;}
        const offset=track.offset+Number(index.split(':')[1])*this.blockSize;
        const from=Math.max(start,offset),to=Math.min(end,offset+block.length);
        result.set(block.subarray(from-offset,to-offset),from-start);this._touch(index);
      }
    }
    this.pending=null;return result;
  }
}
