#include "AnimationEngine.hpp"
#include <cstdlib>
namespace th10::browser {
namespace {
u32 pointer(const void* p){return static_cast<u32>(reinterpret_cast<uintptr_t>(p));}
constexpr CallbackToken animation_callbacks[]={0x4485d0,0x4485e0,0x4485f0,0x448600,0x448610,0x448620,0x4486a0,0x4486b0,0x4486c0,0x4486d0,0x4486e0,0x4486f0,0x448700,0x448710,0x448720,0x448730,0x448740,0x448770,0x4487c0,0x448810};
constexpr CallbackToken layer_callbacks[]={0x4485f0,0x448600,0x448610,0x448620,0x4486a0,0x4486b0,0x4486c0,0x4486d0,0x4486e0,0x4486f0,0x448700,0x448710,0x448720,0x448730,0x448740,0x448770,0x4487c0,0,0,0x448810};
}
AnimationEngine::AnimationEngine(FileSystem& f,GraphicsDevice& d,Rng& script,Rng& visual,float& s):device(d),script_random(script),visual_random(visual),speed(s),callback_environment(*this),resources(f,d,manager){
    rate=&speed;script_rng=&script_random;visual_rng=&visual_random;reference_positions[0]=&world.position;reference_positions[1]=&world.reserved_024;camera_delta=&world.animation_delta;default_tangent=&tangent;
    initial_quad=initial_vertices;render_quad=vertices;model_quad=model_template;chain=&chain_value;callbacks=&callback_environment;
    std::memcpy(frame_callbacks,animation_callbacks,sizeof(frame_callbacks));allocation=this;
    AnmDistortionEnvironment::random=&script_random;update_callback=0x445620;draw_callback=0x445880;
    chain_value.initialize();manager.initialize(*this);manager.initialize_model(*this);Camera::initialize(world,ui);configure_camera(true);
}
AnimationEngine::~AnimationEngine(){
    chain_value.clear_list(chain_value.update,callback_environment);chain_value.clear_list(chain_value.draw,callback_environment);manager.release(*this);
    for(i32 slot=0;slot<33;++slot)manager.unload(slot,resources);
    if(manager.model_vertex_buffer)device.resource(manager.model_vertex_buffer,ResourceOperation::Release);
}
GraphicsRenderer AnimationEngine::renderer(){return GraphicsRenderer(device,manager,*active,world,vertices);}
bool AnimationEngine::invoke(CallbackToken token,void* object,i32& result){
    if(token==0x4485d0){result=static_cast<AnmManager*>(object)->update_world(*this);return true;}
    if(token==0x4485e0){result=static_cast<AnmManager*>(object)->update_ui(*this);return true;}
    for(u32 i=0;i<20;++i)if(layer_callbacks[i]&&layer_callbacks[i]==token){result=draw_layer(i);return true;}
    if(token==0x445620){auto& vm=*static_cast<AnmVm*>(object);result=static_cast<AnmDistortion*>(vm.geometry)->update(vm);return true;}
    if(token==0x445880){auto& vm=*static_cast<AnmVm*>(object);auto env=renderer();AnmRenderer{manager,env}.draw_textured_fan(vm,static_cast<AnmDistortion*>(vm.geometry)->vertices,33);result=0;return true;}
    for(auto* receiver:receivers)if(receiver&&receiver->invoke(token,object,result))return true;
    return application_callbacks&&application_callbacks->invoke(token,object,result);
}
void AnimationEngine::register_receiver(CallbackReceiver& receiver){for(auto*& slot:receivers)if(!slot){slot=&receiver;return;}__builtin_trap();}
void AnimationEngine::unregister_receiver(CallbackReceiver& receiver){for(auto*& slot:receivers)if(slot==&receiver)slot=nullptr;}
void AnimationEngine::callback(u32 token,AnmVm& vm){callback_environment.invoke(token,&vm);}
i32 AnimationEngine::update(AnmVm& vm){return vm.update(*this);}
void AnimationEngine::draw(AnmVm& vm){auto env=renderer();AnmRenderer{manager,env}.draw(vm);}
void AnimationEngine::bind_sprite(AnmVm& vm,i32 index){vm.animation_file->bind_sprite(vm,index);}
void AnimationEngine::change_draw_mode(AnmVm& vm){AnmDistortion::initialize(vm,*this);}
void* AnimationEngine::allocate_geometry(u32 bytes){return std::malloc(bytes);}
AnmVm* AnimationEngine::spawn_child(AnmVm& parent,i32 script,u32 mode){
    const auto placement=mode==88?AnimationPlacement::WorldBack:mode==90?AnimationPlacement::UiBack:mode==91?AnimationPlacement::WorldFront:AnimationPlacement::UiFront;
    u32 id=manager.create(*parent.animation_file,script,parent.owner_tag,placement,*this,*this);return manager.registry.find_and_clear(id);
}
AnmVm* AnimationEngine::allocate_animation(){return static_cast<AnmVm*>(std::malloc(sizeof(AnmVm)));}
void AnimationEngine::release_memory(void* p){std::free(p);}
void* AnimationEngine::allocate(u32 bytes){return std::malloc(bytes);}
void AnimationEngine::release(void* p){std::free(p);}
void AnimationEngine::clear_pixel_shader(){device.call(DeviceOperation::PixelShader,{0});}
void AnimationEngine::create_model_buffer(void*& buffer){device.call(DeviceOperation::CreateVertices,{80,0,0x102,1,pointer(&buffer),0});}
void* AnimationEngine::lock_model_buffer(void* buffer){void* bytes=nullptr;device.resource(buffer,ResourceOperation::LockBuffer,{0,0,pointer(&bytes),0});return bytes;}
void AnimationEngine::unlock_model_buffer(void* buffer){device.resource(buffer,ResourceOperation::UnlockBuffer);}
void AnimationEngine::bind_model_buffer(void* buffer){device.call(DeviceOperation::Stream,{0,pointer(buffer),0,20});}
void AnimationEngine::begin_frame(){auto env=renderer();AnmRenderer{manager,env}.begin_frame();}
void AnimationEngine::flush(){auto env=renderer();AnmRenderer{manager,env}.flush();}
i32 AnimationEngine::update_all(){return chain_value.run(false,callback_environment);}
i32 AnimationEngine::draw_all(){return chain_value.run(true,callback_environment);}
i32 AnimationEngine::draw_layer(u32 layer){auto env=renderer();GraphicsCamera camera(env);return AnmLayers{world,ui,active,screen_space,fog_enabled,camera,*this}.draw(manager,layer);}
void AnimationEngine::configure_camera(bool flat){auto env=renderer();GraphicsCamera camera(env);if(flat)active->configure_flat(camera);else active->configure_world(camera);camera.set_viewport(active->viewport);}
}
