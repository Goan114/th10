import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8').replaceAll('\r','');
const host=read('th10_web/cpp/sdl/ApplicationHost.cpp');
const app=read('th10_web/cpp/platform/Application.cpp');
const anim=read('th10_web/cpp/platform/AnimationEngine.cpp');
const worldPlayer=read('th10_web/cpp/platform/WorldPlayer.cpp');
const bullets=read('th10_web/cpp/game/BulletFrame.cpp');
const items=read('th10_web/cpp/game/ItemDraw.cpp');
const lasers=read('th10_web/cpp/game/LaserFrame.cpp');
const high=read('th10_web/cpp/game/HighRefresh.hpp');

// rAF may schedule extra presentation frames, but authoritative simulation is
// still Application::step(true) under the fixed 60 Hz cadence.
assert.match(host,/const auto ticks=cadence\.advance\(delta\)/);
assert.match(host,/for\(unsigned i=0;i<ticks&&!result;\+\+i\).*application->step\(true\)/s);
assert.match(host,/sdl_defer\(1\)/);
assert.match(host,/application->presentation_draw\(alpha,interpolate,!frozen\)/);
assert.match(host,/session_flags&0x74/);
assert.match(host,/screen==4\|\|screen==7/);

// Extra display frames replay only the draw chain. They must not enter
// engine.update_all(), FrameStatistics::draw(), or Presentation::submit().
const presentationDraw=app.slice(app.indexOf('bool Application::presentation_draw'),app.indexOf('void Application::presentation_frame'));
assert.match(presentationDraw,/high_refresh::begin\(alpha,interpolate,true,world_interpolate\)/);
assert.match(presentationDraw,/engine\.draw_all\(\)/);
assert.doesNotMatch(presentationDraw,/update_all\(|clock\.step|\.submit\(\)/);
assert.match(app,/if\(high_refresh::render_only\).*presentation_fps/s);
assert.match(app,/statistics->draw\(rates\)/);

// Generic ANM interpolation is deliberately position-only. Broad ANM
// scale/rotation/color/UV interpolation is forbidden.
assert.match(anim,/snapshot_presentation\(\)/);
assert.match(anim,/copy\.position=mix/);
assert.match(anim,/copy\.script_position=mix/);
assert.match(anim,/copy\.child_position=mix/);
for(const field of ['scale','rotation','color','uv'])assert.doesNotMatch(anim,new RegExp(`copy\\.${field}\\s*=.*high_refresh::lerp`));

// Embedded gameplay owners use copies/sidecars rather than writing
// presentation values back into authoritative ABI state.
assert.match(worldPlayer,/Player copy;Player\* draw=&player/);
assert.match(worldPlayer,/player_presentation\.state==player\.state/);
assert.match(bullets,/AnmVm copy;AnmVm\* vm=&source/);
assert.match(items,/AnmVm copy;AnmVm\* vm=&animation/);
assert.match(lasers,/AnmVm beam_copy,tip_copy/);
assert.match(high,/render_only/);
assert.match(high,/previous\+\(current-previous\)\*alpha/);
assert.match(high,/world_alpha/);
assert.match(high,/lerp_world/);

console.log('TH10 high-refresh contract PASS: fixed 60 Hz authority + draw-only owner/ANM presentation');
