#pragma once
#include "Types.hpp"
namespace th10 {
// Callback tokens are resolved by the platform. The development adapter maps
// the executable's callback addresses; a standalone host can use a native table.
using CallbackToken=u32;
struct UpdateChainEntry {
    i32 priority;
    u32 flags;
    CallbackToken callback,initialize_callback,notify_callback;
    ListNode<UpdateChainEntry> node;
    void* owner;
    void initialize() noexcept;
};
static_assert(sizeof(UpdateChainEntry)==0x24);
struct UpdateChainEnvironment {
    u8* lock_depth;
    virtual void enter_lock()=0;
    virtual void leave_lock()=0;
    virtual i32 invoke(CallbackToken callback,void* owner)=0;
    virtual UpdateChainEntry* allocate_entry()=0;
    virtual void release_entry(UpdateChainEntry* entry)=0;
    void lock(){enter_lock();++*lock_depth;}
    void unlock(){leave_lock();--*lock_depth;}
};
struct UpdateChain {
    UpdateChainEntry update,draw;
    void initialize() noexcept;
    i32 insert(UpdateChainEntry& entry,i32 priority,bool drawing,UpdateChainEnvironment& environment);
    i32 run(bool drawing,UpdateChainEnvironment& environment);
    void remove(UpdateChainEntry* entry,UpdateChainEnvironment& environment);
    void remove_locked(UpdateChainEntry* entry,UpdateChainEnvironment& environment);
    UpdateChainEntry* add(CallbackToken callback,void* owner,i32 priority,bool drawing,bool unlocked,UpdateChainEnvironment& environment);
    void clear_list(UpdateChainEntry& sentinel,UpdateChainEnvironment& environment);
    static UpdateChainEntry* allocate(CallbackToken callback,UpdateChainEnvironment& environment);
};
static_assert(sizeof(UpdateChain)==0x48);
}
