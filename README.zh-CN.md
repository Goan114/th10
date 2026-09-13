# 東方風神録　～ Mountain of Faith

[English](README.md) | [简体中文](README.zh-CN.md)

一个力求精准地在行为上将 東方風神録　～ Mountain of Faith 中的 th10.exe 还原到 wasm 上的项目。

## 精准行为级还原

「行为级还原」指在已记录的输入和观测范围内，对状态变化、关卡流程、弹幕与碰撞、计分、录像、音频请求、绘制包和浮点行为进行原版对照。

| 证据 | 当前记录 |
| --- | --- |
| 原版长对照 | 七关共 96,000 帧、6,526,503 个绘制包。 |
| 真实玩家录像 | 7 个完整录像，均和原版行为保持一致。[实战录像验证](docs/REPLAY-VALIDATION.zh-CN.md) |

## 快速开始

完整本地包在 Windows 上双击 `start-windows.cmd`。浏览器会打开 <http://127.0.0.1:8090>，包内已附 Node.js。

已有 Node.js 24 时也可以运行：

```sh
npm start
```

## 构建与校验

安装 [WASI SDK 34](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-34)，将 `TH10_WASI_SDK` 设为 SDK 的绝对路径，然后运行：

```powershell
$env:TH10_WASI_SDK = 'C:\dev\wasi-sdk-34.0-x86_64-windows'
.\tools\node.exe scripts\build.mjs
.\tools\node.exe scripts\verify.mjs
```

Linux 和 macOS 可使用对应平台的 WASI SDK 与 Node.js 24。构建会更新 `site/vendor`、网页清单和 `source/build-report.json`。

只校验当前交付内容时运行：

```powershell
.\tools\node.exe scripts\verify.mjs
python scripts\package.py --verify-checksums
```

第一条命令校验源码摘要、wasm、DAT、音乐分块、字库、浏览器依赖和录像账本；第二条核对完整交付目录的 `SHA256SUMS.json`。

## 作为工程基础使用

项目把游戏行为与平台实现分开，适合用于平台移植、兼容性研究等。

- `source/cpp/game`：角色、敌人、弹幕、脚本、场景、菜单、录像、结局与音频控制等游戏逻辑；
- `source/cpp/platform`：对象所有权，以及游戏逻辑与宿主平台的连接；
- `site/runtime`：WebGL、音频、输入、存储、字体和触控等浏览器实现。

修改前请阅读[贡献指南](CONTRIBUTING.md)。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `source/cpp/game` | 恢复后的独立游戏逻辑 |
| `source/cpp/platform` | 平台抽象与浏览器连接 |
| `source/cpp/rebuild/third_party` | 浮点兼容所需的 SoftFloat 源码 |
| `source/scripts` | C++ / Wasm 编译脚本 |
| `site/runtime` | 浏览器宿主源码 |
| `site/data`、`site/fonts` | 本地游戏数据、音乐分块和预烘焙字库 |
| `site/vendor` | 可直接运行的 Wasm 模块 |
| `scripts` | 启动、构建、校验与打包工具 |
| `validation` | 历史回归、对照日志与录像账本 |
| `docs` | 验证边界、来源与资源说明 |
| `tools` | 完整 Windows 包附带的 Node.js 运行时及许可 |

`site` 是部署时的站点根目录。资源 URL 使用 `/runtime`、`/data` 等绝对路径，因此应部署在域名根路径。

## 来源、权利与非官方声明

项目自有代码沿用已经确定的项目许可证。

第三方代码继续适用各自许可证，详见 `第三方许可.txt`、`tools/Node.LICENSE` 和[来源记录](docs/SOURCES.md)。

