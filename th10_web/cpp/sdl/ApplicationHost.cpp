#include "../platform/Application.hpp"
#include <SDL3/SDL.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <cmath>
#include "FrameCadence.hpp"
#include "PresentationCadence.hpp"
#include "Renderer.hpp"
#include "../game/PresentationAudit.hpp"
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
#ifdef TH_PRESENTATION_AUDIT
bool presentation_lab_fault=false;
struct PresentationLabTiming {double timestamp_ms;float delta_ms,alpha;th10::u32 flags,tick,draw_serial,reserved;};
PresentationLabTiming presentation_lab_timing[512]{};th10::u32 presentation_lab_timing_count=0,presentation_lab_timing_next=0;
void record_presentation_timing(double timestamp,double delta,float alpha,th10::u32 flags){auto& row=presentation_lab_timing[presentation_lab_timing_next];row={timestamp,static_cast<float>(delta*1000),alpha,flags,th10::presentation_audit::current_tick(),th10::presentation_audit::current_draw_serial(),0};presentation_lab_timing_next=(presentation_lab_timing_next+1)%512;if(presentation_lab_timing_count<512)++presentation_lab_timing_count;}
void reset_presentation_timing(){presentation_lab_timing_count=presentation_lab_timing_next=0;presentation_lab_fault=false;}
#endif
bool interpolation_ready(){if(!application||application->stopped||!application->initialized||application->world&&application->world->loading)return false;const th10::i32 screen=application->value.screen;return screen==1||screen==4||screen==7||screen==14;}
EM_BOOL frame(double timestamp,void* epoch){
    if(!running||uintptr_t(epoch)!=loop_epoch)return EM_FALSE;
    const double now=timestamp/1000.,delta=last<0?0:std::max(0.,now-last);last=now;callback_begin=emscripten_get_now();
    // Browser responsibilities end at resource readiness and input snapshots.
    // The C++ ApplicationLoop owns deadlines, logic, draw and the original
    // 60Hz cadence, independent of display callback frequency.
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
    const bool tick_due=cadence.advance(delta)!=0;int result=0;sdl_defer(1);
    if(tick_due){sdl_native_input(application);result=application->step(true);}
    const bool high=presentation.high_refresh&&interpolation_ready();if(high&&fast&&!presentation_primed&&tick_due)presentation_primed=true;const bool interpolate=high&&fast&&presentation_primed;float frame_alpha=1.0f;
    sdl_defer(0);bool presented=false;
    if(!result&&high){const bool frozen=application->world&&application->world->actors.session&&(application->world->actors.session->session_flags&0x74);frame_alpha=interpolate?float(cadence.interpolation_alpha()):1.0f;presented=application->presentation_draw(frame_alpha,interpolate,!frozen);}else presented=sdl_commit()!=0;
    if(presented&&application)application->presentation_frame();
#ifdef TH_PRESENTATION_AUDIT
    record_presentation_timing(timestamp,delta,frame_alpha,(ready>0?1u:0u)|(fast?2u:0u)|(high?4u:0u)|(tick_due?8u:0u)|(interpolate?16u:0u)|(presented?32u:0u));
#endif
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
    if(!running&&!application)return;running=false;++loop_epoch;sdl_audio_pause(1);browser_loop_stopped();application=nullptr;
}
#ifdef TH_PRESENTATION_AUDIT
// Diagnostic freeze is intentionally distinct from runtime shutdown. Preserve
// the application and cadence state, but invalidate the outstanding browser
// callback. The first resumed callback has zero wall delta, so time spent in
// the inspector cannot become catch-up debt.
__attribute__((export_name("presentation_lab_freeze"))) int presentation_lab_freeze(th10::browser::Application* app){
    if(!app||application!=app)return -1;if(!running)return 0;
    running=false;++loop_epoch;last=-1;sdl_audio_pause(1);return 0;
}
__attribute__((export_name("presentation_lab_resume"))) int presentation_lab_resume(th10::browser::Application* app){
    if(!app||application!=app)return -1;if(running)return 0;
    last=-1;callback_begin=emscripten_get_now();running=true;sdl_audio_pause(suspended?1:0);
    emscripten_request_animation_frame_loop(frame,reinterpret_cast<void*>(uintptr_t(++loop_epoch)));return 0;
}
__attribute__((export_name("presentation_lab_tick"))) int presentation_lab_tick(th10::browser::Application* app){
    if(running||!app||application!=app)return -1;
    constexpr double seconds=1./60.;elapsed+=seconds;audio_remainder+=seconds*1000.;
    const auto milliseconds=th10::u32(std::floor(audio_remainder));audio_remainder-=milliseconds;
    app->audio.advance(milliseconds);sdl_native_input(app);return app->step(true);
}
__attribute__((export_name("presentation_lab_draw"))) int presentation_lab_draw(th10::browser::Application* app,float alpha,th10::u32 world){
    if(running||!app||application!=app||!interpolation_ready()||!std::isfinite(alpha)||alpha<0||alpha>1)return -1;
    return app->presentation_draw(presentation_lab_fault?1.0f:alpha,true,world!=0)?0:1;
}
__attribute__((export_name("presentation_lab_fault"))) void presentation_lab_set_fault(th10::u32 value){presentation_lab_fault=value!=0;}
__attribute__((export_name("presentation_lab_gate"))) th10::u32 presentation_lab_gate(){return interpolation_ready()?1:0;}
__attribute__((export_name("presentation_lab_world_frozen"))) th10::u32 presentation_lab_world_frozen(th10::browser::Application* app){return app&&app->world&&app->world->actors.session&&(app->world->actors.session->session_flags&0x74)?1:0;}
__attribute__((export_name("audit_timing_records"))) const PresentationLabTiming* audit_timing_records(){return presentation_lab_timing;}
__attribute__((export_name("audit_timing_capacity"))) th10::u32 audit_timing_capacity(){return 512;}
__attribute__((export_name("audit_timing_count"))) th10::u32 audit_timing_count(){return presentation_lab_timing_count;}
__attribute__((export_name("audit_timing_next"))) th10::u32 audit_timing_next(){return presentation_lab_timing_next;}
__attribute__((export_name("audit_timing_stride"))) th10::u32 audit_timing_stride(){return sizeof(PresentationLabTiming);}
__attribute__((export_name("audit_timing_reset"))) void audit_timing_reset(){reset_presentation_timing();}
#endif
}
