import {copyFile, readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, basename, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const pcmBytesPerFrame=4;

function argument(name, fallback){
  const inline=process.argv.find(value=>value.startsWith(name+'='));
  if(inline)return inline.slice(name.length+1);
  const index=process.argv.indexOf(name);
  return index>=0?process.argv[index+1]??fallback:fallback;
}

const original=resolve(argument('--original',''));
const output=resolve(argument('--output',resolve(root,'assets-ogg')));
const runtime=resolve(argument('--runtime',resolve(root,'site')));
const {readRetailMusicLayout}=await import(pathToFileURL(resolve(runtime,'runtime/retail-music-layout.mjs')).href);
if(!original||original===resolve('.'))throw new Error('Usage: node scripts/prepare-eagler-content.mjs --original=DIR --output=DIR');

const sourceArchive=join(original,'th10.dat');
const sourceMusic=join(original,'thbgm.dat');
const outputArchive=join(output,'th10.data');
const outputMusic=join(output,'bgm-ogg');
const provenancePath=join(output,'provenance.json');

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

function ffmpegVersion(){
  const result=spawnSync('ffmpeg',['-hide_banner','-version'],{encoding:'utf8',windowsHide:true});
  if(result.error)throw new Error(`ffmpeg is required on PATH: ${result.error.message}`);
  if(result.status!==0)throw new Error(`ffmpeg -version failed: ${result.stderr||result.stdout}`);
  return (result.stdout??'').split(/\r?\n/,1)[0].trim();
}

function encodeOgg(pcm,record){
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','s16le','-ar',String(record.sampleRate),'-ac',String(record.channels),'-i','pipe:0','-c:a','libvorbis','-q:a','5','-f','ogg','pipe:1'],{input:pcm,windowsHide:true,maxBuffer:64*1024*1024});
  if(result.error)throw new Error(`ffmpeg OGG encode failed for ${record.filename}: ${result.error.message}`);
  if(result.status!==0)throw new Error(`ffmpeg OGG encode failed for ${record.filename}: ${result.stderr||result.stdout}`);
  if(!result.stdout?.length)throw new Error(`ffmpeg emitted empty OGG for ${record.filename}`);
  return new Uint8Array(result.stdout);
}

async function readExistingProvenance(){
  try{return JSON.parse(await readFile(provenancePath,'utf8'));}catch{return null;}
}

const musicBytes=await readFile(sourceMusic);
const ffmpeg=ffmpegVersion();
const archiveBytes=await readFile(sourceArchive);
const wasm=await readFile(resolve(runtime,'vendor/th10-game.wasm'));
const layout=await readRetailMusicLayout(new WebAssembly.Module(wasm),archiveBytes);
const records=layout.map(record=>({
  filename:record.name.slice('bgm-ogg/'.length).replace(/\.ogg$/i,'.wav'),
  oggPath:record.name,
  offset:record.offset,
  loop:record.loop,
  length:record.length,
  channels:2,
  sampleRate:44100,
  bytesPerSecond:176400,
  alignment:4,
  bitsPerSample:16
}));
if(records.length!==18)throw new Error(`Expected 18 TH10 music records, found ${records.length}`);
if(records.some(record=>record.offset<16||record.length<=0||record.loop<0||record.loop>=record.length||record.offset+record.length>musicBytes.length||record.offset%pcmBytesPerFrame||record.loop%pcmBytesPerFrame||record.length%pcmBytesPerFrame))throw new Error('Invalid music range returned by retail Wasm layout');
const layoutIdentity=records.map(({filename,oggPath,offset,loop,length})=>({filename,oggPath,offset,loop,length}));
const sourceIdentity={
  archive:{name:basename(sourceArchive),bytes:archiveBytes.length,sha256:digest(archiveBytes)},
  music:{name:basename(sourceMusic),bytes:musicBytes.length,sha256:digest(musicBytes)},
  layout:{records:layoutIdentity,sha256:digest(Buffer.from(JSON.stringify(layoutIdentity)))},
  ffmpeg,
  encoder:{codec:'libvorbis',quality:5}
};
const previous=await readExistingProvenance();
const sameInput=previous&&JSON.stringify(previous.source)===JSON.stringify(sourceIdentity)&&Array.isArray(previous.tracks)&&previous.tracks.length===records.length;

await mkdir(outputMusic,{recursive:true});
if(!existsSync(outputArchive)||digest(await readFile(outputArchive))!==sourceIdentity.archive.sha256)await copyFile(sourceArchive,outputArchive);

const outputs=[];
for(const record of records){
  const target=join(output,record.oggPath),old=sameInput?previous.tracks.find(item=>item.filename===record.filename):null;
  let bytes=null,action='reused';
  if(old&&old.output&&existsSync(target)&&digest(await readFile(target))===old.output.sha256)bytes=await readFile(target);
  else{
    bytes=encodeOgg(musicBytes.subarray(record.offset,record.offset+record.length),record);action='encoded';
    const temporary=target+'.tmp-'+process.pid;await writeFile(temporary,bytes);await rename(temporary,target);
  }
  outputs.push({filename:record.filename,oggPath:record.oggPath,offset:record.offset,loop:record.loop,length:record.length,format:{channels:record.channels,sampleRate:record.sampleRate,bytesPerSecond:record.bytesPerSecond,alignment:record.alignment,bitsPerSample:record.bitsPerSample},output:{bytes:bytes.length,sha256:digest(bytes)},action});
}

const provenance={schema:'th10-eagler/ogg-content/1',source:sourceIdentity,tracks:outputs};
await writeFile(provenancePath,JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({output,archive:outputArchive,tracks:outputs.length,encoded:outputs.filter(item=>item.action==='encoded').length,reused:outputs.filter(item=>item.action==='reused').length,source:sourceIdentity,records:outputs.map(item=>({filename:item.filename,oggPath:item.oggPath,offset:item.offset,loop:item.loop,length:item.length}))},null,2));
