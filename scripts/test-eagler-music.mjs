import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {EaglerMusic} from '../site/runtime/eagler-music.mjs';
import {prepareNativeMusic} from '../site/runtime/native-music-window.mjs';
import {NativeFileStore} from '../site/runtime/native-file-store.mjs';
import {createNativeGame} from '../site/runtime/native-game.mjs';
import {GDIFonts} from '../site/runtime/gdi-fonts.mjs';

const provenance=JSON.parse(await readFile(new URL('../assets-ogg/provenance.json',import.meta.url)));
const layout=provenance.source.layout.records;
test('retail OGG streaming matches full PCM, including backward seek and late install',async()=>{
  const record=layout.find(t=>(t.oggPath??'').includes('th10_02'));
  assert(record,'prepared retail title track');
  const name='bgm-ogg/th10_02.ogg',bytes=await readFile(new URL('../assets-ogg/'+name,import.meta.url));
  const track={name,offset:16,loop:record.loop,length:record.length};
  const info={size:track.offset+track.length,blockSize:262144};
  const make=decodeMode=>new EaglerMusic(info,{decodeMode,resources:[[name,bytes]],capacity:4});
  const full=make('full'),stream=make('stream');await full.prepare([track]);await stream.prepare([track]);assert.equal(full.tracks[0].fullPcm.length,track.length);
  for(const start of [16,track.loop+16,6*1048576,2*1048576,16]){
    const end=start+262144;
    await full.prepareRange(start,end);await stream.prepareRange(start,end);
    assert.deepEqual(stream.subarray(start,end),full.subarray(start,end));
  }
  const late=new EaglerMusic(info);await late.prepare([track]);assert(late.subarray(16,262144).every(v=>v===0));
  late.install(name,bytes);await prepareNativeMusic(late,{handles:new Map([[1,{name:'thbgm.dat',cursor:16}]])});
  assert.deepEqual(late.subarray(16,262144),full.subarray(16,262144));assert(late.subarray(16,262144).some(v=>v!==0));
});
test('package arrival never decodes inactive tracks or adjacent PCM tails',async()=>{
  const records=layout.map(t=>({name:t.oggPath,offset:t.offset,loop:t.loop,length:t.length}));
  const resources=await Promise.all(records.map(async t=>[t.name,await readFile(new URL('../assets-ogg/'+t.name,import.meta.url))]));
  const info={size:Math.max(...records.map(t=>t.offset+t.length)),blockSize:262144};
  for(const decodeMode of ['stream','full']){
    const music=new EaglerMusic(info,{decodeMode,resources});const decoded=[];
    const original=music._readTrackRange.bind(music);
    music._readTrackRange=(track,...range)=>{decoded.push(track.path);return original(track,...range);};
    await music.prepare(records);
    assert.deepEqual([...new Set(decoded)],[records[0].name]);
    await prepareNativeMusic(music,{handles:new Map()});
    assert(music.subarray(records[0].offset,records[0].offset+705600),'native stream creation can synchronously fill format 0');
    const file={name:'thbgm.dat',cursor:records[0].offset+705600},store={handles:new Map([[1,file]])};
    await prepareNativeMusic(music,store);decoded.length=0;
    for(const [name,bytes] of resources.slice(1)){music.install(name,bytes);await prepareNativeMusic(music,store);}
    assert.deepEqual(decoded,[],'background installs do not decode any track');
    file.cursor=records[1].offset;await prepareNativeMusic(music,store);
    assert.deepEqual([...new Set(decoded)],[records[1].name],'selecting stage 1 does not scan title tail');
    assert(music.subarray(file.cursor,file.cursor+705600).some(v=>v!==0));
    assert.equal(music.tracks[0].fullPcm,null);assert.equal(music.tracks[0].stream,null);
  }
});
test('native sequential reads retain the selected track at EOF and loop without losing PCM',async()=>{
  const record=layout[0],name=record.oggPath,bytes=await readFile(new URL('../assets-ogg/'+name,import.meta.url));
  const records=[{name,offset:16,loop:record.loop,length:record.length},{name:'bgm-ogg/th10_00.ogg',offset:16+record.length,loop:0,length:1048576}];
  const music=new EaglerMusic({size:records[1].offset+records[1].length,blockSize:262144},{capacity:2,resources:[[name,bytes]]});
  await music.prepare(records);
  const memory=new WebAssembly.Memory({initial:16}),store=new NativeFileStore(new Map([['thbgm.dat',music]])).bind(memory),handle=store.open('thbgm.dat',false);
  store.seek(handle,16,0);
  let remaining=record.length;
  while(remaining){await prepareNativeMusic(music,store);const size=Math.min(705600,remaining);assert.equal(store.read(handle,0,size),size);remaining-=size;}
  assert.equal(store.handles.get(handle).cursor,records[1].offset);
  await prepareNativeMusic(music,store);
  assert.deepEqual([...music.active].map(t=>t.path),[name],'EOF belongs to the native-selected track');
  store.seek(handle,16+record.loop,0);
  assert.equal(store.read(handle,0,705600),705600,'loop window is already pinned before the native seek');
  const full=new EaglerMusic({size:16+record.length},{decodeMode:'full',resources:[[name,bytes]]});await full.prepare([records[0]]);
  assert.deepEqual(new Uint8Array(memory.buffer,0,705600),full.tracks[0].fullPcm.subarray(record.loop,record.loop+705600));
});
test('malformed Vorbis is surfaced, never cached as silence',async()=>{
  const music=new EaglerMusic({size:1048592,blockSize:262144},{resources:[['bgm-ogg/th10_02.ogg',new Uint8Array([1,2,3])]]});
  await assert.rejects(music.prepare([{name:'bgm-ogg/th10_02.ogg',offset:16,loop:0,length:1048576}]));
});
test('managed native audio recovers late OGG with original CFG preload bit set',async()=>{
  const records=layout.map(t=>({name:t.oggPath,offset:t.offset,loop:t.loop,length:t.length}));
  const music=new EaglerMusic({size:Math.max(...records.map(t=>t.offset+t.length))});await music.prepare(records);
  const config=new Uint8Array(52),view=new DataView(config.buffer);
  view.setUint32(0,0x100003,true);view.setUint16(22,600,true);view.setUint16(24,600,true);
  config[27]=config[28]=1;config[31]=2;config[32]=100;config[33]=80;view.setUint32(48,0x110,true);
  const load=name=>readFile(new URL('../site/'+name,import.meta.url));
  const tables=await Promise.all(Array.from({length:15},async(_,i)=>JSON.parse(gunzipSync(await load(`fonts/128/${32+i*2}-400.json.gz`)))));
  let clock=1,pcmReads=0;
  const originalRead=music.subarray.bind(music);music.subarray=(start,end)=>{const bytes=originalRead(start,end);if(bytes?.some(v=>v!==0))pcmReads++;return bytes;};
  const game=await createNativeGame(await load('vendor/th10-game.wasm'),{managedMusic:true,files:new Map([['th10.dat',new Uint8Array(await readFile(new URL('../assets-ogg/th10.data',import.meta.url)))],['th10.cfg',config],['thbgm.dat',music]]),fontBackend:new GDIFonts(gunzipSync(await load('fonts/blend.bin.gz')),tables),monotonic:()=>clock});
  const step=async count=>{for(let i=0;i<count;i++){await prepareNativeMusic(music,game.native.store);clock+=1/60;game.step({milliseconds:17});}};
  try{
    await step(180);
    assert([...game.native.store.handles.values()].some(file=>file.name==='thbgm.dat'),'managed audio uses the original file stream despite CFG bit 16');
    assert.equal(pcmReads,0);
    music.install(records[0].name,await readFile(new URL('../assets-ogg/'+records[0].name,import.meta.url)));
    for(let i=0;i<12&&!pcmReads;i++)await step(120);
    assert(pcmReads>0,'native stream reads newly installed PCM instead of keeping silent native cache: '+JSON.stringify({frames:game.frames,screen:game.screen(),handles:[...game.native.store.handles.values()].map(({name,cursor,seekPosition})=>({name,cursor,seekPosition}))}));
    const saved=game.native.store.overlay.get('th10.cfg');assert.equal(new DataView(saved.buffer,saved.byteOffset).getUint32(48,true)&16,16,'saved graphics/configuration flag is preserved');
  }finally{game.close();}
});
