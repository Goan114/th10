#pragma once
#include "Textures.hpp"
#include "FileSystem.hpp"
#include "../game/AnmResources.hpp"
namespace th10::browser {
struct AnimationResources final:AnmResourceEnvironment,AnmTextureEnvironment {
    FileSystem& files;GraphicsDevice& device;AnmManager& manager;u32 loading=0,display=0;Textures textures;
    i32 last_error=-1;
    AnimationResources(FileSystem& files,GraphicsDevice& device,AnmManager& manager,u32 display_flags=0);
    AnmFile* allocate_file() override;
    void* allocate_bytes(u32 size) override;
    void release_file(AnmFile* file) override;
    void release_bytes(void* bytes) override;
    u8* read_file(const char* name,bool external,u32* size) override;
    void release_texture(void* texture) override;
    void report(AnmResourceError error) override {last_error=static_cast<i32>(error);}
    i32 materialize(AnmFile& file,i32 texture,i32 sprite,i32 script,const AnmChunk* chunk) override;
    void wait_for_loading(AnmManager& manager,AnmFile& file) override;
    i32 create_empty(AnmTexture& texture,i32 width,i32 height,i32 format) override {return texture.create_empty(width,height,format,textures);}
    i32 create_encoded(AnmTexture& texture,i32 width,i32 height,i32 format,u32 key) override {return texture.create_encoded(width,height,format,key,textures);}
    i32 create_embedded(AnmTexture& texture,const u8* data,i32 width,i32 height,i32 format) override {return texture.create_embedded(data,width,height,format,textures);}
    void set_priority(void* texture,u32 priority) override;
    void preload(void* texture) override;
    AnmTextureDimensions dimensions(void* texture) override;
    void texture_error(AnmResourceError error,const char*) override {report(error);}
};
}
