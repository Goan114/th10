#include "ScreenEffects.hpp"
namespace th10::browser {
ScreenEffects::ScreenEffects(AnimationEngine& e,const u32& quit,const u32* controller):engine(e),update_chain(&e.chain_value){
    rate=&e.speed;quitting=&quit;controller_flags=controller;random=&e.script_random;camera_offset=&e.world.draw_offset;chain=&update_chain;callbacks=&e.callback_environment;
    const CallbackToken updates[]={0x43bd40,0x43c550,0x43c230,0x43bd40,0x43c460,0x43c230,0x43c310,0x43c310,0x43c710},draws[]={0x43c1a0,0,0x43c2c0,0x43c2c0,0x43c500,0x43c1a0,0x43c3c0,0x43c410,0};
    std::memcpy(update_callbacks,updates,sizeof(updates));std::memcpy(draw_callbacks,draws,sizeof(draws));delete_callback=0x43c870;engine.register_receiver(*this);
}
ScreenEffects::~ScreenEffects(){while(memory.first){auto* effect=static_cast<ScreenEffect*>(memory.first->bytes);effect->release(*this);destroy(effect);}engine.unregister_receiver(*this);}
bool ScreenEffects::invoke(CallbackToken token,void* object,i32& result){
    auto* effect=static_cast<ScreenEffect*>(object);
    if(token==delete_callback){effect->release(*this);destroy(effect);result=0;return true;}
    for(u32 i=0;i<9;++i){if(token==update_callbacks[i]){result=effect->update(*this);return true;}if(draw_callbacks[i]&&token==draw_callbacks[i]){result=effect->draw(*this);return true;}}
    return false;
}
ScreenEffect* ScreenEffects::allocate(){return reinterpret_cast<ScreenEffect*>(memory.allocate(sizeof(ScreenEffect)));}
void ScreenEffects::destroy(ScreenEffect* effect){memory.release(effect);}
void ScreenEffects::fullscreen_viewport(){engine.flush();auto viewport=engine.world.viewport;viewport.x=viewport.y=0;viewport.width=640;viewport.height=480;engine.device.call(DeviceOperation::Viewport,{static_cast<u32>(reinterpret_cast<uintptr_t>(&viewport))});}
void ScreenEffects::rectangle(const ScreenRect& bounds,u32 color){auto renderer=engine.renderer();auto* manager=&engine.manager;const u32 colors[]={color,color,color,color};draw_screen_rectangle(bounds,colors,&manager,renderer);}
}
