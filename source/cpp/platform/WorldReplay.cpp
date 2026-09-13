#include "World.hpp"
#include "../game/ReplayResources.hpp"
#include <new>
namespace th10::browser {
namespace {
struct Gameplay final:ReplayEnvironment {
    World& w;explicit Gameplay(World& world):w(world){game=&w.state.game;input=&w.input.player_profiles[0].input;random=&w.engine.script_random;rate=&w.engine.speed;display_flags=&w.state.configuration.display_flags;recording_mode=reinterpret_cast<const u32*>(&w.new_game);controller_flags=w.actors.session?&w.actors.session->session_flags:nullptr;measured_fps=&w.measured_fps;player=&w.actors.player;}
    void* allocate(u32 bytes) override{return w.replay_memory.allocate(bytes);}
    void release(void* bytes) override{if(!bytes)return;if(w.replay_memory.owns(bytes))w.replay_memory.release(bytes);else w.replay_files.memory.release(bytes);}
    void configure_options(Player&) override{w.configure_player();}
    void activate_player(Player&) override{w.activate_player();}
    void draw_rate(const Vec3& position,u32 color,u8 fps) override{w.common.value->color=color;const u32 argument=fps;w.queue_text(position,"%3d",&argument,1);w.common.value->color=0xffffffff;}
    void timestamp(i32& destination) override{destination=w.calendar.timestamp();}
};
struct Resources final:ReplayResourceEnvironment {
    World& w;Gameplay services;explicit Resources(World& world):w(world),services(world){gameplay=&services;current=&w.state.replay;configuration=w.actors.session?w.actors.session->configuration:nullptr;chain=&w.chain;callbacks=&w.engine.callback_environment;input_callback=0x42a3d0;end_frame_callback=0x42a3e0;draw_callback=0x42a430;}
    i32 load(Replay& replay,const char* name) override{w.replay_files.flags=w.state.game.flags;return load_replay(replay,name,w.replay_files);}
};
}
bool World::create_replay(i32 mode,const char* name){Resources env(*this);return ReplayResources::create(mode,name,env)!=nullptr;}
void World::destroy_replay(Replay* replay){if(!replay)return;Resources env(*this);ReplayResources{*replay,env}.shutdown();env.services.release(replay);replay_files.close();replay_files.memory.clear();}
void World::prepare_replay(){Gameplay env(*this);state.replay->prepare_stage(env);}
void World::activate_replay(){Gameplay env(*this);state.replay->activate_stage(env);}
i32 World::update_replay(){Gameplay env(*this);return state.replay->update_input(env);}
i32 World::replay_frame_action(){Gameplay env(*this);return state.replay->frame_action(env,true);}
i32 World::draw_replay(){Gameplay env(*this);return state.replay->draw(env,true);}
void World::finish_replay(i32 clear){Gameplay env(*this);state.replay->finish_recording(clear,env);}
Replay* World::preview(const char* name){auto* entry=new(std::malloc(sizeof(Preview))) Preview(scores.files,state.game.flags,previews);if(entry->document.load(name)){entry->~Preview();std::free(entry);return nullptr;}entry->document.value.mode=2;previews=entry;return &entry->document.value;}
void World::release_replay(Replay* replay){if(!replay)return;for(auto** next=&previews;*next;next=&(*next)->next){auto* entry=*next;if(&entry->document.value==replay){*next=entry->next;entry->~Preview();std::free(entry);return;}}if(replay==state.replay){destroy_replay(replay);return;}__builtin_trap();}
void World::save_replay(const char* file,const char* name){if(replay_writer.save(*state.replay,file,name))fail();}
}
