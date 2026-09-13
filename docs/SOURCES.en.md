# Provenance record

[简体中文](SOURCES.md) | [English](SOURCES.en.md)

This document records the sources used by the standalone C++ / WebAssembly release. It is a provenance ledger, not a new license for the original game, translation, or third-party material.

## Game and reconstructed logic

- The 2.0.0 standalone game logic in `source/cpp/game` was reconstructed from a local Japanese and Simplified Chinese TH10 v1.00a installation, original resource formats, disassembly, and function- and frame-level observations. `source/cpp/platform` connects that logic to the browser. No complete third-party TH10 C++ decompilation repository was used.
- Original executables, DLLs, legacy execution engines, diagnostic modules, and comparison tools were development references only. They are not loaded by or included as runtime dependencies of the standalone build.
- Game programs, DAT files, BGM, and existing Simplified Chinese text and image resources came from the locally supplied `[th10] 东方风神录 (汉化版+日文版)` package. The original work is by Team Shanghai Alice / ZUN. Hashes for distributed variants are in `release.json` and `site/manifest.json`.
- Existing Touhou 6, 7, and 8 web projects were consulted only for general platform patterns. Their characters, stage scripts, collision rules, and sound rules were not used as TH10 game logic.

## Behavioral and format references

- [touhouworldcup/thprac](https://github.com/touhouworldcup/thprac/blob/master/thprac/src/thprac/thprac_th10.cpp) was used to cross-check version-specific addresses and configure diagnostic scenes. thprac and cheat helpers are not included in the playable package.
- [thpatch/thtk](https://github.com/thpatch/thtk) was used during development to unpack and inspect data formats. The runtime reads the distributed DAT files directly.
- Instruction semantics were checked against the [Intel Software Developer Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html).
- Direct3D 9 ABI behavior was referenced against Wine's [d3d9.h](https://github.com/wine-mirror/wine/blob/master/include/d3d9.h) and [d3d9caps.h](https://github.com/wine-mirror/wine/blob/master/include/d3d9caps.h). Runtime adaptation code is project-authored.
- Surface-loading and filter semantics were checked against Microsoft's [D3DXLoadSurfaceFromMemory](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dxloadsurfacefrommemory) and [D3DX_FILTER](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dx-filter) documentation.
- Development-only CPU comparisons used [copy/v86](https://github.com/copy/v86) at `0.5.458+gd96be77` and Unicorn / `@alexaltea/unicorn-js 2.1.4`.

## Toolchain and third-party code

- The C++ module is built with the official [WASI SDK 34](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-34) using clang and LLD. The locally used Windows x86_64 package had SHA-256 `cccb5c323a9b34f0349a9b09e8804a0a7632c68c3310f4b5f437ed57d7e71d8f`; this is a local download checksum, not an additional upstream signature. The SDK is not distributed in this repository.
- x87 behavior uses Berkeley SoftFloat 3e from the pinned v86 source. Its source is `source/cpp/rebuild/third_party/softfloat.c`, with SHA-256 `c03900abf111b5900303162bf06717c6bb5e4154f42b4980954674b273257367`; the original BSD-3-Clause text remains in that file.
- The static runtime corresponds to wasi-libc commit [`2e6fb9d`](https://github.com/WebAssembly/wasi-libc/tree/2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13) and LLVM commit [`895aa2c`](https://github.com/llvm/llvm-project/tree/895aa2c896ada719451be2e3673c83da8ddf1141).
- The bundled Windows Node.js runtime is v24.15.0. Its notices are in `tools/Node.LICENSE`.
- Consolidated third-party notices are in `第三方许可.txt`. Playwright 1.60.0 and Koffi 3.2.1 were used only in development tests and are not playable-runtime dependencies.

## Browser and mobile references

- Mobile interaction patterns were reviewed against [YomotsuHisami/eagler-touhou](https://github.com/YomotsuHisami/eagler-touhou/tree/5a73fd3323589b1ba9d08d74c9827191905577f2) and [eagler-th07](https://github.com/YomotsuHisami/eagler-th07/tree/5f80a0df8a8434afd2544d4aaa95691ea4d65f89). The TH10 touch implementation was written independently and does not copy those projects' C++ game systems.
- Browser capability behavior was checked against WebKit's [OffscreenCanvas WebGL issue](https://bugs.webkit.org/show_bug.cgi?id=254071) and MDN's [`BaseAudioContext.state`](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state) documentation. Runtime decisions use capability detection rather than browser-name allowlists.

Exact module and source identities are recorded in `release.json` and `source/build-report.json`. Validation scope is documented in `NATIVE-APPLICATION-VALIDATION.en.md`.

