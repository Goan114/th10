import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),read=name=>readFileSync(root+name),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('site/manifest.json')),report=JSON.parse(read('source/build-report.json')),release=JSON.parse(read('release.json'));
const replayValidation=JSON.parse(read('validation/replays.json'));
assert.equal(manifest.execution.kind,'cpp-game-logic');assert.deepEqual(release.manifest,manifest);
const bytes=read('site/vendor/th10-game.wasm');assert.equal(sha(bytes),manifest.execution.sha256);assert.equal(sha(bytes),report.sha256);
assert.deepEqual(gunzipSync(read('site/vendor/th10-game.wasm.gz')),bytes);
for(const entry of WebAssembly.Module.imports(new WebAssembly.Module(bytes)))assert(['th10_files','th10_graphics','th10_fonts','th10_audio','th10_time'].includes(entry.module),entry.module);
const source=createHash('sha256');for(const name of report.sourceFiles)source.update(name+'\0').update(read('source/'+name));assert.equal(source.digest('hex'),report.sourceSha256);assert.equal(report.sourceSha256,manifest.execution.sourceSha256);
for(const variant of Object.values(manifest.variants))for(const [name,hash] of Object.entries(variant.hashes))assert.equal(sha(read('site/data/'+name)),hash,name);
const music=createHash('sha256'),blocks=readdirSync(root+'site/data/thbgm').sort();let musicBytes=0;
assert.equal(blocks.length,Math.ceil(manifest.music.size/manifest.music.blockSize));
for(const [index,name] of blocks.entries()){assert.equal(name,String(index).padStart(4,'0')+'.bin');const block=read('site/data/thbgm/'+name);assert.equal(block.length,Math.min(manifest.music.blockSize,manifest.music.size-index*manifest.music.blockSize));music.update(block);musicBytes+=block.length;}
assert.equal(music.digest('hex'),manifest.music.sha256);assert.equal(musicBytes,manifest.music.size);
assert(gunzipSync(read('site/fonts/blend.bin.gz')).length>0);for(const charset of [128,134])for(let size=32;size<=60;size+=2)JSON.parse(gunzipSync(read(`site/fonts/${charset}/${size}-400.json.gz`)));
const forbidden=new Set(['win32.mjs','jit-machine.mjs','rebuild-machine.mjs','scheduler.mjs','library.mjs','native-cpp.mjs']);
for(const name of release.runtime){assert(!forbidden.has(name.split('/').at(-1)));assert(existsSync(root+'site/'+name),name);}
assert.match(read('site/index.html').toString(),/name="th10-engine" content="native"/);
assert(statSync(root+'tools/Node.LICENSE').size>1000);
assert.equal(replayValidation.schemaVersion,1);assert.equal(replayValidation.records.length,7);
for(const record of replayValidation.records){assert.equal(record.deathCount,0);assert(Number.isSafeInteger(record.finalScore)&&record.finalScore>0);}
console.log(JSON.stringify({verified:true,sourceFiles:report.sourceFiles.length,runtimeModules:release.runtime.length,musicBlocks:blocks.length,replayRecords:replayValidation.records.length,moduleSha256:report.sha256},null,2));
