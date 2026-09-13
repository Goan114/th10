import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return [v.slice(2,i),v.slice(i+1)];}));
for(const name of ['site','puppeteer','browser'])if(!args[name])throw Error('Missing --'+name);
const menuTouch=args['menu-touch']==='true';
const root=resolve(args.site),{default:puppeteer}=await import(pathToFileURL(resolve(args.puppeteer)).href);
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,path==='/'?'index.html':path.slice(1));if(!file.startsWith(root+sep))throw Error('Invalid path');res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:args.browser,headless:true,args:['--explicitly-allowed-ports='+server.address().port,'--autoplay-policy=no-user-gesture-required']});
const evidence=resolve('artifacts/validation/launcher');await mkdir(evidence,{recursive:true});
try{
 const page=await browser.newPage(),errors=[],events=[];page.on('pageerror',error=>{errors.push(String(error));console.log('PAGEERROR',error.stack);});
 await page.setViewport({width:1280,height:900,hasTouch:menuTouch});await page.evaluateOnNewDocument(enableTouch=>{
  window.runtimeEvents=[];addEventListener('message',e=>{if(e.data?.protocol==='eagler-touhou/1')runtimeEvents.push(e.data);});
  if(enableTouch)localStorage.setItem('eagler-touhou-game-options-v1-th10',JSON.stringify({music:'none',musicPreferenceExplicit:true,options:{touchEnabled:true,touchMovementMode:'touch',touchSensitivity:100,touchFocusMode:'hold-button'}}));
 },menuTouch);
 await page.goto(`http://127.0.0.1:${server.address().port}/?debug=th10-stage1`);
 if(args['preload-config']){
  const cfg=new Uint8Array(await readFile(args['preload-config']));assert.equal(cfg.length,52);
  const flags=new DataView(cfg.buffer);flags.setUint32(48,flags.getUint32(48,true)|16,true);cfg[27]=cfg[28]=1;cfg[32]=100;cfg[33]=80;
  await page.evaluate(bytes=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('th10-1.00a-eagler',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result,tx=db.transaction('files','readwrite');tx.objectStore('files').put(new Uint8Array(bytes),'th10.cfg');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
  }),Array.from(cfg));
 }
 await page.waitForFunction(()=>document.querySelector('.game[aria-current]'));await page.waitForSelector('.game[data-game=th10]',{visible:true});await page.$eval('.game[data-game=th10]',e=>e.click());
 await page.waitForFunction(()=>document.querySelector('.tools').getAttribute('aria-hidden')==='false');
 if(menuTouch)assert.equal(await page.$eval('#touchToggle',element=>element.getAttribute('aria-checked')), 'true');
 console.log('options',await page.$eval('#musicSelect',e=>[...e.options].map(o=>({value:o.value,text:o.textContent,disabled:o.disabled}))));
 await page.select('#musicSelect',args.mode??'ogg-stream');await page.screenshot({path:resolve(evidence,'card.png')});await page.click('#launch');
 try{await page.waitForFunction(()=>runtimeEvents.some(e=>e.event==='first-frame')||!document.querySelector('#startupError').hidden,{timeout:120000});}
 catch(error){console.log('DIAGNOSTIC',await page.evaluate(()=>({events:runtimeEvents,status:document.querySelector('#status')?.textContent,error:document.querySelector('#startupErrorText')?.textContent,player:document.querySelector('#playerStatus')?.textContent})));throw error;}
 const diagnostic=await page.evaluate(()=>({events:runtimeEvents,status:document.querySelector('#status')?.textContent,error:document.querySelector('#startupErrorText')?.textContent}));
 assert(diagnostic.events.some(e=>e.event==='first-frame'),JSON.stringify(diagnostic));
 const frame=page.frames().find(f=>f.url().includes('th10.html'));
 const firstFrame=await frame.evaluate(()=>globalThis.nativeStatus?.frame??0);
 // Leave the title idle while the managed package installs later tracks.
 // The regression appeared after first-frame, so launch acknowledgement alone
 // is insufficient: the game must keep presenting and playing title BGM.
 if((args.mode??'ogg-stream')!=='none')await frame.waitForFunction(()=>globalThis.nativeAudio?.rms>.001,{timeout:10000});
 await new Promise(r=>setTimeout(r,5500));
 const startup=await frame.evaluate(()=>({status:globalThis.nativeStatus,audio:globalThis.nativeAudio}));
 assert(startup.status.frame-firstFrame>=150,'background music installation stalled the title');
 for(let i=0;i<12;i++){
  if(await frame.evaluate(()=>globalThis.nativeStatus?.screen?.touch?.context==='gameplay'))break;
  if(menuTouch){const accepted=await frame.evaluate(pointerId=>{
   const canvas=document.querySelector('#canvas'),rect=canvas.getBoundingClientRect(),point={clientX:rect.left+rect.width*.5,clientY:rect.top+rect.height*.5};
   const down=new PointerEvent('pointerdown',{...point,pointerId,pointerType:'touch',bubbles:true,cancelable:true});
   const up=new PointerEvent('pointerup',{...point,pointerId,pointerType:'touch',bubbles:true,cancelable:true});
   canvas.dispatchEvent(down);canvas.dispatchEvent(up);
   return {down:down.defaultPrevented,up:up.defaultPrevented,options:Module.eaglerOptions,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};
  },100+i);
   if(i===0){console.log('menu-touch',accepted);assert.equal(accepted.down,true,'runtime canvas did not accept touch pointerdown');assert.equal(accepted.up,true,'runtime canvas did not accept touch pointerup');}
  }
  else await page.keyboard.press('z',{delay:100});
  await new Promise(r=>setTimeout(r,1400));
 }
 await frame.waitForFunction(()=>globalThis.nativeStatus?.screen?.touch?.context==='gameplay',{timeout:30000});
 await page.screenshot({path:resolve(evidence,'gameplay.png')});assert.deepEqual(errors,[]);
 const result={pass:true,mode:args.mode??'ogg-stream',nativePreload:!!args['preload-config'],menuInput:menuTouch?'touch':'keyboard',diagnostic,startup,observation:await frame.evaluate(()=>({status:globalThis.nativeStatus,audio:globalThis.nativeAudio}))};await writeFile(resolve(evidence,`report-${result.mode}${result.nativePreload?'-preload':''}${menuTouch?'-menu-touch':''}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({pass:true,mode:result.mode,nativePreload:result.nativePreload,menuInput:result.menuInput,evidence}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
