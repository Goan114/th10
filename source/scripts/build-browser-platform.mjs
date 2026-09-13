import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const fixture=process.argv.includes('--hud-fixture'),nameIndex=process.argv.indexOf('--name'),stem=nameIndex>=0?process.argv[nameIndex+1]:fixture?'browser-hud-fixture':'browser-platform';
if(!/^[a-z0-9-]+$/.test(stem??''))throw new Error('Use a simple artifact name');
const root=fileURLToPath(new URL('../',import.meta.url)),output='artifacts/decomp/'+stem+'.wasm';mkdirSync(new URL('../artifacts/decomp/',import.meta.url),{recursive:true});
const sdk=process.env.TH10_WASI_SDK??root+'tools/wasi-sdk-34.0-x86_64-windows';
const common=['--target=wasm32-wasip1','-O2','-g0','-fno-strict-aliasing','-ffp-contract=off'];
function run(exe,args){if(process.platform!=='win32')exe=exe.replace(/\.exe$/,'');const r=spawnSync(sdk+'/bin/'+exe,args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.error)throw r.error;if(r.status)throw new Error(r.stdout+r.stderr);}
run('clang.exe',[...common,'-std=c11','-DSOFTFLOAT_FAST_INT64','-DINLINE_LEVEL=5','-c','cpp/rebuild/third_party/softfloat.c','-o','artifacts/decomp/'+stem+'-softfloat.o']);
// Compile the recovered game classes, with no executable-memory bridge or
// development CPU/test exports. The browser has its own runtime trap handler.
const excluded=new Set(['LegacyBridge.cpp','LegacyCallbacks.cpp','Exports.cpp','Freestanding.cpp']);
const gameSources=readdirSync(root+'cpp/game').filter(n=>n.endsWith('.cpp')&&!excluded.has(n)).sort().map(n=>'cpp/game/'+n);
const sources=[...readdirSync(root+'cpp/platform').filter(n=>n.endsWith('.cpp')).sort().map(n=>'cpp/platform/'+n),...gameSources,...(fixture?['cpp/testing/HudFixture.cpp']:[])];
run('clang++.exe',[...common,'-std=c++17','-fno-exceptions','-fno-rtti','-nostartfiles','-Wl,--no-entry','-Wl,-z,stack-size=1048576','-Wl,--export-memory','-Wl,--strip-all','-Wl,--why-extract=artifacts/decomp/'+stem+'-link.txt',...sources,'artifacts/decomp/'+stem+'-softfloat.o','-o',output]);
const bytes=readFileSync(new URL('../'+output,import.meta.url)),module=new WebAssembly.Module(bytes),imports=WebAssembly.Module.imports(module);if(imports.some(i=>!['th10_files','th10_graphics','th10_fonts','th10_audio','th10_time'].includes(i.module)))throw new Error('Unexpected dependency in native browser platform');
const sourceFiles=[...sources,...['cpp/game','cpp/platform'].flatMap(dir=>readdirSync(root+dir).filter(n=>n.endsWith('.hpp')).map(n=>dir+'/'+n)),'cpp/rebuild/third_party/softfloat.c'].sort();
const digest=createHash('sha256');for(const name of sourceFiles)digest.update(name+'\0').update(readFileSync(root+name));
const report={kind:fixture?'independent-browser-hud-fixture':'independent-browser-game',sources,sourceFiles,sourceSha256:digest.digest('hex'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),imports};writeFileSync(new URL('../artifacts/decomp/'+stem+'-build.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
