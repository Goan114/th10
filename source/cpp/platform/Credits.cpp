#include "Credits.hpp"
namespace th10::browser {
Credits::Credits(World& world,Captures& surfaces):owner(world),captures(surfaces){
    static constexpr const char* names[]={"e00.msg","e01.msg","e02.msg","e03.msg","e04.msg","e05.msg","e06.msg","e07.msg","e08.msg","e09.msg","e10.msg","e11.msg"};
    current=&value;game=&owner.state.game;scores=&owner.scores.data;chain=&owner.chain;callbacks=&owner.engine.callback_environment;update_callback=0x40ba70;draw_callback=0x40ba80;loader_callback=0x40c3a0;thread_vtable=1;registry=&owner.engine.manager.registry;text_animations=&owner.common.value->text_animations;animation_slots=owner.engine.manager.files;ending_files=names;filename=filename_storage;decoded_text=decoded_storage;loading_animation=&owner.common.value->loading_animation;engine_flags=&owner.state.engine_flags;held=reinterpret_cast<const u32*>(&owner.input.player_profiles[0].input.raw);pressed=reinterpret_cast<const u32*>(&owner.input.player_profiles[0].input.raw_pressed);pending_screen=&owner.state.pending_screen;menu_state=reinterpret_cast<i32*>(&owner.state.quitting);rate=&owner.engine.speed;owner.engine.register_receiver(*this);
}
Credits::~Credits(){if(value){auto* ending=value;ending->shutdown(*this);std::free(ending);}owner.engine.unregister_receiver(*this);}
bool Credits::initialize(){return Ending::create(*this)!=nullptr;}
void Credits::advance_loading(){if(auto* loader=pending_loader){pending_loader=nullptr;loader->load_animations(*this);}}
bool Credits::invoke(CallbackToken token,void* object,i32& result){if(token==update_callback){result=static_cast<Ending*>(object)->update(*this);return true;}if(token==draw_callback){result=1;return true;}return false;}
void* Credits::allocate(u32 bytes){return std::malloc(bytes);}void Credits::delete_object(void* p){std::free(p);}void Credits::free_bytes(void* p){std::free(p);}
u8* Credits::read_file(const char* name){return static_cast<u8*>(owner.read_file(name));}
void Credits::report_error(){error=-1;}
void Credits::show_loading(){if(!*loading_animation)*loading_animation=owner.engine.manager.create_at(*owner.common.value->effects,6,{480,392,0},false,AnimationPlacement::WorldBack,owner.engine,owner.engine);}
u32 Credits::create_animation(AnmFile& file,i32 script){return owner.animation(file,script);}
void Credits::draw_text(AnmVm* vm,u32 color,const char* text){owner.text(*vm,color,text,TextAlignment::Left);}
void Credits::sound(i32 id){owner.sound(id);}
void Credits::fade(i32 kind,i32 frames){ScreenEffect::create(static_cast<ScreenEffectKind>(kind),frames,0,0,0,49,owner.effects);}
void Credits::load_music(const char* name){owner.music().prepare(0,name);}
void Credits::play_music(i32 track){owner.music().play(0,track);}
void Credits::fade_music(float seconds){owner.music().fade(seconds);}
AnmFile* Credits::load_animations(i32 slot,const char* name){return owner.engine.manager.load(slot,name,owner.engine.resources);}
void Credits::unload_animations(i32 slot){owner.engine.manager.unload(slot,owner.engine.resources);}
void Credits::release_animations(AnmFile& file){file.release(owner.engine.resources);}
void Credits::release_capture(){captures.release_slot(0);}
u32 Credits::begin_thread(CallbackToken token,void* argument,u32 flags,u32& id){if(token!=loader_callback||flags||pending_loader)__builtin_trap();pending_loader=static_cast<EndingScript*>(argument);id=1;return 1;}
u32 Credits::wait_thread(u32,u32){pending_loader=nullptr;return 0;}
void Credits::close_thread(u32){pending_loader=nullptr;}
void Credits::sleep(u32){__builtin_trap();}
}
