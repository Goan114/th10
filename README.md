# Touhou Fuujinroku ~ Mountain of Faith

[![QQ Group](https://img.shields.io/badge/QQ_Group-Join-12B7F5?logo=tencentqq&logoColor=white)](https://qm.qq.com/q/kcK8yRmd6o)

[English](README.md) | [简体中文](README.zh-CN.md)

A project that aims to reproduce the behavior of `th10.exe` from *Touhou Fuujinroku ~ Mountain of Faith ver 1.00a* on WebAssembly as accurately as possible.

> [!NOTE]
> Although the code may be difficult to read, the core functionality is now very solid. Improvements are welcome.

## Behavioral reimplementation, as accurately as possible

“Behavioral reimplementation” means comparing state transitions, stage flow, bullets and collision, scoring, replays, audio requests, draw packets, and floating-point behavior with the original under recorded inputs and observations.

Original-game bugs such as Marisa B's abnormal damage are preserved as well. Replays saved by this project can also be played back in the original game **[evidence needed]**.

| Evidence                       | Current record                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Long original-game comparisons | 96,000 frames and 6,526,503 draw packets across all seven stages.                                                     |
| Real-player replays            | 7 complete replays remained basically behaviorally consistent with the original. [Replay validation](docs/REPLAY-VALIDATION.md) |

## Author

Author: [@SteinsGateON](https://space.bilibili.com/34714121) · [Bilibili profile](https://space.bilibili.com/34714121)

![Author @SteinsGateON's Bilibili profile](docs/images/author-bilibili.png)

## Quick start

Open the [GitHub Pages build](https://yomotsuhisami.github.io/th10/) and import a lawfully obtained `th10.dat` (`th10c.dat` for the Simplified Chinese variant). `thbgm.dat` is optional; without it, the game runs silently. Imported files stay in the current browser and are not uploaded.

On Windows, double-click `start-windows.cmd` in the complete local package. Your browser will open <http://127.0.0.1:8090>. Node.js is included in the package.

If Node.js 24 is already installed, you can also run:

```sh
npm start
```

## Build and verify

Install [WASI SDK 34](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-34), set `TH10_WASI_SDK` to the SDK's absolute path, and run:

```powershell
$env:TH10_WASI_SDK = 'C:\dev\wasi-sdk-34.0-x86_64-windows'
.\tools\node.exe scripts\build.mjs
.\tools\node.exe scripts\verify.mjs
```

Linux and macOS can use the corresponding WASI SDK package with Node.js 24. A build updates `site/vendor`, the web manifest, and `source/build-report.json`.

To verify the current distribution without rebuilding, run:

```powershell
.\tools\node.exe scripts\verify.mjs
python scripts\package.py --verify-checksums
```

The first command verifies the source digest, Wasm, DAT files, music chunks, fonts, browser dependencies, and replay ledger. The second checks the complete distribution against `SHA256SUMS.json`.

## Use as an engineering foundation

The project separates game behavior from platform implementation, making it suitable for platform ports, compatibility research, and similar work.

- `source/cpp/game`: game logic for players, enemies, bullets, scripts, scenes, menus, replays, endings, audio control, and more;
- `source/cpp/platform`: object ownership and the connection between game logic and the host platform;
- `site/runtime`: browser implementations for WebGL, audio, input, storage, fonts, and touch controls.

Read the [contribution guide](CONTRIBUTING.en.md) before making changes.

## Repository layout

| Path                             | Contents                                                               |
| -------------------------------- | ---------------------------------------------------------------------- |
| `source/cpp/game`                | Reimplemented standalone game logic                                    |
| `source/cpp/platform`            | Platform abstraction and browser integration                           |
| `source/cpp/rebuild/third_party` | SoftFloat source required for floating-point compatibility             |
| `source/scripts`                 | C++ / Wasm build scripts                                               |
| `site/runtime`                   | Browser host source                                                    |
| `site/data`, `site/fonts`        | Local game data, music chunks, and pre-baked fonts                     |
| `site/vendor`                    | Ready-to-run Wasm module                                               |
| `scripts`                        | Serving, building, verification, and packaging tools                   |
| `validation`                     | Historical regressions, comparison logs, and replay ledger             |
| `docs`                           | Validation boundaries, provenance, and asset documentation             |
| `tools`                          | Node.js runtime and license included with the complete Windows package |

`site` is the deployment root. Resource URLs are relative to it, so the site works either at a domain root or under a project path such as GitHub Pages.

## Provenance, rights, and unofficial status

Project-authored code follows the project's established license.

Third-party code remains under its respective licenses. See `第三方许可.txt`, `tools/Node.LICENSE`, and the [provenance record](docs/SOURCES.en.md).
