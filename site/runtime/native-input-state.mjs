import {scanKeyboard,virtualKeyboard} from './keyboard-state.mjs';
// Serialize input into the C++ platform's snapshot, without DirectInput objects
// or calls into an executable. Touch controls supply keys through InputSources.
export function writeInputSnapshot(memory,pointer,{keys=new Set(),pads=[],focused=true}={}){
 const bytes=new Uint8Array(memory.buffer,pointer,1172),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);bytes.fill(0);
 bytes.set(virtualKeyboard(keys),0);bytes.set(scanKeyboard(keys),256);view.setInt32(1168,focused?1:0,true);
 for(let device=0;device<2;device++){
  const pad=pads[device];if(!pad)continue;view.setUint32(1160+device*4,1,true);const direct=512+device*272,legacy=1056+device*52,buttons=pad.buttons??[],axes=pad.axes??[];
  const x=(buttons[15]?1:0)-(buttons[14]?1:0),y=(buttons[13]?1:0)-(buttons[12]?1:0),pov=x||y?((Math.round(Math.atan2(x,-y)*180/Math.PI)+360)%360)*100:0xffffffff;
  for(let i=0;i<2;i++)view.setInt32(direct+i*4,Math.round(-1000+(Math.max(-1,Math.min(1,axes[i]??0))+1)/2*2000),true);
  for(let i=0;i<4;i++)view.setUint32(direct+32+i*4,i?0xffffffff:pov,true);
  for(let i=0;i<Math.min(128,buttons.length);i++)bytes[direct+48+i]=buttons[i]?128:0;
  view.setUint32(legacy,52,true);view.setUint32(legacy+4,255,true);for(let i=0;i<6;i++)view.setUint32(legacy+8+i*4,Math.round(((axes[i]??0)+1)*32767.5),true);
  let pressed=0;for(let i=0;i<Math.min(32,buttons.length);i++)if(buttons[i])pressed|=1<<i;
  view.setUint32(legacy+32,pressed,true);view.setUint32(legacy+36,pressed?32-Math.clz32(pressed&-pressed):0,true);view.setUint32(legacy+40,pov,true);
 }
}
