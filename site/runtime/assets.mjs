export async function fetchBytes(url){const response=await fetch(url);if(!response.ok)throw new Error(`Failed to read ${url} (${response.status}).`);return new Uint8Array(await response.arrayBuffer());}
export async function fetchGzip(url){const bytes=await fetchBytes(url);if(bytes[0]!==0x1f||bytes[1]!==0x8b)return bytes;return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}

// Cache original PCM bytes before the emulated synchronous ReadFile needs them.
// Track starts/loop points remain resident; the moving window is a bounded LRU.
export class PagedMusic {
  constructor(info,{fetcher=(...args)=>fetch(...args),source=null,silent=false,capacity=64,ahead=12}={}){
    this.length=info.size;this.chunked=!!info.chunked;this.blockSize=info.blockSize??262144;
    if(source&&source.size!==this.length)throw new Error(`Wrong thbgm.dat size. Expected ${this.length} bytes.`);
    this.fetcher=fetcher;this.source=source;this.silent=!!silent;this.silentBlock=this.silent?new Uint8Array(this.blockSize):null;this.capacity=Math.max(1,capacity);this.ahead=Math.min(ahead,Math.max(0,this.capacity-2));
    this.blocks=new Map();this.inflight=new Map();this.pinned=new Set();this.required=new Set();this.pending=null;this.prefetched=-1;
  }
  trim(){
    const limit=Math.max(this.capacity+this.pinned.size,this.required.size+this.pinned.size);
    if(this.blocks.size<=limit)return;
    for(const index of this.blocks.keys()){
      if(!this.pinned.has(index)&&!this.required.has(index))this.blocks.delete(index);
      if(this.blocks.size<=limit)break;
    }
  }
  load(index){
    if(this.blocks.has(index))return Promise.resolve(this.blocks.get(index));
    if(this.inflight.has(index))return this.inflight.get(index);
    const pending=Promise.resolve().then(async()=>{
      try{
        const start=index*this.blockSize,end=Math.min(start+this.blockSize,this.length)-1;
        const url=this.chunked?new URL(`../data/thbgm/${String(index).padStart(4,'0')}.bin`,import.meta.url):new URL('../data/thbgm.dat',import.meta.url);let data;
        if(this.silent)data=this.silentBlock.subarray(0,end-start+1);
        else if(this.source)data=new Uint8Array(await this.source.slice(start,end+1).arrayBuffer());
        else{const response=await this.fetcher(url,this.chunked?{}:{headers:{Range:`bytes=${start}-${end}`}});if(!response.ok||(!this.chunked&&response.status!==206))throw new Error('Failed to read music data: '+url);data=new Uint8Array(await response.arrayBuffer());}
        if(data.length!==end-start+1)throw new Error('Incomplete music data: '+url);
        this.blocks.set(index,data);this.trim();return data;
      }finally{this.inflight.delete(index);}
    });
    this.inflight.set(index,pending);return pending;
  }
  async prepare(tracks){
    // Each original stream fills up to 1 MiB when seeking. Pin that window at
    // both entry points so changing tracks and looping do not suspend a frame.
    for(const track of tracks)for(const start of [track.offset,track.offset+track.loop]){
      const end=Math.min(start+1048576,track.offset+track.length,this.length);
      for(let i=Math.floor(start/this.blockSize);i<=Math.floor((end-1)/this.blockSize);i++)this.pinned.add(i);
    }
    const indices=[...this.pinned];let next=0;
    await Promise.all(Array.from({length:4},async()=>{while(next<indices.length)await this.load(indices[next++]);}));
  }
  prefetch(last){
    if(this.prefetched===last)return;this.prefetched=last;
    for(let i=last+1;i<=last+this.ahead&&i*this.blockSize<this.length;i++){
      // A speculative error is retried and surfaced if ReadFile actually needs
      // the block. A missing future block must not interrupt current playback.
      this.load(i).catch(()=>{});
    }
  }
  subarray(start,end){
    start=Math.max(0,Math.min(start,this.length));end=Math.max(start,Math.min(end,this.length));
    if(start===end)return new Uint8Array(0);
    const first=Math.floor(start/this.blockSize),last=Math.floor((end-1)/this.blockSize),missing=[];
    this.required=new Set();for(let i=first;i<=last;i++){this.required.add(i);if(!this.blocks.has(i))missing.push(i);}
    if(missing.length){this.pending=Promise.all(missing.map(i=>this.load(i)));return null;}
    const result=new Uint8Array(end-start);
    for(let i=first;i<=last;i++){
      const block=this.blocks.get(i),from=Math.max(start,i*this.blockSize),to=Math.min(end,(i+1)*this.blockSize);
      result.set(block.subarray(from-i*this.blockSize,to-i*this.blockSize),from-start);this.blocks.delete(i);this.blocks.set(i,block);
    }
    this.required.clear();this.trim();this.pending=null;this.prefetch(last);return result;
  }
}
