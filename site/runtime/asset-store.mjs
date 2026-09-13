const databaseName='th10-native-assets-1.00a',storeName='assets';

export const supportedAssetNames=new Set(['th10.dat','th10c.dat','thbgm.dat']);

export async function openAssetStorage(){
  if(!globalThis.indexedDB)throw new Error('当前浏览器不支持本地游戏数据存储');
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(databaseName,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('本地游戏数据存储正被其他页面占用'));
  });
  db.onversionchange=()=>db.close();
  const transaction=(mode,action)=>new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName);let result;
    try{const request=action(store);if(request)request.onsuccess=()=>result=request.result;}catch(error){tx.abort();reject(error);return;}
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('本地游戏数据写入已取消'));
  });
  return {
    get:name=>transaction('readonly',store=>store.get(name)),
    keys:()=>transaction('readonly',store=>store.getAllKeys()),
    putMany:entries=>transaction('readwrite',store=>{for(const [name,value] of entries)store.put(value,name);}),
    clear:()=>transaction('readwrite',store=>store.clear())
  };
}

export async function readAssetBytes(value,name='game data'){
  let buffer;
  if(value instanceof Blob)buffer=await value.arrayBuffer();
  else if(value instanceof ArrayBuffer)buffer=value;
  else if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  else throw new Error(`无法读取本地 ${name}`);
  return new Uint8Array(buffer);
}
