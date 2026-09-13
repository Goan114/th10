#include "Graphics.hpp"
namespace th10::browser {
namespace {u32 address(const void* value){return static_cast<u32>(reinterpret_cast<uintptr_t>(value));}}
GraphicsRenderer::GraphicsRenderer(GraphicsDevice& d,AnmManager& manager,Camera& active,Camera& world,AnmVertex* vertices):device(d),camera(active){global_manager=&manager;quad=vertices;viewport=reinterpret_cast<const RenderViewport*>(&active.viewport);camera_unit=&active.right;camera_position=&world.position;fog=&world.fog;}
void GraphicsRenderer::texture_stage(u32 stage,u32 setting,u32 value){device.call(DeviceOperation::TextureStage,{stage,setting,value});}
void GraphicsRenderer::sampler_state(u32 stage,u32 setting,u32 value){device.call(DeviceOperation::Sampler,{stage,setting,value});}
void GraphicsRenderer::render_state(u32 setting,u32 value){device.call(DeviceOperation::RenderState,{setting,value});}
void GraphicsRenderer::set_texture(void* texture){device.call(DeviceOperation::Texture,{0,address(texture)});}
void GraphicsRenderer::vertex_format(u32 format){device.call(DeviceOperation::VertexFormat,{format});}
void GraphicsRenderer::draw_triangles(u32 primitive,u32 count,const void* vertices,u32 stride){device.call(DeviceOperation::Triangles,{primitive,count,address(vertices),stride});}
void GraphicsRenderer::set_transform(u32 kind,const Matrix4& matrix){device.call(DeviceOperation::Transform,{kind,address(&matrix)});}
void GraphicsRenderer::stream_source(void* buffer,u32 stride){device.call(DeviceOperation::Stream,{0,address(buffer),0,stride});}
void GraphicsRenderer::draw_buffer(u32 primitive,u32 first,u32 count){device.call(DeviceOperation::DrawBuffer,{primitive,first,count});}
void GraphicsRenderer::rotation(Matrix4& matrix,u32 axis,float radians){GraphicsMath::rotation(matrix,axis,radians);}
void GraphicsRenderer::multiply(Matrix4& output,const Matrix4& first,const Matrix4& second){GraphicsMath::multiply(output,first,second);}
void GraphicsRenderer::project(Vec3& output,const Vec3& input,const Matrix4& world){GraphicsMath::project(output,input,&camera.viewport,&camera.projection,&camera.view,&world);}
void GraphicsRenderer::transform(float* output,const Vec3& input,const Matrix4& world){GraphicsMath::transform(output,input,world);}
i32 GraphicsRenderer::special_draw(AnmManager& manager,AnmVm& vm,u32 mode){
    AnmRenderer renderer{manager,*this};AnmProjection projection{renderer,*this};
    if(mode==4||mode==6)return projection.draw_billboard(vm,mode==6);
    if(mode==5||mode==7)return projection.draw_projected(vm,mode==7);
    if(mode==8)return projection.draw_model(vm);
    return projection.draw_strip(vm,vm.geometry,static_cast<u32>(vm.integer_variables[0])*2);
}
void GraphicsCamera::set_viewport(const CameraViewport& viewport){renderer.device.call(DeviceOperation::Viewport,{address(&viewport)});}
}
