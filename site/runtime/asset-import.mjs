import {openAssetStorage,supportedAssetNames} from './asset-store.mjs';

const siteUrl=new URL('../',import.meta.url),resourceUrl=path=>new URL(path,siteUrl);
const hex=buffer=>Array.from(new Uint8Array(buffer),value=>value.toString(16).padStart(2,'0')).join('');
const remoteAvailable=async path=>{try{return (await fetch(resourceUrl(path),{method:'HEAD',cache:'no-store'})).ok;}catch{return false;}};

export async function installAssetImport({language,onChange=()=>{},onError=console.error}={}){
  const root=document.querySelector('#asset-setup'),input=document.querySelector('#asset-import'),clear=document.querySelector('#asset-clear'),status=document.querySelector('#asset-status');
  const manifest=await fetch(resourceUrl('manifest.json'),{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('无法读取游戏资源清单');return response.json();});
  const store=await openAssetStorage(),archive=language==='chs'?'th10c.dat':'th10.dat';let state={archive:null,music:'silent'},locked=false;
  async function refresh(){
    const [localArchive,localMusic,keys]=await Promise.all([store.get(archive),store.get('thbgm.dat'),store.keys()]);
    const [remoteArchive,remoteMusic]=await Promise.all([localArchive?false:remoteAvailable('data/'+archive),localMusic?false:remoteAvailable('data/thbgm/0000.bin')]);
    state={archive:localArchive?'local':remoteArchive?'remote':null,music:localMusic?'local':remoteMusic?'remote':'silent'};
    if(!state.archive)status.textContent=`请选择合法持有的 ${archive}；thbgm.dat 可选，不导入时静音运行。`;
    else if(state.music==='silent')status.textContent=`${archive} 已就绪；未提供 thbgm.dat，将静音运行。`;
    else status.textContent=`${archive} 与音乐均已就绪。`;
    clear.hidden=keys.length===0;root.open=!state.archive;onChange({...state});return state;
  }
  input.onchange=async event=>{
    const files=Array.from(event.target.files??[]);if(!files.length)return;input.disabled=true;clear.disabled=true;
    try{
      const entries=[];
      for(const file of files){
        const name=file.name.toLowerCase();if(!supportedAssetNames.has(name))throw new Error(`不支持的游戏数据文件：${file.name}`);
        status.textContent=`正在校验 ${file.name}…`;
        if(name==='thbgm.dat'){
          if(file.size!==manifest.music.size)throw new Error(`thbgm.dat 长度不正确：应为 ${manifest.music.size.toLocaleString()} 字节`);
        }else{
          const expected=manifest.variants[name==='th10c.dat'?'chs':'jp'].hashes[name];
          const actual=hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
          if(actual!==expected)throw new Error(`${file.name} 不是本项目支持的 1.00a 数据文件`);
        }
        entries.push([name,file]);
      }
      await navigator.storage?.persist?.();status.textContent='正在保存到当前浏览器…';await store.putMany(entries);input.value='';await refresh();
    }catch(error){const message=error?.name==='QuotaExceededError'?'浏览器空间不足，无法保存所选游戏数据。可以只导入 DAT 并静音运行。':error.message??String(error);status.textContent=message;onError(error);}
    finally{input.disabled=locked;clear.disabled=locked;}
  };
  clear.onclick=async()=>{
    if(locked||!confirm('清除当前浏览器中导入的游戏数据？存档和录像不会被删除。'))return;input.disabled=clear.disabled=true;
    try{await store.clear();input.value='';await refresh();}catch(error){status.textContent=error.message??String(error);onError(error);}finally{input.disabled=locked;clear.disabled=locked;}
  };
  await refresh();
  return {get state(){return {...state};},setLocked(value){locked=!!value;input.disabled=locked;clear.disabled=locked;}};
}
