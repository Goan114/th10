#pragma once
#include "../game/UpdateChain.hpp"
namespace th10::browser {
struct CallbackReceiver {
    virtual bool invoke(CallbackToken token,void* owner,i32& result)=0;
};
struct Callbacks final:UpdateChainEnvironment {
    CallbackReceiver& receiver;u8 depth=0;u32 calls=0;
    explicit Callbacks(CallbackReceiver& receiver):receiver(receiver){lock_depth=&depth;}
    void enter_lock() override {}
    void leave_lock() override {}
    i32 invoke(CallbackToken,void*) override;
    UpdateChainEntry* allocate_entry() override;
    void release_entry(UpdateChainEntry*) override;
};
}
