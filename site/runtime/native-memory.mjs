// A view over a native Wasm component's linear memory. No registers, code
// addresses, PE loader, import trampolines, or instruction execution.
export class NativeMemory {
  bind(memory){this.memory=memory;this.refresh();return this;}
  refresh(){const buffer=this.memory.buffer;if(buffer!==this.buffer){this.buffer=buffer;this.data=new DataView(buffer);}return this.data;}
  view(address,length){return new Uint8Array(this.memory.buffer,address>>>0,length>>>0);}
  bytes(address,length){return this.view(address,length).slice();}
  write(address,bytes){this.view(address,bytes.length).set(bytes);}
  u32(address,value){const d=this.refresh();return value===undefined?d.getUint32(address>>>0,true):d.setUint32(address>>>0,value,true);}
  i32(address,value){const d=this.refresh();return value===undefined?d.getInt32(address>>>0,true):d.setInt32(address>>>0,value,true);}
  f32(address,value){const d=this.refresh();return value===undefined?d.getFloat32(address>>>0,true):d.setFloat32(address>>>0,value,true);}
  readWords(address,count){const d=this.refresh();return Array.from({length:count},(_,i)=>d.getUint32((address>>>0)+i*4,true));}
}
