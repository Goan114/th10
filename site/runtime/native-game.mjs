import {createNativePlatform} from './native-platform.mjs';
import {writeInputSnapshot} from './native-input-state.mjs';
import {WebGLD3D9} from './webgl.mjs';
import {connectAudio} from './audio-bridge.mjs';
import {RelativeDrag} from './touch-driver.mjs';

const words=v=>new Uint8Array(new Uint32Array(v).buffer);
// The C++ application owns screen transitions, gameplay and the frame loop.
// JavaScript translates browser input and platform services only.
export async function createNativeGame(module,{files,language='jp',fontBackend,onWrite,canvas,audioPort,onContext=()=>{},now,monotonic}={}){
 const native=await createNativePlatform(module,{files,fontBackend,onWrite,now,monotonic}),c=native.exports,m=native.graphics.m;
 const params=native.graphics.alloc(56),name=native.graphics.alloc(256),rng=native.graphics.alloc(16),rate=native.graphics.alloc(4),quit=native.graphics.alloc(4),touchState=native.graphics.alloc(32),fileSystem=c.files_create();
 const archive=language==='chs'?'th10c.dat':'th10.dat';native.graphics.putText(name,archive);if(!c.files_attach(fileSystem,name))throw new Error('Cannot open the game archive.');
 const seed=(Date.now()>>>0)&65535;m.write(rng,words([seed,0,seed,0]));m.f32(rate,1);m.write(params,words([640,480,22,1,0,0,1,0,1,1,80,0,0,0]));
 const input=c.input_create(),state=c.game_state_create(input,language==='chs'),device=c.graphics_create(params,0x40),engine=c.animation_engine_create(fileSystem,device,rng,rng+8,rate),fonts=c.fonts_create(device,rng,language==='chs'),audio=c.audio_create(fileSystem),effects=c.effects_create(engine,quit,0);
 const renderer=canvas?new WebGLD3D9(canvas,native.graphics.d3d):null,bridge=audioPort?connectAudio(native.audio,audioPort):null;renderer?.warmPrograms();
 const app=c.application_create(fileSystem,input,state,engine,fonts,audio,effects);if(!app)throw new Error('C++ game initialization failed.');
 const snapshot=c.input_snapshot(input),economy=c.game_state_economy(state),drag=new RelativeDrag();let context='menu',touchEnabled=false,autoFire=true,closed=false;
 const currentTouch=()=>{c.application_touch_state(app,touchState);return {context:['menu','gameplay','dialogue','replay'][m.u32(touchState)],player:m.u32(touchState+4),ready:!!m.u32(touchState+8),x:m.f32(touchState+12),y:m.f32(touchState+16),fast:m.f32(touchState+20),slow:m.f32(touchState+24)};};
 const game={native,c,app,renderer,get frames(){return native.graphics.d3d.frames;},
  configureTouch(options){touchEnabled=!!options.enabled;autoFire=!!options.fire;if(!touchEnabled)drag.clear();},cancelTouch(){drag.clear();},
  drag(data,keys){const touch=currentTouch();if(!touchEnabled||touch.context!=='gameplay'||!touch.ready||data.action==='up'||data.action==='cancel'){drag.clear();return;}if(data.action==='down')drag.start(touch.player,touch.x,touch.y);if(data.action==='move'){const focused=keys.has('ShiftLeft')||keys.has('ShiftRight');drag.move(Math.max(-640,Math.min(640,Number(data.dx)||0)),Math.max(-480,Math.min(480,Number(data.dy)||0)),focused&&touch.fast?touch.slow/touch.fast:1);}},
  step({keys=new Set(),pads=[],focused=true,milliseconds=0}={}){
   const touch=currentTouch();if(touch.context!==context){context=touch.context;drag.clear();onContext(context);}const active=new Set(keys);
   if(touchEnabled&&context==='gameplay'&&touch.ready){if(autoFire)active.add('KeyZ');const slow=active.has('ShiftLeft')||active.has('ShiftRight');for(const key of drag.keys(touch.player,touch.x,touch.y,slow?touch.slow:touch.fast))active.add(key);}
   writeInputSnapshot(c.memory,snapshot,{keys:active,pads,focused});if(milliseconds>0)c.audio_advance(audio,milliseconds);
   const result=c.application_step(app),error=c.application_error(app);if(error)throw new Error('C++ game failed: '+error);bridge?.sync();return result;
  },
  screen(){return {stage:m.i32(economy+0x3c),character:m.i32(economy+0x28),shot:m.i32(economy+0x2c),difficulty:m.i32(economy+0x34),lives:m.i32(economy+0x30),power:m.i32(economy+8),flags:m.u32(economy+0x60)};},
  delay(){return c.application_delay(app);},save(){c.application_save(app);},stop(){c.application_stop(app);},
  close(){if(closed)return;closed=true;c.application_destroy(app);c.effects_destroy(effects);c.audio_destroy(audio);c.fonts_destroy(fonts);c.animation_engine_destroy(engine);c.graphics_destroy(device);c.game_state_destroy(state);c.input_destroy(input);c.files_destroy(fileSystem);for(const pointer of [...native.graphics.allocations.keys()])native.graphics.free(pointer);}
 };return game;
}
