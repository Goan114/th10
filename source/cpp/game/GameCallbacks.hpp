#pragma once
#include "AnmLayers.hpp"
#include "AnmDistortion.hpp"
#include "AnmRenderer.hpp"
#include "ApplicationFrame.hpp"
#include "ApplicationSystem.hpp"
#include "CommonResources.hpp"
#include "StartupScreen.hpp"
#include "StageRenderer.hpp"
#include "ScreenEffect.hpp"
#include "SpellCard.hpp"
#include "EnemyManager.hpp"
#include "BulletFrame.hpp"
#include "LaserManager.hpp"
#include "Bomb.hpp"
#include "Item.hpp"
#include "Player.hpp"
#include "Gui.hpp"
#include "GameSession.hpp"
#include "StageHints.hpp"
#include "Ending.hpp"
#include "TitleLoop.hpp"
#include "TitleDraw.hpp"
#include "Results.hpp"
#include "ScorePopups.hpp"
#include "FrameStatistics.hpp"
#include "Replay.hpp"
namespace th10 {
struct GameCallbackWorld {
    ApplicationState* application;
    AnmManager** animations;
    GameSession** session;
    float* rate;
    u32* fog_enabled;
};
// Tokens identify callbacks stored in game objects. They are never executed as
// machine-code addresses here. Platform supplies typed environments; all game
// calls below are ordinary C++ calls and require no CPU or register adapter.
template<class Platform> struct GameCallbacks {
    Platform& platform;GameCallbackWorld& world;
    bool invoke(CallbackToken token,void* owner,i32& result){
        const u32 layers[]={0x4485f0,0x448600,0x448610,0x448620,0x4486a0,0x4486b0,0x4486c0,0x4486d0,0x4486e0,0x4486f0,0x448700,0x448710,0x448720,0x448730,0x448740,0x448770,0x4487c0,0,0,0x448810};
        for(u32 layer=0;layer<20;layer++)if(layers[layer]&&token==layers[layer]){
            auto camera=platform.camera();auto frame=platform.animation_frame();auto& app=*world.application;
            result=AnmLayers{app.world_camera,app.ui_camera,app.active_camera,app.screen_space,*world.fog_enabled,camera,frame}.draw(*static_cast<AnmManager*>(owner),layer);return true;
        }
        switch(token){
        case 0x4485d0:case 0x4485e0:{auto env=platform.animation_frame();auto& manager=*static_cast<AnmManager*>(owner);result=token==0x4485d0?manager.update_world(env):manager.update_ui(env);break;}
        case 0x445620:case 0x445880:{auto& vm=*static_cast<AnmVm*>(owner);auto& effect=*static_cast<AnmDistortion*>(vm.geometry);if(token==0x445620)result=effect.update(vm);else{auto env=platform.animation_render();AnmRenderer{**world.animations,env}.draw_textured_fan(vm,effect.vertices,33);result=0;}break;}
        case 0x4201b0:{auto env=platform.application_system();result=ApplicationSystem{env}.initialize();break;}
        case 0x41ff80:case 0x420000:case 0x4200d0:{auto env=platform.application_frame();ApplicationFrame frame{token==0x4200d0?*world.application:*static_cast<ApplicationState*>(owner),env};result=token==0x41ff80?frame.update():token==0x420000?frame.begin_draw():frame.finish_draw();break;}
        case 0x4014f0:result=static_cast<CommonResources*>(owner)->update();break;
        case 0x401510:case 0x401520:{auto env=platform.ascii_render();result=static_cast<CommonResources*>(owner)->draw(token==0x401520,env);break;}
        case 0x41feb0:case 0x41fef0:{auto env=platform.startup();auto& screen=*static_cast<StartupScreen*>(owner);result=token==0x41feb0?screen.update(env):screen.draw(env);break;}
        case 0x403050:{auto env=platform.stage();result=static_cast<Stage*>(owner)->update(env);break;}
        case 0x403060:case 0x403070:{auto env=platform.stage_render();StageRenderer renderer{*static_cast<Stage*>(owner),env};result=token==0x403060?renderer.draw_background():renderer.draw_foreground();break;}
        case 0x43bd40:case 0x43c230:case 0x43c310:case 0x43c460:case 0x43c550:case 0x43c710:{auto env=platform.screen_effect();auto& effect=*static_cast<ScreenEffect*>(owner);result=token==0x43bd40?effect.reveal(env):token==0x43c230?effect.hide(env):token==0x43c310?effect.dim():token==0x43c460?effect.flash(env):token==0x43c550?effect.shake_linear(env):effect.shake_envelope(env);break;}
        case 0x43c1a0:case 0x43c2c0:case 0x43c3c0:case 0x43c410:case 0x43c500:{auto env=platform.screen_effect();result=static_cast<ScreenEffect*>(owner)->draw_region(env,token==0x43c1a0||token==0x43c3c0,token==0x43c1a0,token==0x43c500);break;}
        case 0x43c870:{auto env=platform.screen_effect();auto* effect=static_cast<ScreenEffect*>(owner);if(effect){effect->release(env);env.destroy(effect);}result=0;break;}
        case 0x409220:case 0x409230:case 0x409270:{auto env=platform.spell();auto& spell=*static_cast<SpellCard*>(owner);result=token==0x409220?spell.update(env):token==0x409230?spell.draw_backgrounds(env):spell.draw_digits(env);break;}
        case 0x40d810:{auto env=platform.enemies();result=static_cast<EnemyManager*>(owner)->update(env);break;}
        case 0x406770:case 0x4067a0:{auto env=platform.bullets();auto& bullets=*static_cast<EnemyBulletManager*>(owner);result=token==0x406770?bullets.tick(env):bullets.render(env);break;}
        case 0x41c480:case 0x41c4e0:{auto env=platform.lasers();auto& lasers=*static_cast<LaserManager*>(owner);const u32 flags=(*world.session)->session_flags;result=token==0x41c480?lasers.tick(flags,*world.rate,env):lasers.render(flags,env);break;}
        case 0x405840:{auto env=platform.bomb();result=static_cast<Bomb*>(owner)->update(env);break;}
        case 0x41ba00:case 0x41ba30:{
            const auto* session=*world.session;const u32 flags=session?session->session_flags:0;result=1;
            if(token==0x41ba00?(flags&0x405)==0:(flags&4)==0){auto env=platform.items();auto& items=*static_cast<ItemManager*>(owner);result=token==0x41ba00?items.update(env):items.draw(env);}break;
        }
        case 0x426500:{auto env=platform.player_frame();result=static_cast<Player*>(owner)->update(env);break;}
        case 0x426510:{auto env=platform.player_draw();result=static_cast<Player*>(owner)->draw(env);break;}
        case 0x415ae0:case 0x415af0:{auto env=platform.gui();auto& gui=*static_cast<Gui*>(owner);result=token==0x415ae0?gui.update(env):gui.draw(env);break;}
        case 0x4187c0:{auto env=platform.session();result=static_cast<GameSession*>(owner)->update(env);break;}
        case 0x4187d0:result=static_cast<GameSession*>(owner)->draw(**world.animations);break;
        case 0x4198a0:{auto env=platform.hints();result=static_cast<StageHints*>(owner)->update(env);break;}
        case 0x40ba70:{auto env=platform.ending();result=static_cast<Ending*>(owner)->update(env);break;}
        case 0x42d2e0:case 0x42d2f0:{auto env=platform.title();auto& title=*static_cast<TitleMenu*>(owner);result=token==0x42d2e0?update_title(title,env):draw_title(title,env);break;}
        case 0x422a90:{auto env=platform.results();result=static_cast<Results*>(owner)->update(env);break;}
        case 0x422aa0:{auto env=platform.results_draw();result=static_cast<Results*>(owner)->draw(env);break;}
        case 0x42a3d0:case 0x42a3e0:case 0x42a430:{auto env=platform.replay();auto& replay=*static_cast<Replay*>(owner);result=token==0x42a3d0?replay.update_input(env):token==0x42a3e0?replay.frame_action(env,true):replay.draw(env,true);break;}
        case 0x42b9a0:result=static_cast<ScorePopups*>(owner)->update(world.rate);break;
        case 0x42b9b0:{auto env=platform.score_popups();result=static_cast<ScorePopups*>(owner)->draw(env);break;}
        case 0x413690:{auto env=platform.statistics();result=static_cast<FrameStatistics*>(owner)->draw(env);break;}
        case 0x405850:case 0x40b050:case 0x40b060:case 0x40d820:case 0x4198b0:case 0x40ba80:case 0x4200c0:result=1;break;
        default:return false;
        }
        return true;
    }
};
}
