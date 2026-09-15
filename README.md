# TH10 portable

This branch contains the source-only TH10 3.5.1 C++/SDL3 portable and Web implementation.

TouhouDev 原作者的完整开发包交付说明已按原文保存在 [TOUHOUDEV-开发交付原文.md](docs/TOUHOUDEV-开发交付原文.md)。原文描述完整开发包；本分支是从中发布的 source-only 子集，因此不包含原文提到的游戏资源、工具链安装目录和既有构建产物。

## Layout

- `th10_web/`: TH10 game, SDL runtime, launcher integration, documentation, and source tests.
- `portable/`: shared GLES renderer, numeric compatibility code, input code, build orchestration, and validation tools.
- `tools/`: the pinned Emscripten installer and its metadata.

## Build

Install the pinned toolchain, then build the browser runtime:

```powershell
python tools/download-emscripten.py
node portable/build.mjs --th10
```

Build outputs are written below `th10_web/artifacts/` and are intentionally not tracked.

## Assets and licensing

This repository does not include original Touhou executable, data, music, replay, or save files. A runnable package must be assembled locally from files you are legally allowed to use.

Licensing is component-specific. Keep the notices and licenses beside each bundled component; no blanket license is asserted for the original game or its assets.
