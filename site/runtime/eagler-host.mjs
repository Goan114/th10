import {InputSources} from './input-sources.mjs';
import {EaglerTouch,normalizedAction} from './eagler-touch.mjs';
import {installCanvasTouchBridge} from './canvas-touch-bridge.mjs';
import {openNativeStorage} from './storage.mjs';

const protocol='eagler-touhou/1',game='th10',saveRoot='/savesth10';
const canvas=document.querySelector('#canvas'),status=document.querySelector('#status');
const params=new URLSearchParams(location.search),resources=new Map(),pending=new Map();
let worker,audio,archive,storage,configured=false,launched=false,sequence=0;
const emit=(event,detail={})=>parent.postMessage({protocol,game,event,...detail},location.origin);
const reply=(request,ok,detail={})=>{if(request)parent.postMessage({protocol,game,request,ok,...detail},location.origin);};
const fail=error=>{status.textContent=String(error.message??error);emit('error',{error:status.textContent});};
const send=data=>worker?.postMessage(data);
const input=new InputSources((code,down)=>send({type:'key',code,down}));
const touch=new EaglerTouch({input,send});
let cachedTouchViewport;
const invalidateTouchViewport=()=>{cachedTouchViewport=null;};
const touchViewport=(force=false)=>{
  if(force||!cachedTouchViewport)cachedTouchViewport={width:innerWidth,height:innerHeight,rect:canvas.getBoundingClientRect()};
  return cachedTouchViewport;
};
const resumeAudio=()=>{if(audio?.state==='suspended')void audio.resume();};
const canvasTouch=installCanvasTouchBridge({canvas,touch,getViewport:touchViewport,isActive:()=>launched,onInteraction:resumeAudio});
const canvasResize=new ResizeObserver(invalidateTouchViewport);canvasResize.observe(canvas);
addEventListener('resize',invalidateTouchViewport);
visualViewport?.addEventListener('resize',invalidateTouchViewport);
visualViewport?.addEventListener('scroll',invalidateTouchViewport);
document.addEventListener('fullscreenchange',invalidateTouchViewport);
const musicPath=path=>/^\/bgm-ogg\/th10_\d{2}\.ogg$/.test(path);
function putResource(path,value){
  if(!musicPath(path))throw new Error('Invalid TH10 resource path');
  const bytes=new Uint8Array(value);resources.set(path,bytes);
  if(launched)send({type:'resource',path,bytes});
}
// The Launcher materializes Package Store resources synchronously before launch
// and incrementally afterwards. This facade owns immutable music only.
globalThis.FS={mkdirTree(path){if(path!=='/bgm-ogg')throw new Error('Invalid resource directory');},writeFile:putResource,readFile(path){const bytes=resources.get(path);if(!bytes)throw new Error('Resource missing');return bytes;}};
globalThis.Module={FS:globalThis.FS,canvas,touhouMusicMode:'none',eaglerOptions:{}};
function validSave(path){
  if(typeof path!=='string'||!path||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Invalid save path');
  if(!/^(?:scoreth10\.dat|th10\.cfg|replay\/[^/]+\.rpy)$/.test(path))throw new Error('Unsupported save file');
  return path;
}
function workerRequest(type,detail={}){
  return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Runtime operation timed out'));},15000);pending.set(id,{resolve,reject,timer});send({type,id,...detail});});
}
async function configure(message){
  if(launched)throw new Error('Runtime already launched');
  if(!['ogg','none','midi'].includes(message.music))throw new Error('Invalid music mode');
  const options=message.options??{};
  if(!['stream','full'].includes(options.oggDecodeMode??'stream'))throw new Error('Invalid OGG decode mode');
  touch.configure(options);Module.eaglerOptions={...options};Module.touhouMusicMode=message.music;
  for(const resource of message.resources??[]){
    if(!musicPath(resource.path))throw new Error('Invalid music resource');
    const url=new URL(resource.url,location.href);if(url.origin!==location.origin)throw new Error('Cross-origin music resource');
    const response=await fetch(url);if(!response.ok)throw new Error('Music download failed');
    const bytes=new Uint8Array(await response.arrayBuffer());if(resource.size!=null&&bytes.length!==resource.size)throw new Error('Music size mismatch');putResource(resource.path,bytes);
  }
  configured=true;
}
async function launch(){
  if(launched)return;if(!configured||!archive)throw new Error('Runtime not configured');
  audio=new AudioContext({sampleRate:44100,latencyHint:'interactive'});await audio.resume();
  await audio.audioWorklet.addModule(new URL('./audio-worklet.mjs',import.meta.url));
  const sound=new AudioWorkletNode(audio,'native-directsound',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]}),channel=new MessageChannel();sound.connect(audio.destination);
  await new Promise((resolve,reject)=>{sound.port.onmessage=({data})=>{globalThis.nativeAudio=data;if(data.type==='ready')resolve();};sound.onprocessorerror=()=>reject(new Error('Audio processor failed'));sound.port.postMessage({type:'connect',port:channel.port1},[channel.port1]);});
  worker=new Worker(new URL('./native-worker.mjs',import.meta.url),{type:'module'});
  worker.onerror=event=>fail(new Error(event.message));
  let first=false;
  worker.onmessage=({data})=>{
    globalThis.nativeStatus=data;
    if(data.type==='touch-context'){touch.setContext(data.context);return;}
    if(data.type==='storage-result'||data.type==='saves-flushed'){
      const request=pending.get(data.id);if(request){pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(new Error(data.error)):request.resolve(data);}return;
    }
    if(data.type==='frame'){
      if(!first){first=true;status.textContent='';emit('first-frame');emit('runtime-info',{renderer:'WebGL2 · C++/WASI'});}
      emit('frame-health',{fps:data.fps,maxGapMs:data.maxGapMs??0});
    }else if(data.type==='exit'){touch.cancel();audio.close();emit('exit',{status:data.code===0?'success':'failure'});}
    else if(data.type==='error')fail(new Error(data.message));
    else if(data.type==='status')status.textContent=data.message;
  };
  const offscreen=canvas.transferControlToOffscreen();launched=true;
  worker.postMessage({type:'start',canvas:offscreen,audioPort:channel.port2,language:'jp',managed:{archive,resources:[...resources],music:Module.touhouMusicMode,decodeMode:Module.eaglerOptions.oggDecodeMode??'stream',options:Module.eaglerOptions},assetMode:{archive:'managed',music:'managed'}},[offscreen,channel.port2]);
  touch.configure(Module.eaglerOptions);canvas.focus({preventScroll:true});
}
async function storageCommand(message){
  if(message.command!=='list'&&message.command!=='sync')validSave(message.path);
  if(launched)return workerRequest('storage-command',{command:message.command,path:message.path,bytes:message.bytes});
  const entries=new Map(await storage.load());
  switch(message.command){
    case 'list':return {files:[...entries].map(([path,data])=>({path,size:data.length}))};
    case 'read':{const bytes=entries.get(message.path);if(!bytes)throw new Error('File not found');return {path:message.path,bytes:Array.from(bytes)};}
    case 'write':await storage.save(message.path,new Uint8Array(message.bytes));break;
    case 'remove':await storage.remove(message.path);break;
    case 'sync':break;
  }
  return {};
}
let queue=Promise.resolve();
addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin)return;
  const message=event.data;if(message?.protocol!==protocol||message.game!==game)return;
  queue=queue.then(async()=>{
    try{
      let result={};
      switch(message.command){
        case 'configure':await configure(message);break;
        case 'resources':for(const resource of message.resources??[])putResource(resource.path,resource.bytes);break;
        case 'keyboard':if(typeof message.code!=='string'||typeof message.down!=='boolean')throw new Error('Invalid keyboard');input.set('host:'+message.code,message.down?[message.code]:[]);if(message.down)void audio?.resume();break;
        case 'keyboard-clear':for(const source of [...input.sources.keys()])if(source.startsWith('host:')||source.startsWith('keyboard:'))input.set(source,[]);break;
        case 'touch-controls':touch.controls(message);break;
        case 'touch-cancel':touch.cancel();break;
        case 'direct-touch':{
          const down=normalizedAction(message)==='down';
          touch.direct(message,touchViewport(down&&touch.pointers.size===0));if(down)resumeAudio();break;
        }
        case 'launch':await launch();break;
        case 'list':case 'read':case 'write':case 'remove':case 'sync':result=await storageCommand(message);break;
        default:throw new Error('Unknown command');
      }
      reply(message.request,true,result);
    }catch(error){if(message.request)reply(message.request,false,{error:String(error.message??error)});else fail(error);}
  });
});
for(const type of ['keydown','keyup'])addEventListener(type,event=>{if(!launched)return;event.preventDefault();input.set('keyboard:'+event.code,type==='keydown'?[event.code]:[]);if(type==='keydown')void audio.resume();});
addEventListener('blur',()=>{input.clear();canvasTouch.reset();touch.cancel();send({type:'blur'});});
document.addEventListener('visibilitychange',()=>{if(document.hidden){input.clear();canvasTouch.reset();touch.cancel();}send({type:'focus',active:!document.hidden});if(!document.hidden)void audio?.resume();});
addEventListener('pagehide',()=>{canvasResize.disconnect();canvasTouch.dispose();touch.dispose();worker?.terminate();void audio?.close();});
try{
  if(parent===self||params.get('managedData')!=='1')throw new Error('Launch TH10 from eagler-touhou');
  storage=await openNativeStorage('eagler');
  const prepared=await parent.__eaglerPrepareManagedRuntimeDataV1({game,generation:params.get('gameGeneration')??''});
  if(!prepared?.buffer?.byteLength)throw new Error('Managed TH10 DAT is empty');archive=new Uint8Array(prepared.buffer);
  // The retail archive header is encrypted. files_attach in the Wasm owns
  // format validation; a plaintext signature test would reject real DATs.
  emit('transfer',{kind:'game',mode:'managed',loaded:archive.length,total:archive.length});emit('ready',{saveRoot});
}catch(error){fail(error);}
