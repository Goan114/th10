import {NativeFileStore} from './native-file-store.mjs';
import {NativeGraphics} from './native-graphics.mjs';
import {NativeFonts} from './native-fonts.mjs';
import {NativeAudio} from './native-audio.mjs';
import {NativeTime} from './native-time.mjs';
// Component composition for the independent C++ runtime. It deliberately has
// no machine/PE/DLL loader; all components share ordinary native Wasm memory.
export async function createNativePlatform(module,{files=new Map(),fontBackend,onWrite,timezoneMinutes,now,monotonic}={}){
  const store=new NativeFileStore(files,{onWrite}),graphics=new NativeGraphics(),fonts=new NativeFonts(fontBackend),audio=new NativeAudio();
  const time=new NativeTime({timezoneMinutes,now,monotonic});
  const imports={...store.imports(),th10_graphics:graphics.imports(),th10_fonts:fonts.imports(),th10_audio:audio.imports(),th10_time:time.imports()};
  const result=await WebAssembly.instantiate(module,imports),instance=result.instance??result,exports=instance.exports;
  store.bind(exports.memory);graphics.bind(exports);fonts.bind(exports);audio.bind(exports);time.bind(exports.memory);return {exports,store,graphics,fonts,audio,time};
}
