#include "World.hpp"
#include "AudioData.hpp"
#include "../game/TextFormat.hpp"
#include <new>
#include <cstdlib>
namespace th10::browser {
World::World(GameState& s,AnimationEngine& e,Common& c,Fonts& f,Input& i,Audio& a,Scores& records,ScreenEffects& fx):state(s),engine(e),common(c),fonts(f),input(i),audio(a),scores(records),effects(fx),backgrounds(s,e,fx,records.files),chain(&e.chain_value),replay_files(records.files,s.game.flags),replay_writer(records.files,default_calendar(),s.game,s.active_time,s.total_time,s.chinese),calendar(default_calendar()){engine.register_receiver(*this);}
World::~World(){shutdown();while(previews)release_replay(&previews->document.value);release_results_services();if(hud){hud->~Hud();std::free(hud);}std::free(cached_profile);engine.unregister_receiver(*this);}
void World::select_screen(i32 screen){state.pending_screen=state.engine_flags&0x1000?2:screen;}
void World::sound(i32 id){audio.manager.queue_effect(id,0,sound_definitions);}
void World::sound(i32 id,float x){audio.manager.queue_effect_position(id,x,sound_definitions);}
AudioGame World::music(){return {audio.manager,&scores.data,audio.music_flags(state.configuration.display_flags),&engine.speed};}
u32 World::animation(AnmFile& file,i32 script,u32 tag){return engine.manager.create(file,script,tag,AnimationPlacement::WorldBack,engine,engine);}
void World::effect(AnmFile& file,i32 script,const Vec3& point){engine.manager.create_at(file,script,point,true,AnimationPlacement::WorldBack,engine,engine);}
void World::rectangle(const ScreenRect& rect,u32 color){auto renderer=engine.renderer();auto* manager=&engine.manager;const u32 colors[]={color,color,color,color};draw_screen_rectangle(rect,colors,&manager,renderer);}
void World::text(AnmVm& vm,u32 color,const char* pattern,TextAlignment alignment,const u32* words,u32 count){char output[128];if(format_text(output,sizeof(output),pattern,words,count)<0)__builtin_trap();AnmText::draw(vm,color,output,alignment,fonts);}
void World::queue_text(const Vec3& point,const char* pattern,const u32* words,u32 count){char output[512];if(format_text(output,sizeof(output),pattern,words,count)<0)__builtin_trap();common.value->queue(output,point,false);}
void* World::read_file(const char* name){return ResourceFiles{scores.files}.load(name,nullptr,false);}
void World::fail(){error=-1;}
void World::clear_for_dialogue(){cancel_bullets(false);cancel_lasers(0);clear_enemies(false);}
void World::show_clear_results(){show_results(true);}
bool World::create_object(SessionObject kind,i32 mode){
    switch(kind){
    case SessionObject::Replay:return create_replay(mode,state.replay_filename);
    case SessionObject::Stage:
        if(backgrounds.current==backgrounds.previous)backgrounds.current=nullptr;
        return backgrounds.create(reinterpret_cast<const char*>(state.current_stage->resources[1]))!=nullptr;
    case SessionObject::Gui:
        if(!hud)hud=new(std::malloc(sizeof(Hud))) Hud(state,actors,engine,common,fonts,input,audio,scores,effects,*this);
        hud->controller_stage=&actors.session->replay_mode;hud->difficulty_visible=new_game;return hud->initialize();
    case SessionObject::Player:return create_player();case SessionObject::Bullets:return create_bullets();case SessionObject::Items:return create_items();case SessionObject::Lasers:return create_lasers();
    case SessionObject::Results:return create_results();case SessionObject::TextOverlay:return create_hints();case SessionObject::ScorePopups:return create_popups();case SessionObject::Enemies:return create_enemies();
    case SessionObject::Effects:return create_effects();case SessionObject::Bomb:return create_bomb();case SessionObject::Spell:return create_spell();default:return false;
    }
}
void World::destroy_object(SessionObject kind,GameSystemCallbacks* object){
    switch(kind){
    case SessionObject::Replay:destroy_replay(reinterpret_cast<Replay*>(object));break;
    case SessionObject::Stage:case SessionObject::PreviousStage:backgrounds.destroy(reinterpret_cast<Stage*>(object));break;
    case SessionObject::Gui:hud->shutdown();break;
    case SessionObject::Player:destroy_player(reinterpret_cast<Player*>(object));break;
    case SessionObject::Bullets:destroy_bullets(reinterpret_cast<EnemyBulletManager*>(object));break;
    case SessionObject::Items:destroy_items(reinterpret_cast<ItemManager*>(object));break;
    case SessionObject::Lasers:destroy_lasers(reinterpret_cast<LaserManager*>(object));break;
    case SessionObject::Results:destroy_results(reinterpret_cast<Results*>(object));break;
    case SessionObject::TextOverlay:destroy_hints(reinterpret_cast<StageHints*>(object));break;
    case SessionObject::ScorePopups:destroy_popups(reinterpret_cast<ScorePopups*>(object));break;
    case SessionObject::Enemies:destroy_enemies(reinterpret_cast<EnemyManager*>(object));break;
    case SessionObject::Effects:destroy_effects(reinterpret_cast<GameEffects*>(object));break;
    case SessionObject::Bomb:destroy_bomb(reinterpret_cast<Bomb*>(object));break;
    case SessionObject::Spell:destroy_spell(reinterpret_cast<SpellCard*>(object));break;default:break;
    }
}
bool World::invoke(CallbackToken token,void*,i32& result){
    switch(token){
    case 0x4187c0:result=update_session();break;case 0x4187d0:result=actors.session->draw(engine.manager);break;
    case 0x426500:result=update_player();break;case 0x426510:result=draw_player();break;
    case 0x406770:result=update_bullets();break;case 0x4067a0:result=draw_bullets();break;
    case 0x41c480:result=update_lasers();break;case 0x41c4e0:result=draw_lasers();break;
    case 0x41ba00:result=actors.session&&(actors.session->session_flags&0x405)?1:update_items();break;
    case 0x41ba30:result=actors.session&&(actors.session->session_flags&4)?1:draw_items();break;
    case 0x405840:result=update_bomb();break;case 0x40d810:result=update_enemies();break;
    case 0x409220:result=update_spell();break;case 0x409230:result=draw_spell(false);break;case 0x409270:result=draw_spell(true);break;
    case 0x42a3d0:result=update_replay();break;case 0x42a3e0:result=replay_frame_action();break;case 0x42a430:result=draw_replay();break;
    case 0x422a90:result=update_results();break;case 0x422aa0:result=draw_results();break;
    case 0x42b9a0:result=actors.popups->update(&engine.speed);break;case 0x42b9b0:result=draw_popups();break;
    case 0x4198a0:result=update_hints();break;
    // These original callback bodies intentionally return 1 without work.
    case 0x405850:case 0x40b050:case 0x40b060:case 0x40d820:case 0x4198b0:result=1;break;
    default:return false;
    }return true;
}
}
