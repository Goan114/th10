#include "PlayerDraw.hpp"
#include <cmath>
namespace th10 {
// 0x426360. The optional faith bar follows the player, with both coordinates
// floored after the original intermediate float store.
i32 Player::draw(PlayerDrawEnvironment& env){
    if(state==2)return 1;
    animation.position={(number(position.x)+number(224)).to_float(),(number(position.y)+number(16)).to_float(),position.z};env.draw_animation(animation);
    for(auto& option:options)if(option.on_draw)env.draw_option(option);
    if(env.controller_flags&&*env.controller_flags<0&&*env.enemies&&*env.gui&&!(*env.enemies)->bosses[0]&&!(*env.gui)->dialogue&&!*env.results_state&&env.game->faith_timer.current){
        const i32 faith=env.game->faith_timer.current;
        const float x=std::floor((number(position.x)+number(225)-number(16)).to_float());
        ScreenRect rect{x,0,(Extended::from_int(faith)*number(.29230770468711853f)+number(x)).to_float(),0};
        rect.top=std::floor((number(position.y)+number(17)-number(24)).to_float());rect.bottom=(number(rect.top)+number(2)).to_float();env.rectangle(rect,0x80000000);
        rect.left=(number(rect.left)-number(1)).to_float();rect.right=(number(rect.right)-number(1)).to_float();rect.top=(number(rect.top)-number(1)).to_float();rect.bottom=(number(rect.bottom)-number(1)).to_float();env.rectangle(rect,0xffffffff);
    }
    return 1;
}
}
