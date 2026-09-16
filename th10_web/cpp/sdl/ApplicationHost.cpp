#include "../platform/Application.hpp"
#include <SDL3/SDL.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <cmath>
#include "FrameCadence.hpp"
#include "PresentationCadence.hpp"
#include "Renderer.hpp"
#include <algorithm>

extern "C" void sdl_audio_pump();
extern "C" void sdl_audio_pause(th10::u32);
extern "C" void sdl_native_input(th10::browser::Application*);
EM_JS(int, browser_prepare_frame, (), { return Module['runtimePrepare'] ? Module['runtimePrepare']() : 0; });
EM_JS(void, browser_finish_frame, (int result,double milliseconds), { Module['runtimeFinish'](result,milliseconds); });
EM_JS(void, browser_loop_stopped, (), { if(Module['runtimeStopped'])Module['runtimeStopped'](); });
namespace {
th10::browser::Application* application=nullptr;
unsigned loop_epoch=0;bool running=false,suspended=false,presentation_primed=false;double elapsed=0,last=-1,audio_remainder=0,callback_begin=0;touhou::sdl::FrameCadence cadence;touhou::sdl::PresentationCadence presentation;
bool interpolation_ready(){if(!application||application->stopped||!application->initialized||application->world&&application->world->loading)return false;const th10::i32 screen=application->value.screen;return screen==1||screen==4||screen==7||screen==14;}
EM_BOOL frame(double timestamp,void* epoch){
    if(!running||uintptr_t(epoch)!=loop_epoch)return EM_FALSE;
    const double now=timestamp/1000.,delta=last<0?0:std::max(0.,now-last);last=now;callback_begin=emscripten_get_now();
    // Browser responsibilities end at resource readiness and input snapshots.
    // The C++ ApplicationLoop owns deadlines, logic, draw and the original
    // original 60Hz cadence, independent of display callback frequency.
    const int ready=browser_prepare_frame();if(!running)return EM_FALSE;
    if(ready<=0||suspended){sdl_audio_pause(1);cadence.reset();presentation.reset();presentation_primed=false;return EM_TRUE;}
    sdl_audio_pause(0);elapsed+=delta;audio_remainder+=delta*1000;
    const auto milliseconds=th10::u32(std::floor(audio_remainder));audio_remainder-=milliseconds;
    application->audio.advance(milliseconds);
    if(application->world&&application->world->loading){
        // Share the exact object creation sequence with the synchronous test
        // entry point, but yield between owners on the browser thread. Keep
        // gameplay/RNG/recording frozen until the original loading barrier.
        const double deadline=emscripten_get_now()+2.;
        do{application->world->advance_loading_step();}while(application->world->loading&&emscripten_get_now()<deadline);
        application->sync_views();
        if(application->world->loading){application->engine.device.present_frame();sdl_audio_pump();browser_finish_frame(0,emscripten_get_now()-callback_begin);cadence.reset();presentation.reset();presentation_primed=false;return EM_TRUE;}
    }
    // Some Emscripten SDL builds fall back to millisecond gettimeofday for
    // performance counters. Use the display's timestamp for cadence, avoiding
    // a late/early callback's CPU work moving the next deadline across a VSync.
    const bool presentation_ready=interpolation_ready(),fast=touhou::sdl::PresentationCadence::fast_sample(delta);if(presentation_ready)presentation.advance(delta);else presentation.reset();if(!presentation.high_refresh||!fast)presentation_primed=false;
    const auto ticks=cadence.advance(delta);int result=0;sdl_defer(1);
    for(unsigned i=0;i<ticks&&!result;++i){sdl_native_input(application);result=application->step(true);}
    const bool high=presentation.high_refresh&&interpolation_ready();if(high&&fast&&!presentation_primed&&ticks)presentation_primed=true;const bool interpolate=high&&fast&&presentation_primed;
    sdl_defer(0);bool presented=false;
    if(!result&&high){const bool frozen=application->world&&application->world->actors.session&&(application->world->actors.session->session_flags&0x74);const float alpha=interpolate?float(cadence.interpolation_alpha()):1.0f;presented=application->presentation_draw(alpha,interpolate,!frozen);}else presented=sdl_commit()!=0;
    if(presented&&application)application->presentation_frame();
    sdl_audio_pump();browser_finish_frame(result,emscripten_get_now()-callback_begin);
    return running?EM_TRUE:EM_FALSE;
}
}
extern "C" {
__attribute__((export_name("sdl_loop_time"))) double sdl_loop_time(){return elapsed+(running&&!suspended?std::max(0.,emscripten_get_now()-callback_begin)/1000.:0.);}
// A deterministic, stopped-loop entry point for replay/regression runners.
// It shares native input, audio progression and the same Application tick.
__attribute__((export_name("sdl_loop_tick"))) int sdl_loop_tick(th10::browser::Application* app,double seconds,th10::u32 milliseconds){
    if(running)return -1;elapsed+=seconds;app->audio.advance(milliseconds);sdl_native_input(app);return app->step(true);
}
__attribute__((export_name("sdl_loop_pause"))) void sdl_loop_pause(th10::u32 pause){suspended=pause!=0;last=-1;cadence.reset();presentation.reset();presentation_primed=false;sdl_audio_pause(pause);}
__attribute__((export_name("sdl_loop_start"))) void sdl_loop_start(th10::browser::Application* app){
    application=app;elapsed=audio_remainder=0;cadence.reset();presentation.reset();presentation_primed=false;last=-1;callback_begin=emscripten_get_now();running=true;
    emscripten_request_animation_frame_loop(frame,reinterpret_cast<void*>(uintptr_t(++loop_epoch)));
}
__attribute__((export_name("sdl_loop_stop"))) void sdl_loop_stop(){
    if(!running)return;running=false;++loop_epoch;sdl_audio_pause(1);browser_loop_stopped();application=nullptr;
}
}
