import {createNativeGame} from './native-game.mjs';
import {fetchBytes,fetchGzip,PagedMusic} from './assets.mjs';
import {GDIFonts} from './gdi-fonts.mjs';
import {musicTracks} from './music-layout.mjs';
import {prepareNativeMusic} from './native-music-window.mjs';
import {openNativeStorage} from './storage.mjs';
import {openAssetStorage,readAssetBytes} from './asset-store.mjs';
let game,keys=new Set(),pad=null,focused=true,uiPaused=false,quit=false,resume,started=false,saveError;
const pulses=new Map(),minimumPress=new Map(),releases=new Map(),saves=new Set();
const wake=()=>{resume?.();resume=null;};
self.onmessage=({data})=>{
 if(data.type==='start'&&!started){started=true;start(data).catch(error=>postMessage({type:'error',message:String(error.stack??error)}));}
 else if(data.type==='key'||data.type==='pulse'){
  if(data.down||data.type==='pulse'){keys.add(data.code);releases.delete(data.code);if(data.minFrames)minimumPress.set(data.code,(game?.frames??0)+Math.min(3,data.minFrames));if(data.type==='pulse')pulses.set(data.code,(game?.frames??0)+(data.frames??3));}
  else if((minimumPress.get(data.code)??0)>(game?.frames??0))releases.set(data.code,minimumPress.get(data.code));else{keys.delete(data.code);minimumPress.delete(data.code);}
 }else if(data.type==='blur'){keys.clear();pulses.clear();minimumPress.clear();releases.clear();game?.cancelTouch();}
 else if(data.type==='gamepad')pad=data.pad;
 else if(data.type==='touch-options')game?.configureTouch(data);
 else if(data.type==='touch-drag')game?.drag(data,keys);
 else if(data.type==='touch-cancel')game?.cancelTouch();
 else if(data.type==='focus'){focused=data.active;wake();}
 else if(data.type==='ui-pause'){uiPaused=data.active;wake();}
 else if(data.type==='quit'){quit=true;focused=true;uiPaused=false;wake();}
 else if(data.type==='flush-saves'){
  game?.save();Promise.all(saves).then(()=>{if(saveError)throw saveError;postMessage({type:'saves-flushed',id:data.id});}).catch(error=>postMessage({type:'saves-flushed',id:data.id,error:String(error)}));
 }
};
async function start({canvas,audioPort,language='jp',gamepad,assetMode={archive:'remote',music:'remote'}}){
 if(!canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false}))throw new Error('This browser cannot draw the WebGL 2 game screen.');pad=gamepad??pad;
 postMessage({type:'status',message:'Loading game files...'});
 const siteUrl=new URL('../',import.meta.url),manifest=await fetch(new URL('manifest.json',siteUrl)).then(response=>{if(!response.ok)throw new Error('Cannot read the game manifest.');return response.json();}),archive=language==='chs'?'th10c.dat':'th10.dat',charset=language==='chs'?134:128,storage=await openNativeStorage(language),saved=await storage.load(),assetStorage=assetMode.archive==='local'||assetMode.music==='local'?await openAssetStorage():null;
 const localArchive=assetMode.archive==='local'?await assetStorage.get(archive):null,localMusic=assetMode.music==='local'?await assetStorage.get('thbgm.dat'):null;
 if(assetMode.archive==='local'&&!localArchive)throw new Error(`Import ${archive} again.`);if(assetMode.music==='local'&&!localMusic)throw new Error('Import thbgm.dat again.');
 const [module,archiveBytes,blend,tables]=await Promise.all([fetchBytes(new URL('vendor/th10-game.wasm',siteUrl)),localArchive?readAssetBytes(localArchive,archive):fetchBytes(new URL('data/'+archive,siteUrl)),fetchGzip(new URL('fonts/blend.bin.gz',siteUrl)),Promise.all(Array.from({length:15},(_,i)=>fetchGzip(new URL(`fonts/${charset}/${32+i*2}-400.json.gz`,siteUrl)).then(bytes=>JSON.parse(new TextDecoder().decode(bytes)))))]);
 const music=new PagedMusic(manifest.music,assetMode.music==='local'?{source:localMusic}:assetMode.music==='silent'?{silent:true}:{});postMessage({type:'status',message:assetMode.music==='silent'?'Loading text. No BGM; the game will be silent...':'Loading music and text...'});await music.prepare(musicTracks);
 // The original optional "load music into memory" setting can read a whole
 // track in one call. Keep its full archive resident only when requested.
 const configuration=saved.find(([name])=>name==='th10.cfg')?.[1];if(configuration?.length===52&&(new DataView(configuration.buffer,configuration.byteOffset).getUint32(48,true)&16)){
  const count=Math.ceil(music.length/music.blockSize);music.capacity=count;let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<count)await music.load(next++);}));
 }
 const files=new Map([[archive,archiveBytes],['thbgm.dat',music],...saved]),onWrite=(name,bytes)=>{const promise=storage.save(name,bytes);saves.add(promise);promise.then(()=>saves.delete(promise),error=>{saveError=error;saves.delete(promise);});};
 game=await createNativeGame(module,{files,language,fontBackend:new GDIFonts(blend,tables),onWrite,canvas,audioPort,onContext:context=>postMessage({type:'touch-context',context})});
 let previousTime=performance.now(),audioRemainder=0,lastFrame=0,lastSample=previousTime;
 try{
  for(;;){
   if(!focused||uiPaused){await new Promise(resolve=>resume=resolve);previousTime=lastSample=performance.now();lastFrame=game.frames;continue;}
   if(saveError)throw saveError;if(quit){quit=false;game.stop();}
   await prepareNativeMusic(music,game.native.store);const now=performance.now();audioRemainder+=now-previousTime;previousTime=now;const elapsed=Math.floor(audioRemainder);audioRemainder-=elapsed;
   const result=game.step({keys,pads:pad?[pad]:[],focused,milliseconds:elapsed});
   for(const [code,end] of releases)if(game.frames>=end){keys.delete(code);releases.delete(code);minimumPress.delete(code);}
   for(const [code,end] of pulses)if(game.frames>=end){keys.delete(code);pulses.delete(code);}
   if(game.frames-lastFrame>=30){postMessage({type:'frame',frame:game.frames,fps:(game.frames-lastFrame)*1000/(now-lastSample),draws:{...game.renderer.stats},screen:game.screen(),execution:'native-cpp'});lastFrame=game.frames;lastSample=now;}
   if(result)break;await new Promise(resolve=>setTimeout(resolve,Math.max(1,Math.ceil(game.delay()))));
  }
 }finally{game.close();await Promise.all(saves);}if(saveError)throw saveError;postMessage({type:'exit',code:0});
}
