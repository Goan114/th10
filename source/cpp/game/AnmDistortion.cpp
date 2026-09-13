#include "AnmDistortion.hpp"
#include "GameMath.hpp"
namespace th10 {
namespace {
constexpr float pi=0x1.921fb6p+1f,tau=0x1.921fb6p+2f,angle_step=0x1.9f187ap-3f;
constexpr float velocity_limit=0x1.111112p-4f;
// This effect's inlined generator discards its first word and duplicates the
// second. It consumes the same two calls as the ordinary generator.
Extended effect_random(Rng& rng){
    rng.next_word();const u32 last=rng.next_word(),bits=last|(last<<16);
    auto value=Extended::from_int(static_cast<i32>(bits));
    if(bits&0x80000000)value=value+number(4294967296.0f);
    return value*number(0x1p-31f)-number(1);
}
Vec3 center(const AnmVm& vm){return {(number(vm.position.x)+number(vm.script_position.x)).to_float(),(number(vm.position.y)+number(vm.script_position.y)).to_float(),(number(vm.position.z)+number(vm.script_position.z)).to_float()};}
void translate(AnmVertex& vertex,const AnmVm& vm){
    vertex.position.x=(number(vm.position.x)+number(vm.script_position.x)+number(vertex.position.x)).to_float();
    vertex.position.y=(number(vm.script_position.y)+number(vm.position.y)+number(vertex.position.y)).to_float();
    const auto z=(number(vm.position.z)+number(vm.script_position.z)).to_float();
    vertex.position.z=(number(z)+number(vertex.position.z)).to_float();
}
void scroll(AnmDistortion& effect,u32 index,bool vertical){
    auto& coordinate=vertical?effect.vertices[index].uv.y:effect.vertices[index].uv.x;
    const auto next=number(effect.u_velocity)+number(coordinate);
    coordinate=next.to_float();
    // Both axes deliberately use u_velocity. A negative coordinate shifts all
    // 33 vertices, even those still waiting for their per-frame update.
    if(next<number(0))for(auto& vertex:effect.vertices){auto& value=vertical?vertex.uv.y:vertex.uv.x;value=(number(value)+number(1)).to_float();}
}
}
// 0x4452f0. Unused colors, final seam vertex and spare array slots are retained
// until the first update, matching the allocator-backed original effect.
i32 AnmDistortion::initialize(AnmVm& vm,AnmDistortionEnvironment& environment){
    if(vm.geometry){environment.release(vm.geometry);vm.geometry=nullptr;}
    auto& effect=*static_cast<AnmDistortion*>(environment.allocate(sizeof(AnmDistortion)));
    vm.geometry=&effect;vm.update_callback=environment.update_callback;vm.draw_callback=environment.draw_callback;
    auto& rng=*environment.random;
    effect.u_velocity=(rng.signed_unit()*number(0x1.111112p-7f)).to_float();
    effect.v_velocity=(rng.signed_unit()*number(0x1.111112p-7f)).to_float();
    effect.vertices[0].position=center(vm);effect.vertices[0].reciprocal_w=1;effect.vertices[0].uv={.5f,.5f};
    auto velocity=(rng.signed_unit()*number(velocity_limit)).to_float();float angle=-pi;
    for(u32 i=1;i<32;++i){
        if(!(number(angle)<number(pi)))angle=(number(angle)-number(tau)).to_float();
        auto& vertex=effect.vertices[i];vertex.reciprocal_w=1;vertex.position.z=0;
        const auto uv=polar(angle,.5f);vertex.uv={(number(uv.x)+number(.5f)).to_float(),(number(uv.y)+number(.5f)).to_float()};
        effect.radial_velocity[i]=velocity;
        effect.radii[i]=(effect_random(rng)*number(8)+number(80)).to_float();
        const auto next=effect_random(rng)*number(0x1.111112p-5f)+number(velocity);velocity=next.to_float();
        if(next<number(-velocity_limit))velocity=-velocity_limit;
        else if(number(velocity_limit)<number(velocity))velocity=velocity_limit;
        const auto xy=polar(angle,effect.radii[i]);vertex.position.x=xy.x;vertex.position.y=xy.y;translate(vertex,vm);
        angle=(number(angle)+number(angle_step)).to_float();
    }
    return 0;
}
// 0x445620. The final vertex duplicates the first ring vertex after scrolling.
i32 AnmDistortion::update(const AnmVm& vm) noexcept {
    vertices[0].position=center(vm);scroll(*this,0,false);scroll(*this,0,true);vertices[0].color=vm.color;
    float angle=-pi;
    for(u32 i=1;i<32;++i){
        auto& vertex=vertices[i];scroll(*this,i,false);scroll(*this,i,true);vertex.color=vm.color&0x00ffffff;
        radii[i]=(number(radial_velocity[i])+number(radii[i])).to_float();
        const auto xy=polar(angle,radii[i]);vertex.position.x=xy.x;vertex.position.y=xy.y;translate(vertex,vm);
        angle=(number(angle)+number(angle_step)).to_float();
    }
    vertices[32]=vertices[1];return 0;
}
}
