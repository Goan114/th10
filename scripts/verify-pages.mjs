import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),read=path=>readFileSync(root+path,'utf8');
const html=read('site/index.html'),runtimeFiles=readdirSync(root+'site/runtime').filter(name=>name.endsWith('.mjs'));
assert.match(html,/id="asset-import"/);assert.match(html,/id="asset-status"/);assert.match(html,/id="start" disabled/);
assert.doesNotMatch(html,/(?:src|href)="\/(?:runtime|vendor|fonts|data)\//);
for(const name of runtimeFiles){
  const path=root+'site/runtime/'+name,source=read('site/runtime/'+name);
  assert.doesNotMatch(source,/(?:fetch|addModule|new Worker)\(\s*['"]\/(?:runtime|vendor|fonts|data|manifest)/,name);
  execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
}
const trackedData=execFileSync('git',['ls-files','site/data'],{cwd:root,encoding:'utf8'}).trim();assert.equal(trackedData,'','GitHub Pages must not publish site/data');
const {PagedMusic}=await import(new URL('../site/runtime/assets.mjs',import.meta.url));
const bytes=Uint8Array.from({length:10},(_,index)=>index+1),local=new PagedMusic({size:10,blockSize:4,chunked:true},{source:new Blob([bytes]),capacity:2,ahead:0});
assert.deepEqual(await local.load(1),bytes.subarray(4,8));
const silent=new PagedMusic({size:10,blockSize:4,chunked:true},{silent:true,capacity:2,ahead:0});
assert.deepEqual(await silent.load(2),new Uint8Array(2));
console.log(JSON.stringify({verified:true,runtimeModules:runtimeFiles.length,trackedGameData:false,subpathSafe:true,localMusic:true,silentMusic:true},null,2));
