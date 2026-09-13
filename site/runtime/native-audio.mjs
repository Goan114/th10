import {NativeMemory} from './native-memory.mjs';
import {NativeObjects} from './native-objects.mjs';
import {DirectSound8} from './dsound.mjs';
// Keep aligned with cpp/platform/Audio.hpp. These are sound API operations.
const operations=[['AddRef',0],['Release',0],['CreateSoundBuffer',3],['DuplicateSoundBuffer',2],['SetCooperativeLevel',2],['SetFormat',1],['GetStatus',1],['Restore',0],['SetVolume',1],['SetPan',1],['Play',3],['Stop',0],['SetCurrentPosition',1],['GetCurrentPosition',2],['Lock',7],['Unlock',4],['QueryInterface',2],['SetNotificationPositions',2],['SetFrequency',1],['GetVolume',1],['GetPan',1],['GetFrequency',1],['GetFormat',3],['GetCaps',1]];
export class NativeAudio {
  constructor(){this.m=new NativeMemory();this.objects=new NativeObjects('audio');this.sound=new DirectSound8(this,{objects:this.objects});this.handles=new Map();this.nextEvent=1;this.millis=1000;this.allocations=new Map();}
  bind(exports){this.exports=exports;this.m.bind(exports.memory);return this;}
  alloc(length){const pointer=this.exports.graphics_allocate(length);if(!pointer)throw new Error('Audio allocation failed');this.allocations.set(pointer,length);return pointer;}
  free(pointer){this.allocations.delete(pointer);this.exports.graphics_free(pointer);}
  imports(){return {
    create:()=>this.sound.create(),
    call:(handle,operation,pointer)=>{const [name,count]=operations[operation]??[];if(!name)throw new Error('Unknown audio operation '+operation);if(name==='AddRef')return this.objects.addRef(handle);if(name==='Release')return this.objects.release(handle);const object=this.objects.get(handle),method=object.handlers[name];if(!method)throw new Error('Unsupported native audio operation '+object.kind+'.'+name);return method.call(object,this.m.readWords(pointer,count))??0;},
    event:(operation,handle)=>{if(operation===0){const id=this.nextEvent++;this.handles.set(id,{signaled:false});return id;}if(operation===1){const event=this.handles.get(handle);if(!event)return 0xffffffff;const signaled=event.signaled;event.signaled=false;return signaled?0:0x102;}if(operation===2){this.handles.delete(handle);return 0;}throw new Error('Unknown audio event operation '+operation);},
    advance:milliseconds=>{this.millis+=milliseconds>>>0;this.sound.advance();},
  };}
}
