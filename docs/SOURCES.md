# 来源记录

[简体中文](SOURCES.md) | [English](SOURCES.en.md)

- 2.0.0 独立 C++ 游戏逻辑：根据本地 TH10 1.00a 的反汇编、原资源格式与逐函数/逐帧执行结果恢复 `source/cpp/game`，由 `source/cpp/platform` 接入浏览器。没有采用现成的完整 TH10 C++ 反编译仓库；旧 EXE/DLL 与执行器只用于开发对照，独立游玩包不包含或装载它们。沿用下述 SoftFloat 与工具链来源。最终模块、资源和源码清单校验值见仓库根目录的 `release.json` 与 `source/build-report.json`。

- 游戏程序、DAT、BGM、现成简体汉化文本与图像：用户本地提供的 `[th10] 东方风神录 (汉化版+日文版)`。原作：上海アリス幻樂団 / ZUN。发布内容的版本 SHA-256 见根目录 `release.json` 与 `site/manifest.json`。
- 旧 x86 执行器与对照：[copy/v86](https://github.com/copy/v86)，安装版本 `0.5.458+gd96be77`。2.0.0 的独立 C++ 运行时不加载该执行器；它只存在于原开发环境中，用于诊断和原指令对照，不属于本仓库的运行依赖。所采用 SoftFloat 源码的 BSD-3-Clause 许可保留在源码内，并汇总到 `第三方许可.txt`。
- D3DX9_31 x86：[Microsoft DirectX End-User Runtimes (June 2010)](https://www.microsoft.com/en-us/download/details.aspx?id=8109)。开发期从 Microsoft 原始自解压分发包提取 OCT2006_d3dx9_31_x86.cab 内的 DLL；未执行安装程序。下载包 SHA-256：`053f76dcbb28802e23341b6a787e3b0791c0fa5c8d4d011b1044172dbf89c73b`，Microsoft 数字签名核验通过。该 DLL 只供历史浏览器执行器和 D3DX 行为对照使用，不注册到 Windows，也不属于当前独立 C++ 运行时或本仓库交付内容。
- Direct3D 9 ABI 参考：[Wine d3d9.h](https://github.com/wine-mirror/wine/blob/master/include/d3d9.h)、[d3d9caps.h](https://github.com/wine-mirror/wine/blob/master/include/d3d9caps.h)。运行适配层为本项目代码。
- 游戏状态地址与核对辅助：[touhouworldcup/thprac](https://github.com/touhouworldcup/thprac/blob/master/thprac/src/thprac/thprac_th10.cpp)。仅用于对照版本地址、设置诊断场景；游玩包不包含 thprac 或辅助作弊逻辑。
- 数据格式检查：[thpatch/thtk](https://github.com/thpatch/thtk)。仅开发阶段解包和核对，游玩时直接使用原版 DAT。
- CPU 独立核对：[Unicorn](https://github.com/unicorn-engine/unicorn) / `@alexaltea/unicorn-js 2.1.4`，仅开发测试。
- GDI / 原生 Direct3D 对照：本机 Windows 的 GDI、Direct3D 9。测试窗口隐藏，绘制到离屏表面；所有诊断可执行文件均排除在游玩包之外。
- 1.0.1 文字性能优化：依据本地 TH10 1.00a 与 D3DX9_31 的反汇编和浏览器 CPU 剖析，优化原版透明边缘着色与浮点行运算。缩放系数由原始 DLL 生成后缓存；与未加速指令的输出对照。接口语义核对使用 Microsoft 的 [D3DXLoadSurfaceFromMemory](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dxloadsurfacefrommemory) 与 [D3DX_FILTER](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dx-filter) 文档。
- Node.js `v24.15.0`：用于本机 HTTP 服务，来自当前机器安装的官方运行时，OpenJS Foundation 签名核验有效。许可见 tools/Node.LICENSE。
- Playwright `1.60.0` 与 Koffi `3.2.1`：仅开发测试，不是游玩依赖。

已有妖妖梦和永夜抄网页项目只用于参考通用平台处理方式。没有将它们的角色、关卡脚本、判定或音效规则当作风神录的游戏逻辑。

- 1.0.4 手机交互参考：[YomotsuHisami/eagler-touhou](https://github.com/YomotsuHisami/eagler-touhou) 的项目说明和移动端交互功能，包括触控操作、横竖屏布局与多输入源管理。此次 TH10 触控模块独立实现，未复制该项目的游戏代码或资源；没有加入其自由拖动角色、触控专用录像或布局编辑器。
- 手机浏览器能力核对：[WebKit 关于 OffscreenCanvas WebGL 的说明](https://bugs.webkit.org/show_bug.cgi?id=254071)、[MDN 音频中断状态](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)。实际功能使用能力检测，不依赖浏览器名称放行。

- 1.0.5 手机交互参考进一步核对了 [eagler-touhou 提交 5a73fd3](https://github.com/YomotsuHisami/eagler-touhou/tree/5a73fd3323589b1ba9d08d74c9827191905577f2) 的 `src/launcher` 触控与布局模块（GPL-3.0），以及 [eagler-th07 提交 5f80a0d](https://github.com/YomotsuHisami/eagler-th07/tree/5f80a0df8a8434afd2544d4aaa95691ea4d65f89) 的 Touch / Player / Replay 交互（CC0-1.0）。本项目按这些交互设计独立实现拖动、自动射击、三种低速方式及布局编辑，没有复制其 C++ 游戏系统或 launcher 源码。为保留 TH10 原始速度、八方向输入及原生录像，没有照搬自由角度 / 不限速拖动、触控录像扩展和额外决死时间。
- 1.0.5 C++ 重建：依据本地日文 / 汉化 TH10 1.00a 的原指令及动态结果；开发时使用 Capstone 提取 88 处符合完整结构的内联循环，运行时再次验证签名。当前交付版的覆盖与验证边界见[独立 C++ 游戏入口验证](NATIVE-APPLICATION-VALIDATION.md)。
- C++ 编译器：[官方 WASI SDK 34 Windows x86_64 包](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-34)，采用随附的 clang / LLD 生成不依赖 WASI 导入的 Wasm。下载包本地 SHA-256 为 `cccb5c323a9b34f0349a9b09e8804a0a7632c68c3310f4b5f437ed57d7e71d8f`，不是额外的上游签名验证。SDK 只在开发环境使用，不随本仓库分发；相关运行库许可已汇总到 `第三方许可.txt`。

- 1.1.0 静态 C++ 重建：Capstone 在构建时分析本地 TH10 和 D3DX 的入口、直接调用、跳转表与回调，生成可编译控制流；没有使用现成的完整 TH10 C++ 反编译仓库。指令语义参考 [Intel SDM](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)，浮点兼容对照使用 [v86 d96be77](https://github.com/copy/v86/tree/d96be77) 的 softfloat / fpu / sse 代码，其 BSD 许可和源文件 SHA-256 留在 `reference/v86-rebuild`。
- x87 基本运算使用 Berkeley SoftFloat 3e，来源为上述固定 v86 提交中的 `lib/softfloat/softfloat.c`，SHA-256 为 `c03900abf111b5900303162bf06717c6bb5e4154f42b4980954674b273257367`。原始 BSD-3-Clause 文本完整保留在 `source/cpp/rebuild/third_party/softfloat.c`，去重后的许可块汇总于 `第三方许可.txt`。
- 静态数学库 / 编译器运行库：wasi-sdk-34 固定的 [wasi-libc 2e6fb9d](https://github.com/WebAssembly/wasi-libc/tree/2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13) 和 [LLVM 895aa2c](https://github.com/llvm/llvm-project/tree/895aa2c896ada719451be2e3673c83da8ddf1141)。对应 wasi-libc、musl、cloudlibc、compiler-rt 许可已合并进 `第三方许可.txt`；工具链及其临时参考目录不随本仓库分发。
