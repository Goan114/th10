import {NativeMemory} from './native-memory.mjs';
import {decode932,decode936} from './encoding.mjs';
export class NativeFonts {
  constructor(backend){this.backend=backend;this.m=new NativeMemory();this.objects=new Map();this.nextHandle=1;}
  bind(exports){this.exports=exports;this.m.bind(exports.memory);return this;}
  add(object){object.handle=this.nextHandle++;this.objects.set(object.handle,object);return object.handle;}
  get(handle,type){const object=this.objects.get(handle);if(!object||type&&object.type!==type)throw new Error('Invalid native font '+(type??'object')+' handle '+handle);return object;}
  text(pointer){let length=0;while(length<1024&&this.m.view(pointer+length,1)[0])length++;return new TextDecoder().decode(this.m.view(pointer,length));}
  imports(){return {
    bitmap:(description,out)=>{const m=this.m,width=m.i32(description+4),height=Math.abs(m.i32(description+8)),bpp=m.refresh().getUint16(description+14,true),pitch=((width*bpp+31)>>>5)*4,size=pitch*height;if(width<=0||height<=0||!Number.isSafeInteger(size)||size>64*1024*1024)return 0;const data=this.exports.graphics_allocate(size+pitch*4);if(!data)return 0;m.u32(out,data);return this.add({type:'bitmap',width,height,bpp,pitch,size,data});},
    context:()=>this.add({type:'context',mode:2,color:0}),
    select:(context,handle)=>{const dc=this.get(context,'context'),object=this.objects.get(handle);if(!object)return 0;const property=object.type==='font'?'font':'bitmap',old=dc[property];dc[property]=object;return old?.handle??0;},
    delete_context:handle=>{this.get(handle,'context');this.objects.delete(handle);},
    delete_object:handle=>{const object=this.get(handle);if(object.data)this.exports.graphics_free(object.data);this.objects.delete(handle);},
    font:(height,face,charset)=>{const value={type:'font',font:[height|0,0,0,0,400,0,0,0,charset,0,0,4,17],face:this.text(face)};this.backend?.font?.(value);return this.add(value);},
    background:(context,mode)=>{const dc=this.get(context,'context'),previous=dc.mode;dc.mode=mode;return previous;},
    color:(context,color)=>{const dc=this.get(context,'context'),previous=dc.color;dc.color=color;return previous;},
    text:(context,x,y,pointer,length)=>{const dc=this.get(context,'context'),bitmap=dc.bitmap;if(!this.backend||!bitmap||!dc.font)throw new Error('Native fonts are not initialized');const text=(dc.font.font[8]===134?decode936:decode932)(this.m.bytes(pointer,length));return this.backend.draw(dc,bitmap,x|0,y|0,text,this.m.view(bitmap.data,bitmap.size))??1;},
  };}
}
