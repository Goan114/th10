// Native Wasm calls cannot suspend halfway through a file read. Prepare the
// active stream's next fill before entering a frame; track starts and loop
// starts are pinned by PagedMusic.prepare for seeks inside that frame.
export async function prepareNativeMusic(music,store){
 if(music.prepareActive){await music.prepareActive(store);return;}
 const required=new Set();for(const file of store.handles.values())if(file.name==='thbgm.dat'){
  const end=Math.min(file.cursor+1048576,music.length);for(let i=Math.floor(file.cursor/music.blockSize);i<Math.ceil(end/music.blockSize);i++)required.add(i);
 }
 music.required=required;const missing=[...required].filter(i=>!music.blocks.has(i));if(missing.length)await Promise.all(missing.map(i=>music.load(i)));
}
