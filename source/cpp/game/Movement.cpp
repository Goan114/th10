#include "Movement.hpp"
#include <cmath>
namespace th10 {
void Movement::update_velocity() noexcept {
    if(!(flags&1)){const auto next=polar(angle,speed);velocity={next.x,next.y,0};}
    else{radius=(number(radial_velocity)+number(radius)).to_float();angle=normalize_angle((number(speed)+number(angle)).to_float()).to_float();}
}
// 0x44c2a0. The original snaps x/y downward, including negative coordinates.
// The multiply is extended precision, then explicitly spilled to double before
// floor, then multiplied by the original *float* approximation of 0.01.
void Movement::update() noexcept {
    if(flags&1){
        const auto offset=polar(angle,radius);
        position.x=(number(offset.x)+number(velocity.x)).to_float();
        position.y=(number(offset.y)+number(velocity.y)).to_float();
        position.z=velocity.z;
    }else{
        position.x=(number(position.x)+number(velocity.x)).to_float();
        position.y=(number(velocity.y)+number(position.y)).to_float();
        position.z=(number(velocity.z)+number(position.z)).to_float();
    }
    const auto snap=[](float value){
        return (Extended::from_double(std::floor((number(value)*number(100.0f)).to_double()))*number(0.01f)).to_float();
    };
    position.x=snap(position.x);position.y=snap(position.y);
}
}
