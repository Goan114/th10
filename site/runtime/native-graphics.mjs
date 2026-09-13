import {NativeMemory} from './native-memory.mjs';
import {Direct3D9} from './d3d9.mjs';
import {NativeObjects} from './native-objects.mjs';

// Opaque graphics handles; they are never native function pointers or vtables.
export class GraphicsObjects extends NativeObjects {constructor(){super('graphics');}}
// These operation numbers describe a graphics API, not original code addresses.
// Keep aligned with cpp/platform/Graphics.hpp.
const deviceOperations=[['SetTextureStageState',3],['SetSamplerState',3],['SetRenderState',2],['SetTexture',2],['SetFVF',1],['DrawPrimitiveUP',4],['SetTransform',2],['SetStreamSource',4],['DrawPrimitive',3],['SetViewport',1],['Clear',6],['BeginScene',0],['EndScene',0],['Present',4],['GetBackBuffer',4],['GetRenderTarget',2],['SetRenderTarget',2],['GetDepthStencilSurface',1],['SetDepthStencilSurface',1],['CreateTexture',8],['CreateOffscreenPlainSurface',6],['CreateRenderTarget',8],['CreateVertexBuffer',6],['CreateIndexBuffer',6],['SetIndices',1],['DrawIndexedPrimitive',6],['DrawIndexedPrimitiveUP',8],['StretchRect',5],['UpdateSurface',4],['Reset',1],['GetDeviceCaps',1],['TestCooperativeLevel',0],['GetDisplayMode',2],['SetPixelShader',1]];
const resourceOperations=[['AddRef',0],['Release',0],['GetDesc',1],['GetSurfaceLevel',2],['LockRect',3],['UnlockRect',0],['Lock',4],['Unlock',0],['SetPriority',1],['PreLoad',0]];
export class NativeGraphics {
  constructor(){this.m=new NativeMemory();this.objects=new GraphicsObjects();this.d3d=new Direct3D9(this,{objects:this.objects});this.millis=1000;this.yielded=false;this.allocations=new Map();}
  bind(exports){this.exports=exports;this.m.bind(exports.memory);return this;}
  alloc(length){const p=this.exports.graphics_allocate(length);if(!p)throw new Error('Graphics allocation failed');this.allocations.set(p,length);return p;}
  free(pointer){this.allocations.delete(pointer);this.exports.graphics_free(pointer);}
  putText(pointer,text){const bytes=new TextEncoder().encode(text+'\0');this.m.write(pointer,bytes);return bytes.length-1;}
  configureGraphics(flags){this.exports.graphics_configure_arithmetic(flags);}
  presentFrame(){this.onFrame?.();}
  imports(){return {
    create:(params,flags)=>{this.configureGraphics(flags);return this.d3d.createDevice(params).address;},
    device:(handle,operation,pointer)=>{const [name,count]=deviceOperations[operation]??[];if(!name)throw new Error('Unknown graphics device operation '+operation);const device=this.objects.get(handle);if(device.kind!=='IDirect3DDevice9')throw new Error('Expected graphics device');this.d3d.device=device;return device.handlers[name](this.m.readWords(pointer,count))??0;},
    resource:(handle,operation,pointer)=>{const [name,count]=resourceOperations[operation]??[];if(!name)throw new Error('Unknown graphics resource operation '+operation);if(name==='AddRef')return this.objects.addRef(handle);if(name==='Release')return this.objects.release(handle);const object=this.objects.get(handle),method=object.handlers[name];if(!method)throw new Error('Unsupported native graphics resource operation '+object.kind+'.'+name);return method.call(object,this.m.readWords(pointer,count))??0;},
  };}
}
