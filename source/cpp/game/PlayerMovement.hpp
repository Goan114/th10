#pragma once
#include "Player.hpp"
#include "AnmManager.hpp"
namespace th10 {
struct PlayerMovementEnvironment {
    const u32* input_keys;
    const i32* enemy_count;
    const float* default_rate;
    GameEconomy* economy;
    AnmManager* manager;
    AnmFile* effect_file;
    AnmEnvironment* animations;
    AnmAllocationEnvironment* allocation;
    // Platform adapters may supply a logical-frame analog displacement.
    // The default retains the original keyboard movement unchanged.
    virtual void adapt_movement(Player&,i32&,i32&) {}
    virtual void update_option(PlayerOption& option)=0;
};
}
