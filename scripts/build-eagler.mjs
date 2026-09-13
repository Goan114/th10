import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),site=resolve(root,'site');
const arg=process.argv.slice(2).find(v=>v.startsWith('--output='));
const output=resolve(arg?arg.slice(9):resolve(root,'build-eagler'));
if(output===site||output===root)throw new Error('Output must be separate from source');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),files={};
let previous={};
try{previous=JSON.parse(await readFile(resolve(output,'runtime-files.json'),'utf8')).files??{};}catch(error){if(error.code!=='ENOENT')throw error;}
const report=JSON.parse(await readFile(resolve(root,'source/build-report.json'),'utf8'));
const sourceDigest=createHash('sha256');
for(const name of report.sourceFiles)sourceDigest.update(name+'\0').update(await readFile(resolve(root,'source',name)));
if(sourceDigest.digest('hex')!==report.sourceSha256||hash(await readFile(resolve(site,'vendor/th10-game.wasm')))!==report.sha256)throw new Error('Wasm is stale; run scripts/build.mjs with WASI SDK 34 first');
async function copy(name){
  if(files[name])return;
  if(name.startsWith('../')||name.includes('\\'))throw new Error('Runtime dependency escapes site');
  const bytes=await readFile(resolve(site,name));files[name]={bytes:bytes.length,sha256:hash(bytes)};
  await mkdir(dirname(resolve(output,name)),{recursive:true});await writeFile(resolve(output,name),bytes);
  if(/\.m?js$/.test(name)){
    const source=bytes.toString();
    for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|new URL\(\s*)['"](\.\.?\/[^'"]+\.m?js)['"]/g)){
      await copy(relative(site,resolve(site,dirname(name),match[1])).replaceAll('\\','/'));
    }
  }
}
await mkdir(output,{recursive:true});
for(const name of ['th10.html','manifest.json','runtime/eagler-host.mjs','runtime/native-worker.mjs','runtime/audio-worklet.mjs','vendor/th10-game.wasm','fonts/blend.bin.gz'])await copy(name);
for(const name of await readdir(resolve(site,'fonts/128')))if(name.endsWith('.json.gz'))await copy('fonts/128/'+name);
// Decoder licenses are part of the resource-free Runtime distribution.
for(const name of await readdir(resolve(site,'vendor')))if(/ogg|vorbis/i.test(name))await copy('vendor/'+name);
for(const name of Object.keys(previous))if(!files[name]){
  if(name.includes('\\')||name.split('/').some(part=>!part||part==='.'||part==='..')||relative(output,resolve(output,name)).startsWith('..'))throw new Error('Invalid previous Runtime path');
  await unlink(resolve(output,name)).catch(error=>{if(error.code!=='ENOENT')throw error;});
}
await writeFile(resolve(output,'runtime-files.json'),JSON.stringify({schema:'eagler-touhou/runtime-directory/1',files},null,2)+'\n');
console.log(JSON.stringify({output,files:Object.keys(files).length,wasm:files['vendor/th10-game.wasm']}));
