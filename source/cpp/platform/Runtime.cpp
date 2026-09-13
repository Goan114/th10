// An invalid virtual dispatch is a Wasm trap. Pulling libc++abi's diagnostic
// implementation would otherwise import WASI file descriptors and stderr.
extern "C" [[noreturn]] void __cxa_pure_virtual(){__builtin_trap();}
