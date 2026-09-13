#include "AnmRenderer.hpp"
namespace th10 {
// 0x444dc0. Caller already supplied projected positions, color and UVs.
i32 AnmRenderer::submit_prebuilt(const AnmVm& vm,const AnmVertex* quad){
    if((vm.flags&3)!=3||!(vm.color>>24))return -1;if(manager.current_texture!=vm.sprite->texture){manager.current_texture=vm.sprite->texture;flush();environment.set_texture(manager.current_texture);}if(manager.cached_draw_state[2]!=1){flush();manager.cached_draw_state[2]=1;}apply_state(vm);return append(quad);
}
// 0x444e60 / 0x444fa0. Untextured 20-byte strips/fans force diffuse-only stages.
// The cache invalidation belongs to the global manager, as in the original.
i32 AnmRenderer::draw_color_mesh(const AnmVm& vm,const void* vertices,u32 count,bool fan){
    flush();if(manager.cached_draw_state[2]!=4){environment.vertex_format(0x44);manager.cached_draw_state[2]=4;}apply_state(vm);
    environment.texture_stage(0,4,2);environment.texture_stage(0,1,2);environment.texture_stage(0,5,0);environment.texture_stage(0,2,0);
    auto& active=environment.global_manager?*environment.global_manager:manager;AnmRenderer active_renderer{active,environment};active_renderer.flush();environment.render_state(14,0);environment.draw_triangles(fan?6:5,count-2,vertices,20);
    active.cached_draw_state[2]=active.cached_draw_state[1]=active.cached_draw_state[3]=255;active.cached_draw_state[0]=3;
    environment.texture_stage(0,4,4);environment.texture_stage(0,1,4);environment.texture_stage(0,5,2);environment.texture_stage(0,2,2);return 0;
}
// 0x4450e0. This entry deliberately omits the generic visibility check.
i32 AnmRenderer::draw_textured_fan(const AnmVm& vm,const void* vertices,u32 count){
    flush();if(manager.cached_draw_state[2]!=3){environment.vertex_format(0x144);manager.cached_draw_state[2]=3;}apply_state(vm);if(manager.current_texture!=vm.sprite->texture){manager.current_texture=vm.sprite->texture;environment.set_texture(manager.current_texture);}
    auto& active=environment.global_manager?*environment.global_manager:manager;AnmRenderer active_renderer{active,environment};active_renderer.flush();environment.render_state(14,0);environment.texture_stage(0,6,0);environment.texture_stage(0,3,0);environment.draw_triangles(6,count-2,vertices,28);return 0;
}
// 0x444b10 / 0x444be0. Independent even/odd walks preserve their accumulated UV
// precision; an odd final vertex belongs to the first side of the strip.
i32 AnmRenderer::strip_uv(const AnmVm& vm,AnmVertex* vertices,i32 count,bool vertical) noexcept {
    if(count<=2)return -1;const auto& sprite=*vm.sprite;const auto begin=number(vertical?sprite.v1:sprite.u1)+number(vertical?vm.uv_offset.y:vm.uv_offset.x);
    const auto numerator=number(vertical?sprite.v1:sprite.u1)-number(vertical?sprite.v0:sprite.u0);
    const i32 pairs=wrapping_add(count,1)/2-1;const auto step=number((numerator/Extended::from_int(pairs)).to_float());
    for(u32 side=0;side<2;++side){auto along=begin;const auto across=number(vertical?(side?sprite.u1:sprite.u0):(side?sprite.v1:sprite.v0))+number(vertical?vm.uv_offset.x:vm.uv_offset.y);
        for(i32 i=side;i<count;i+=2){auto& vertex=vertices[i];if(vertical){vertex.uv.y=along.to_float();vertex.uv.x=across.to_float();}else{vertex.uv.x=along.to_float();vertex.uv.y=across.to_float();}along=along-step;vertex.color=vm.color;vertex.reciprocal_w=1;}
    }return 0;
}
}
