#pragma once
#include "../game/GraphicsMath.hpp"
#include <initializer_list>
namespace th10::browser {
enum class DeviceOperation:u32 {TextureStage,Sampler,RenderState,Texture,VertexFormat,Triangles,Transform,Stream,DrawBuffer,Viewport,Clear,Begin,End,Present,BackBuffer,GetTarget,SetTarget,GetDepth,SetDepth,CreateTexture,CreateSurface,CreateTarget,CreateVertices,CreateIndices,Indices,DrawIndexed,DrawIndexedUp,Stretch,UpdateSurface,Reset,Caps,Cooperative,DisplayMode,PixelShader};
enum class ResourceOperation:u32 {AddRef,Release,Description,Surface,LockSurface,UnlockSurface,LockBuffer,UnlockBuffer,Priority,Preload};
struct GraphicsPresentation {u32 width=640,height=480,format=22,back_buffers=1,multisample=0,quality=0,swap_effect=1,window=0,windowed=1,depth_enabled=1,depth_format=80,flags=0,refresh=0,interval=0;};
static_assert(sizeof(GraphicsPresentation)==56);
struct GraphicsHost {
    virtual u32 create_device(const GraphicsPresentation& presentation,u32 flags)=0;
    virtual i32 device(u32 handle,DeviceOperation operation,const u32* arguments)=0;
    virtual i32 resource(u32 handle,ResourceOperation operation,const u32* arguments)=0;
};
struct GraphicsDevice {
    GraphicsHost& host;u32 handle=0;
    explicit GraphicsDevice(GraphicsHost& host):host(host){}
    void initialize(const GraphicsPresentation& presentation,u32 flags=0x40){handle=host.create_device(presentation,flags);}
    i32 call(DeviceOperation operation,std::initializer_list<u32> args={}){return host.device(handle,operation,args.begin());}
    i32 resource(void* value,ResourceOperation operation,std::initializer_list<u32> args={}){return host.resource(static_cast<u32>(reinterpret_cast<uintptr_t>(value)),operation,args.begin());}
    void release(){if(handle){resource(reinterpret_cast<void*>(static_cast<uintptr_t>(handle)),ResourceOperation::Release);handle=0;}}
};
struct GraphicsRenderer final:AnmRenderEnvironment,AnmProjectionEnvironment {
    GraphicsDevice& device;Camera& camera;
    GraphicsRenderer(GraphicsDevice& device,AnmManager& manager,Camera& active,Camera& world,AnmVertex* vertices);
    void texture_stage(u32 stage,u32 setting,u32 value) override;
    void sampler_state(u32 stage,u32 setting,u32 value) override;
    void render_state(u32 setting,u32 value) override;
    void set_texture(void* texture) override;
    void vertex_format(u32 format) override;
    void draw_triangles(u32 primitive,u32 count,const void* vertices,u32 stride) override;
    void set_transform(u32 kind,const Matrix4& matrix) override;
    void stream_source(void* buffer,u32 stride) override;
    void draw_buffer(u32 primitive,u32 first,u32 count) override;
    void rotation(Matrix4& matrix,u32 axis,float radians) override;
    void multiply(Matrix4& output,const Matrix4& first,const Matrix4& second) override;
    void project(Vec3& output,const Vec3& input,const Matrix4& world) override;
    void transform(float* output,const Vec3& input,const Matrix4& world) override;
    i32 special_draw(AnmManager& manager,AnmVm& vm,u32 mode) override;
};
struct GraphicsCamera final:CameraEnvironment {
    GraphicsRenderer& renderer;AnmManager* manager;
    explicit GraphicsCamera(GraphicsRenderer& renderer):renderer(renderer),manager(renderer.global_manager){animation_manager=&manager;render_environment=&renderer;}
    void look_at(Matrix4& matrix,const Vec3& eye,const Vec3& target,const Vec3& up) override {GraphicsMath::look_at(matrix,eye,target,up);}
    void perspective(Matrix4& matrix,float fov,float aspect,float near_plane,float far_plane) override {GraphicsMath::perspective(matrix,fov,aspect,near_plane,far_plane);}
    void normalize(Vec3& value) override {GraphicsMath::normalize(value,value);}
    void set_viewport(const CameraViewport& viewport) override;
};
}
