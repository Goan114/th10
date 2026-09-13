// File handles for the independent C++ platform. Data comes from this player's
// supplied buffers and overlay; this module cannot open operating-system files.
export class NativeFileStore {
 constructor(files=new Map(),{onWrite}={}){this.files=new Map();for(const [name,bytes] of files)this.files.set(this.normalize(name),bytes);this.overlay=new Map();this.handles=new Map();this.nextHandle=1;this.onWrite=onWrite;}
 normalize(name){const parts=[];for(const part of name.replaceAll('\\','/').split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part.replace(/[A-Z]/g,c=>c.toLowerCase()));}return parts.join('/');}
 bind(memory){this.memory=memory;return this;}
 bytes(pointer,length){return new Uint8Array(this.memory.buffer,pointer>>>0,length>>>0);}
 text(pointer){const bytes=new Uint8Array(this.memory.buffer);let end=pointer>>>0;while(end<bytes.length&&bytes[end])end++;if(end===bytes.length)throw new Error('Unterminated native filename');return new TextDecoder().decode(bytes.subarray(pointer>>>0,end));}
 open(name,writing){name=this.normalize(name);if(!name)return 0xffffffff;let bytes=this.overlay.get(name)??this.files.get(name);if(writing){bytes=new Uint8Array(0);this.overlay.set(name,bytes);}if(!bytes)return 0xffffffff;const id=this.nextHandle++;this.handles.set(id,{name,bytes,cursor:0,writing:!!writing});return id;}
 close(id){const file=this.handles.get(id);this.handles.delete(id);if(file?.writing)this.onWrite?.(file.name,this.overlay.get(file.name));}
 content(file){return this.overlay.get(file.name)??file.bytes;}
 size(id){const file=this.handles.get(id);return file?this.content(file).length:0xffffffff;}
 seek(id,offset,origin){const file=this.handles.get(id);if(!file||origin>2)return 0xffffffff;const position=(origin===1?file.cursor:origin===2?this.content(file).length:0)+(offset|0);if(position<0||position>0xffffffff)return 0xffffffff;file.cursor=position;return position;}
 read(id,pointer,length){const file=this.handles.get(id);if(!file)return 0;const source=this.content(file),count=Math.max(0,Math.min(length>>>0,source.length-file.cursor)),bytes=source.subarray(file.cursor,file.cursor+count);if(bytes===null)throw new Error('Native file window was not prepared: '+file.name+' at '+file.cursor+' for '+count+' bytes');this.bytes(pointer,count).set(bytes);file.cursor+=count;return count;}
 write(id,pointer,length){const file=this.handles.get(id);if(!file?.writing)return 0;const end=file.cursor+(length>>>0);if(end>0xffffffff)return 0;const source=this.content(file),bytes=new Uint8Array(Math.max(end,source.length));bytes.set(source);bytes.set(this.bytes(pointer,length),file.cursor);file.bytes=bytes;file.cursor=end;this.overlay.set(file.name,bytes);return length>>>0;}
 list(directory,pattern,index,pointer,capacity){
  const folder=this.normalize(directory);if(folder===null)return 0;const prefix=folder?folder+'/':'';
  const expression=new RegExp('^'+[...(pattern==='*.*'?'*':pattern)].map(c=>c==='*'?'.*':c==='?'?'.':c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$','i');
  const names=[...new Set([...this.files.keys(),...this.overlay.keys()])].filter(name=>name.startsWith(prefix)&&!name.slice(prefix.length).includes('/')&&expression.test(name.slice(prefix.length))&&(this.overlay.get(name)??this.files.get(name))).sort();
  const name=names[index];if(!name)return 0;const bytes=new TextEncoder().encode(name.slice(prefix.length));if(bytes.length+1>capacity)return 0;this.bytes(pointer,bytes.length).set(bytes);this.bytes(pointer+bytes.length,1)[0]=0;return 1;
 }
 imports(){return {th10_files:{open:(name,write)=>this.open(this.text(name),write),close:id=>this.close(id),size:id=>this.size(id),seek:(id,offset,origin)=>this.seek(id,offset,origin),read:(id,pointer,length)=>this.read(id,pointer,length),write:(id,pointer,length)=>this.write(id,pointer,length),list:(directory,pattern,index,pointer,capacity)=>this.list(this.text(directory),this.text(pattern),index,pointer,capacity)}};}
}
