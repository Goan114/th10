import {createNativePlatform} from './native-platform.mjs';

// Read names and PCM offsets from the same retail archive that the game uses.
export async function readRetailMusicLayout(module,archive){
  const {exports:c}=await createNativePlatform(module,{files:new Map([['th10.dat',archive]])});
  const fs=c.files_create(),name=c.files_allocate(64),size=c.files_allocate(4);let data=0;
  const text=value=>new Uint8Array(c.memory.buffer,name,64).set(new TextEncoder().encode(value+'\0'));
  try{
    text('th10.dat');if(!c.files_attach(fs,name))throw new Error('Cannot attach retail archive');
    text('../../bgm/thbgm.fmt');data=c.files_load(fs,name,size,0);
    const length=new DataView(c.memory.buffer).getUint32(size,true);
    if(!data||length<52)throw new Error('Invalid retail music format '+data+' length '+length);
    const view=new DataView(c.memory.buffer,data,length),records=[];
    for(let at=0;at+52<=length;at+=52){
      const filename=new TextDecoder().decode(new Uint8Array(c.memory.buffer,data+at,16)).split('\0')[0];
      if(!filename)continue;
      if(!/^th10_\d{2}\.wav$/.test(filename)||view.getUint16(at+34,true)!==2||view.getUint32(at+36,true)!==44100||view.getUint16(at+46,true)!==16)throw new Error('Unsupported retail music format: '+filename);
      records.push({name:'bgm-ogg/'+filename.replace(/\.wav$/,'.ogg'),offset:view.getUint32(at+16,true),loop:view.getUint32(at+24,true),length:view.getUint32(at+28,true)});
    }
    if(!records.length)throw new Error('Empty retail music format');return records;
  }finally{if(data)c.files_free(data);c.files_free(name);c.files_free(size);c.files_destroy(fs);}
}



