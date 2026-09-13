#pragma once
#include "../game/Player.hpp"
#include <cmath>
namespace th10::browser {
// This state belongs to the platform input owner, not Player's original ABI.
struct EaglerMovement {
    // 0: keyboard, 1: limited drag, 2: unlimited drag, 3: free joystick.
    i32 mode=0;float x=0,y=0;
    void clear(){mode=0;x=y=0;}
    void sample(i32 kind,float dx,float dy){
        if(kind<0||kind>3||!std::isfinite(dx)||!std::isfinite(dy)){clear();return;}
        mode=kind;x=dx;y=dy;
    }
    void apply(Player& player,float rate,i32& vx,i32& vy){
        if(!mode||rate<=0)return;
        const float speed=static_cast<float>(player.focused?player.slow_speed:player.fast_speed);
        float dx=x,dy=y;
        if(mode==3){
            const float length=std::sqrt(dx*dx+dy*dy);
            if(length>1){dx/=length;dy/=length;}
            vx=static_cast<i32>(dx*speed);vy=static_cast<i32>(dy*speed);return;
        }
        // Drag coordinates are game pixels. Preserve exact arbitrary direction,
        // consume at most one speed-limited displacement per logical update.
        dx*=100;dy*=100;
        const float length=std::sqrt(dx*dx+dy*dy),limit=speed*rate;
        if(mode==1&&length>limit){dx*=limit/length;dy*=limit/length;}
        vx=static_cast<i32>(dx/rate);vy=static_cast<i32>(dy/rate);
        clear();
    }
};
}
