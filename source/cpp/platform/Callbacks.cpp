#include "Callbacks.hpp"
#include <cstdlib>
namespace th10::browser {
i32 Callbacks::invoke(CallbackToken token,void* owner){i32 result=0;++calls;if(!receiver.invoke(token,owner,result))__builtin_trap();return result;}
UpdateChainEntry* Callbacks::allocate_entry(){return static_cast<UpdateChainEntry*>(std::calloc(1,sizeof(UpdateChainEntry)));}
void Callbacks::release_entry(UpdateChainEntry* entry){std::free(entry);}
}
