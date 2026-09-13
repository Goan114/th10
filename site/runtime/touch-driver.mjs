// Relative dragging feeds the original keyboard sampler, so the original
// fixed-point movement, speed limits and native .rpy recording stay in charge.
import {directionKeys} from './touch-controls.mjs';
import {scanCodes} from './input.mjs';
export function gameTouchContext(m){
  const player=m.u32(0x477834),gui=m.u32(0x47770c),stage=m.u32(0x477810);
  if(m.u32(0x491c00)===2||(m.u32(0x474ca0)&0x20))return 'replay';
  if(!player||!stage||m.i32(0x474c70)<0||(m.u32(stage+0x58)&0x70))return 'menu';
  const update=m.u32(stage+8);
  if(!update||!(m.u32(update+4)&2))return 'menu';
  if(gui&&m.u32(gui+0x9eb8))return 'dialogue';
  return 'gameplay';
}
export class RelativeDrag {
  constructor(){this.clear();}
  clear(){this.active=false;this.player=0;this.x=0;this.y=0;}
  start(player,x,y){this.active=true;this.player=player;this.x=x;this.y=y;}
  move(dx,dy,ratio=1){if(this.active){this.x=Math.max(-184,Math.min(184,this.x+dx*ratio));this.y=Math.max(32,Math.min(432,this.y+dy*ratio));}}
  keys(player,x,y,speed){
    if(!this.active||player!==this.player||!Number.isFinite(x+y+speed)||speed<=0)return [];
    // The nearest reachable original step prevents oscillation around a finger
    // target. Releasing the finger drops the target instead of coasting.
    let dx=this.x-x,dy=this.y-y;const half=speed*.5;
    if(Math.abs(dx)<half)dx=0;if(Math.abs(dy)<half)dy=0;
    return directionKeys(dx,dy,.001);
  }
}
export function installTouchDriver(host,onContext=()=>{}){
  const m=host.m,drag=new RelativeDrag();let enabled=false,fire=true,context='menu';
  const driver={drag,get context(){return context;},cancel(){drag.clear();},configure(options){enabled=!!options.enabled;fire=!!options.fire;if(!enabled)drag.clear();},
    event(data){
      if(!enabled)return;const current=gameTouchContext(m),p=m.u32(0x477834);
      if(data.action==='up'||data.action==='cancel'){drag.clear();return;}
      if(current!=='gameplay'||!p||m.u32(p+0x458)!==1){drag.clear();return;}
      if(data.action==='down')drag.start(p,m.f32(p+0x3c0),m.f32(p+0x3c4));
      if(data.action==='move'){
        const slow=host.input.keys.has('ShiftLeft')||host.input.keys.has('ShiftRight'),normal=m.i32(p+0x3d4),ratio=slow&&normal?m.i32(p+0x3d8)/normal:1;
        drag.move(Math.max(-640,Math.min(640,Number(data.dx)||0)),Math.max(-480,Math.min(480,Number(data.dy)||0)),ratio);
      }
    },
    sample(bytes){
      const next=gameTouchContext(m);if(next!==context){context=next;drag.clear();onContext(context);}
      if(!enabled||context!=='gameplay')return bytes;
      const p=m.u32(0x477834);if(!p||m.u32(p+0x458)!==1){drag.clear();return bytes;}
      if(fire)bytes[scanCodes.KeyZ]=128;
      const slow=bytes[scanCodes.ShiftLeft]||bytes[scanCodes.ShiftRight],speed=m.i32(p+(slow?0x3d8:0x3d4))*.01*m.f32(0x476f78);
      for(const key of drag.keys(p,m.f32(p+0x3c0),m.f32(p+0x3c4),speed))bytes[scanCodes[key]]=128;
      return bytes;
    }};
  const read=host.input.state.bind(host.input);host.input.state=()=>driver.sample(read());host.touch=driver;return driver;
}
