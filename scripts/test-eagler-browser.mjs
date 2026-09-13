import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const at=a.indexOf('=');return [a.slice(2,at),a.slice(at+1)];}));
if(!args.original||!args.puppeteer||!args.browser)throw new Error('Required --original= --puppeteer= --browser=');
const {default:puppeteer}=await import(pathToFileURL(resolve(args.puppeteer)).href);
const root=fileURLToPath(new URL('../',import.meta.url)),site=resolve(root,'build-eagler'),evidence=resolve(root,'artifacts/validation/browser');await mkdir(evidence,{recursive:true});
const harness=`<!doctype html><body style="margin:0"><iframe style="width:100vw;height:100vh;border:0"></iframe><script>
window.events=[];window.__eaglerPrepareManagedRuntimeDataV1=async()=>({buffer:await fetch('/private/th10.dat').then(r=>r.arrayBuffer())});
window.addEventListener('message',e=>{if(e.origin===location.origin)events.push(e.data)});
window.send=async(command,detail={})=>{const request=crypto.randomUUID();document.querySelector('iframe').contentWindow.postMessage({protocol:'eagler-touhou/1',game:'th10',command,request,...detail},location.origin);return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('timeout '+command)),120000);const listener=e=>{if(e.data?.request===request){clearTimeout(timeout);removeEventListener('message',listener);e.data.ok?resolve(e.data):reject(Error(e.data.error))}};addEventListener('message',listener)})};document.querySelector('iframe').src='/runtime/th10.html?hosted=1&managedData=1&gameGeneration=test';</script>`;
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(harness);return;}
 let file;if(path==='/private/th10.dat')file=resolve(args.original,'th10.dat');
 else if(path.startsWith('/music/'))file=resolve(root,'assets-ogg/bgm-ogg',path.slice(7));
 else if(path.startsWith('/runtime/')){file=resolve(site,path.slice(9));if(!file.startsWith(site+sep))throw new Error('Invalid path');}
 else{res.writeHead(404).end();return;}
 const data=await readFile(file);res.setHeader('Content-Type',extname(file)==='.wasm'?'application/wasm':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:args.browser,headless:true,args:['--explicitly-allowed-ports='+server.address().port,'--autoplay-policy=no-user-gesture-required','--disable-features=CalculateNativeWinOcclusion']});
const report=[];
try{
 for(const mode of (args.mode?[args.mode]:['none','stream','full'])){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e))});await page.setViewport({width:960,height:720});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>events.some(e=>e.event==='ready')||events.some(e=>e.event==='error'),{timeout:30000});
  const startupErrors=await page.evaluate(()=>events.filter(e=>e.event==='error'));assert.deepEqual(startupErrors,[]);
  await page.evaluate(async(mode)=>{await send('configure',{music:mode==='none'?'none':'ogg',resources:mode==='none'?[]:[{path:'/bgm-ogg/th10_01.ogg',url:location.origin+'/music/th10_01.ogg'},{path:'/bgm-ogg/th10_02.ogg',url:location.origin+'/music/th10_02.ogg'}],options:{touchEnabled:true,touchMovementMode:'touch-unlimited',touchFocusMode:'hold-button',oggDecodeMode:mode==='full'?'full':'stream'}});await send('launch');},mode);
  await page.waitForFunction(()=>events.some(e=>e.event==='first-frame')||events.some(e=>e.event==='error'),{timeout:120000});
  assert.deepEqual(await page.evaluate(()=>events.filter(e=>e.event==='error')),[]);
  const frame=page.frames().find(f=>f.url().includes('th10.html'));
  if(mode!=='none')await frame.waitForFunction(()=>globalThis.nativeAudio?.rms>.001,{timeout:10000});
  for(let i=0;i<12;i++){
   if((await frame.evaluate(()=>nativeStatus?.screen?.touch?.context))==='gameplay')break;
   await page.evaluate(()=>send('keyboard',{code:'KeyZ',down:true}));await new Promise(r=>setTimeout(r,90));await page.evaluate(()=>send('keyboard',{code:'KeyZ',down:false}));await new Promise(r=>setTimeout(r,1400));
  }
  await frame.waitForFunction(()=>nativeStatus?.screen?.touch?.context==='gameplay'&&nativeStatus.screen.touch.ready,{timeout:30000});
  await page.evaluate(()=>send('touch-controls',{fireEnabled:true,focusEnabled:false,bombSerial:0,escapeSerial:0,joystickX:0,joystickY:0,touchSensitivity:100}));
  const before=await frame.evaluate(()=>nativeStatus.screen.touch);
  await page.evaluate(async()=>{await send('direct-touch',{type:'down',id:1,x:.5,y:.7});await send('direct-touch',{type:'move',id:1,x:.6,y:.6});});
  await new Promise(r=>setTimeout(r,700));const after=await frame.evaluate(()=>nativeStatus.screen.touch);
  assert(after.x>before.x+20,'direct touch moved right');
  await page.evaluate(()=>send('direct-touch',{type:'up',id:1,x:.6,y:.6}));
  await page.evaluate(async()=>{await send('write',{path:'replay/th10_ud0001.rpy',bytes:[116,49,48,114,1,2,3]});const value=await send('read',{path:'replay/th10_ud0001.rpy'});if(value.bytes.length!==7)throw Error('storage read failed');await send('remove',{path:'replay/th10_ud0001.rpy'});await send('sync');});
  await page.screenshot({path:resolve(evidence,mode+'.png')});
  const observation=await frame.evaluate(()=>({audio:globalThis.nativeAudio,status:globalThis.nativeStatus}));
  assert.deepEqual(errors,[]);report.push({mode,before,after,observation,errors});await page.close();
 }
 await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,evidence,modes:report.map(x=>x.mode)}));
}finally{await browser.close();await new Promise(r=>server.close(r));}

