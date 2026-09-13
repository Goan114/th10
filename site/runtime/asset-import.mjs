import {openAssetStorage,supportedAssetNames} from './asset-store.mjs';

const siteUrl=new URL('../',import.meta.url),resourceUrl=path=>new URL(path,siteUrl);
const hex=buffer=>Array.from(new Uint8Array(buffer),value=>value.toString(16).padStart(2,'0')).join('');
const remoteAvailable=async path=>{try{return (await fetch(resourceUrl(path),{method:'HEAD',cache:'no-store'})).ok;}catch{return false;}};

export async function installAssetImport({language,onChange=()=>{},onError=console.error}={}){
  const root=document.querySelector('#asset-setup'),input=document.querySelector('#asset-import'),clear=document.querySelector('#asset-clear'),status=document.querySelector('#asset-status');
  const manifest=await fetch(resourceUrl('manifest.json'),{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('Cannot read the game manifest.');return response.json();});
  const store=await openAssetStorage(),archive=language==='chs'?'th10c.dat':'th10.dat';let state={archive:null,music:'silent'},locked=false;
  async function refresh(){
    const [localArchive,localMusic,keys]=await Promise.all([store.get(archive),store.get('thbgm.dat'),store.keys()]);
    const [remoteArchive,remoteMusic]=await Promise.all([localArchive?false:remoteAvailable('data/'+archive),localMusic?false:remoteAvailable('data/thbgm/0000.bin')]);
    state={archive:localArchive?'local':remoteArchive?'remote':null,music:localMusic?'local':remoteMusic?'remote':'silent'};
    if(!state.archive)status.textContent=`Select your ${archive}. thbgm.dat is optional.`;
    else if(state.music==='silent')status.textContent=`${archive} ready. No BGM; the game will be silent.`;
    else status.textContent=`${archive} and BGM ready.`;
    clear.hidden=keys.length===0;root.open=!state.archive;onChange({...state});return state;
  }
  input.onchange=async event=>{
    const files=Array.from(event.target.files??[]);if(!files.length)return;input.disabled=true;clear.disabled=true;
    try{
      const entries=[];
      for(const file of files){
        const name=file.name.toLowerCase();if(!supportedAssetNames.has(name))throw new Error(`Unsupported game file: ${file.name}`);
        status.textContent=`Checking ${file.name}...`;
        if(name==='thbgm.dat'){
          if(file.size!==manifest.music.size)throw new Error(`Wrong thbgm.dat size. Expected ${manifest.music.size.toLocaleString()} bytes.`);
        }else{
          const expected=manifest.variants[name==='th10c.dat'?'chs':'jp'].hashes[name];
          const actual=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
          if(actual!==expected)throw new Error(`${file.name} is not a supported 1.00a data file.`);
        }
        entries.push([name,file]);
      }
      await navigator.storage?.persist?.();status.textContent='Saving in this browser...';await store.putMany(entries);input.value='';await refresh();
    }catch(error){const message=error?.name==='QuotaExceededError'?'Not enough browser storage. Import only the DAT to play without music.':error.message??String(error);status.textContent=message;onError(error);}
    finally{input.disabled=locked;clear.disabled=locked;}
  };
  clear.onclick=async()=>{
    if(locked||!confirm('Clear imported game files? Saves and replays will remain.'))return;input.disabled=clear.disabled=true;
    try{await store.clear();input.value='';await refresh();}catch(error){status.textContent=error.message??String(error);onError(error);}finally{input.disabled=locked;clear.disabled=locked;}
  };
  await refresh();
  return {get state(){return {...state};},setLocked(value){locked=!!value;input.disabled=locked;clear.disabled=locked;}};
}
