// Windows/Chromium diagnostic runner. Instrumentation is injected by this local
// HTTP server only; no profiling hooks are included in the release Runtime.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
if(!args.original||!args.puppeteer||!args.browser)throw Error('Required --original= --puppeteer= --browser=');
const {default:puppeteer}=await import(pathToFileURL(resolve(args.puppeteer)).href);
const root=fileURLToPath(new URL('../',import.meta.url)),site=resolve(args.site??resolve(root,'build-eagler'));
const evidence=resolve(args.output??resolve(root,'artifacts/validation/performance/'+(args.label??'sample')));
const mode=args.mode??'stream',sampleFrames=Number(args.frames??1200);await mkdir(evidence,{recursive:true});
const harness=`<!doctype html><body style="margin:0"><iframe style="width:100vw;height:100vh;border:0"></iframe><script>
window.events=[];window.__eaglerPrepareManagedRuntimeDataV1=async()=>({buffer:await fetch('/private/th10.dat').then(r=>r.arrayBuffer())});
addEventListener('message',e=>{if(e.origin===location.origin)events.push(e.data)});
window.send=(command,detail={})=>document.querySelector('iframe').contentWindow.postMessage({protocol:'eagler-touhou/1',game:'th10',command,...detail},location.origin);
document.querySelector('iframe').src='/runtime/th10.html?hosted=1&managedData=1&gameGeneration=profile';</script>`;
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.setHeader('Content-Type','text/html');res.end(harness);return;}
  let file;if(path==='/private/th10.dat')file=resolve(args.original,'th10.dat');
  else if(path.startsWith('/music/'))file=resolve(root,'assets-ogg/bgm-ogg',path.slice(7));
  else if(path.startsWith('/runtime/')){file=resolve(site,path.slice(9));if(!file.startsWith(site+sep))throw Error('Invalid path');}
  else{res.writeHead(404).end();return;}
  let data=await readFile(file);
  if(path.endsWith('/native-worker.mjs'))data=Buffer.from(data.toString()+'\nglobalThis.__profileGame=()=>game;\n');
  if(path.endsWith('/native-game.mjs'))data=Buffer.from(data.toString().replace('(Date.now()>>>0)&65535','12345'));
  res.setHeader('Content-Type',extname(file)==='.wasm'?'application/wasm':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
}catch(error){res.writeHead(404).end(String(error));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:args.browser,headless:true,args:['--explicitly-allowed-ports='+server.address().port,'--autoplay-policy=no-user-gesture-required','--disable-features=CalculateNativeWinOcclusion']});
try{
  const system=await browser.target().createCDPSession();const gpu=await system.send('SystemInfo.getInfo');await system.detach();
  const page=await browser.newPage(),errors=[];let worker;
  page.on('workercreated',w=>{if(w.url().includes('native-worker.mjs'))worker=w;});page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewport({width:960,height:720});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>events.some(e=>e.event==='ready'),{timeout:30000});
  await page.evaluate(mode=>{send('configure',{music:mode==='none'?'none':'ogg',resources:mode==='none'?[]:[{path:'/bgm-ogg/th10_01.ogg',url:location.origin+'/music/th10_01.ogg'},{path:'/bgm-ogg/th10_02.ogg',url:location.origin+'/music/th10_02.ogg'}],options:{oggDecodeMode:mode==='full'?'full':'stream'}});send('launch');},mode);
  await page.waitForFunction(()=>events.some(e=>e.event==='first-frame'),{timeout:120000});
  const frame=page.frames().find(f=>f.url().includes('th10.html'));
  for(let i=0;i<12;i++){
    if((await frame.evaluate(()=>nativeStatus?.screen?.touch?.context))==='gameplay')break;
    await page.evaluate(()=>send('keyboard',{code:'KeyZ',down:true}));await new Promise(r=>setTimeout(r,90));
    await page.evaluate(()=>send('keyboard',{code:'KeyZ',down:false}));await new Promise(r=>setTimeout(r,1400));
  }
  await frame.waitForFunction(()=>nativeStatus?.screen?.touch?.context==='gameplay'&&nativeStatus.screen.touch.ready,{timeout:30000});
  await page.evaluate(()=>send('keyboard',{code:'KeyZ',down:true}));
  await worker.evaluate(sampleFrames=>{
    const g=__profileGame(),gl=g.renderer.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const out=globalThis.__perf={rows:[],gpu:[],queries:[],start:g.frames,done:false,screen:g.screen(),gpuSupported:!!ext};
    let apiCalls=0,lastStart=performance.now();const read=g.native.graphics.m.readWords;
    g.native.graphics.m.readWords=function(...a){apiCalls++;return read.apply(this,a);};
    const step=g.step;
    g.step=function(...a){
      if(out.done)return step.apply(this,a);
      const before=g.frames,start=performance.now(),stats={...g.renderer.stats},calls=apiCalls;
      let query;if(ext&&out.rows.length%10===0&&out.queries.length<16){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
      const result=step.apply(this,a),end=performance.now();if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);out.queries.push(query);}
      if(g.frames!==before)out.rows.push({frame:g.frames,stepMs:end-start,gapMs:start-lastStart,renderMs:g.renderer.stats.ms-stats.ms,draws:g.renderer.stats.calls-stats.calls,batches:g.renderer.stats.batches-stats.batches,uploadBytes:g.renderer.stats.uploadBytes-stats.uploadBytes,readBytes:g.renderer.stats.readBytes-stats.readBytes,apiCalls:apiCalls-calls});
      lastStart=start;
      if(ext&&out.rows.length%10===0){const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);while(out.queries.length&&gl.getQueryParameter(out.queries[0],gl.QUERY_RESULT_AVAILABLE)){const q=out.queries.shift(),ns=gl.getQueryParameter(q,gl.QUERY_RESULT);if(!disjoint)out.gpu.push(ns/1e6);gl.deleteQuery(q);}}
      if(out.rows.length>=sampleFrames){out.done=true;out.endScreen=g.screen();}
      return result;
    };
  },sampleFrames);
  await worker.client.send('Profiler.enable');await worker.client.send('Profiler.setSamplingInterval',{interval:250});await worker.client.send('Profiler.start');
  console.log(JSON.stringify({sampling:sampleFrames,mode,evidence}));
  for(let n=0;n<360;n++){await new Promise(r=>setTimeout(r,1000));if(await worker.evaluate(()=>__perf.done))break;}
  const {profile}=await worker.client.send('Profiler.stop');
  const data=await worker.evaluate(()=>{const {queries,...rest}=__perf;return rest;});assert(data.done,'sample timed out');
  const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
  const summary={mode,frames:data.rows.length,start:data.start,screen:data.screen,endScreen:data.endScreen,gpuSupported:data.gpuSupported,gpu:stats(data.gpu),browser:await browser.version(),gpuInfo:gpu.gpu,errors};
  for(const key of ['stepMs','gapMs','renderMs','draws','batches','uploadBytes','readBytes','apiCalls'])summary[key]=stats(data.rows.map(r=>r[key]));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();
  profile.samples?.forEach((id,i)=>{const f=nodes.get(id)?.callFrame,key=(f?.functionName||'(anonymous)')+' '+(f?.url||'')+':'+(f?.lineNumber??0);self.set(key,(self.get(key)??0)+(profile.timeDeltas?.[i]??0));});
  summary.cpuSelfMs=[...self].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([frame,us])=>({frame,ms:us/1000}));
  await writeFile(resolve(evidence,'worker.cpuprofile'),JSON.stringify(profile));await writeFile(resolve(evidence,'samples.json'),JSON.stringify(data));await writeFile(resolve(evidence,'report.json'),JSON.stringify(summary,null,2));
  await page.screenshot({path:resolve(evidence,'end.png')});assert.deepEqual(errors,[]);
  console.log(JSON.stringify(summary));
}finally{await browser.close();await new Promise(r=>server.close(r));}
