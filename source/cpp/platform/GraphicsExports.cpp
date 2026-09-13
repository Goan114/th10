#include "Graphics.hpp"
#include <new>
#include <cstdlib>
using namespace th10;
extern "C" {
__attribute__((import_module("th10_graphics"),import_name("create"))) u32 graphics_host_create(const browser::GraphicsPresentation*,u32);
__attribute__((import_module("th10_graphics"),import_name("device"))) i32 graphics_host_device(u32,u32,const u32*);
__attribute__((import_module("th10_graphics"),import_name("resource"))) i32 graphics_host_resource(u32,u32,const u32*);
}
namespace {
struct Host final:browser::GraphicsHost {
    u32 create_device(const browser::GraphicsPresentation& value,u32 flags) override{return graphics_host_create(&value,flags);}
    i32 device(u32 handle,browser::DeviceOperation operation,const u32* arguments) override{return graphics_host_device(handle,static_cast<u32>(operation),arguments);}
    i32 resource(u32 handle,browser::ResourceOperation operation,const u32* arguments) override{return graphics_host_resource(handle,static_cast<u32>(operation),arguments);}
} host;
}
#define GRAPHICS_EXPORT(name) extern "C" __attribute__((export_name(name)))
GRAPHICS_EXPORT("graphics_allocate") void* graphics_allocate(u32 bytes){return std::calloc(1,bytes);}
GRAPHICS_EXPORT("graphics_free") void graphics_free(void* bytes){std::free(bytes);}
GRAPHICS_EXPORT("graphics_configure_arithmetic") void graphics_configure_arithmetic(u32 flags){if(!(flags&2))arithmetic_mode(Precision::Single,Rounding::NearestEven);}
GRAPHICS_EXPORT("graphics_arithmetic_mode") void graphics_arithmetic_mode(u32 precision,u32 rounding){arithmetic_mode(static_cast<Precision>(precision),static_cast<Rounding>(rounding));}
GRAPHICS_EXPORT("graphics_create") browser::GraphicsDevice* graphics_create(const browser::GraphicsPresentation* params,u32 flags){
    auto* bytes=std::malloc(sizeof(browser::GraphicsDevice));if(!bytes)return nullptr;
    auto* device=new(bytes)browser::GraphicsDevice(host);device->initialize(*params,flags);return device;
}
GRAPHICS_EXPORT("graphics_destroy") void graphics_destroy(browser::GraphicsDevice* device){if(device){device->release();device->~GraphicsDevice();std::free(device);}}
GRAPHICS_EXPORT("graphics_device") i32 graphics_device(browser::GraphicsDevice* device,u32 operation,const u32* arguments){return host.device(device->handle,static_cast<browser::DeviceOperation>(operation),arguments);}
GRAPHICS_EXPORT("graphics_resource") i32 graphics_resource(u32 handle,u32 operation,const u32* arguments){return host.resource(handle,static_cast<browser::ResourceOperation>(operation),arguments);}
GRAPHICS_EXPORT("graphics_draw") i32 graphics_draw(browser::GraphicsDevice* device,AnmManager* manager,AnmVm* vm,Camera* camera,Camera* world,AnmVertex* quad,u32 operation){
    browser::GraphicsRenderer environment(*device,*manager,*camera,*world,quad);AnmRenderer renderer{*manager,environment};
    if(operation==0){renderer.begin_frame();return 0;}if(operation==1){renderer.flush();return 0;}return renderer.draw(*vm);
}
GRAPHICS_EXPORT("graphics_camera") void graphics_camera(browser::GraphicsDevice* device,AnmManager* manager,Camera* camera,Camera* world,AnmVertex* quad,u32 flat){
    browser::GraphicsRenderer renderer(*device,*manager,*camera,*world,quad);browser::GraphicsCamera environment(renderer);
    if(flat)camera->configure_flat(environment);else camera->configure_world(environment);
}
