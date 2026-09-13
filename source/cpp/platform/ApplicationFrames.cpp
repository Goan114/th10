#include "Application.hpp"
#include "../game/TextFormat.hpp"
#include <cstdlib>
namespace th10::browser {
namespace{u32 pointer(const void* value){return static_cast<u32>(reinterpret_cast<uintptr_t>(value));}}
AppFrames::AppFrames(Application& a):owner(a){animations=&a.manager;pending_screen=&a.state.pending_screen;background_color=&a.state.background_color;world_camera=&a.engine.world;}
void AppFrames::update_audio(){owner.audio.advance_fades();}
void AppFrames::update_input(){InputDevices{owner.input}.update(0,false);}
i32 AppFrames::process_loading(){return owner.engine.manager.process_loading(owner.engine.resources);}
i32 AppFrames::transition(ApplicationState& app){const i32 result=app.transition(owner.screens);owner.sync_views();return owner.error?4:result;}
void AppFrames::configure_camera(Camera& camera){owner.configure_camera(camera,false);}
void AppFrames::set_viewport(void*,const CameraViewport& viewport){owner.engine.device.call(DeviceOperation::Viewport,{pointer(&viewport)});}
void AppFrames::clear(u32 color){owner.engine.device.call(DeviceOperation::Clear,{0,0,1,color,0x3f800000,0});}
void AppFrames::flush(){owner.engine.flush();}
AppLoop::AppLoop(Application& a):owner(a){application=&a.value;animations=&a.manager;frame_skip=&a.state.configuration.options[4];frame_duration=&a.frame_duration;graphics_state=&a.graphics_state;fog_enabled=&a.engine.fog_enabled;}
Extended AppLoop::time(){return owner.time();}void AppLoop::sleep(u32){}void AppLoop::flush(){owner.engine.flush();}
void AppLoop::configure_flat(Camera& camera){owner.configure_camera(camera,true);}
void AppLoop::set_viewport(void*,const CameraViewport& viewport){owner.engine.device.call(DeviceOperation::Viewport,{pointer(&viewport)});}
i32 AppLoop::update(){return owner.engine.update_all();}
void AppLoop::update_audio(){owner.audio.update();}
void AppLoop::stop_loader(){owner.value.stop_loading(owner.screens);}
i32 AppLoop::begin_scene(void*){return owner.engine.device.call(DeviceOperation::Begin);}
void AppLoop::draw(){owner.engine.draw_all();}
i32 AppLoop::render_state(void*,u32 key,u32 value){return owner.engine.device.call(DeviceOperation::RenderState,{key,value});}
void AppLoop::clear_texture(void*){owner.engine.device.call(DeviceOperation::Texture,{0,0});}
void AppLoop::end_scene(void*){owner.engine.device.call(DeviceOperation::End);}
void AppLoop::present(){Presentation{owner.presentation}.submit();}
AppStatistics::AppStatistics(Application& a):owner(a){current=&a.statistics;chain=&a.chain;callbacks=&a.engine.callback_environment;game=&a.session_view;text=&a.common_view;timing_counters=a.timing_counters;timing_samples=a.timing_samples;pending_screen=&a.state.pending_screen;frame_skip=&a.state.configuration.options[4];draw_callback=0x413690;}
void* AppStatistics::allocate(u32 bytes){return std::malloc(bytes);}Extended AppStatistics::time(){return owner.time();}
void AppStatistics::draw_rate(CommonResources& common,const Vec3& position,float rate){char output[512];const double value=rate;u32 bits[2];std::memcpy(bits,&value,8);format_text(output,sizeof(output),"%2.1ffps",bits,2);common.queue(output,position,false);common.mark_small();}
}
