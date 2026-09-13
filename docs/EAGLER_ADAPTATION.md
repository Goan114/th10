# TH10 Eagler adaptation

Baseline: `https://github.com/YomotsuHisami/th10`, revision
`e8a939e11d989122eaf83f50cb2849a166a54392`, branch `eagler`.

The Eagler Launcher owns the frontend. Its existing card, toolbar and touch
editor control this Runtime through `eagler-touhou/1`. The Runtime ships the
C++/WASI game module and its required WebGL, audio, font and file adapters;
the upstream standalone page and touch UI are not release inputs.

## Build

```powershell
$env:TH10_WASI_SDK = 'D:\workspace\eagler\toolchains\wasi-sdk-34.0-x86_64-windows'
node scripts/build.mjs
node scripts/build-eagler.mjs
node scripts/prepare-eagler-content.mjs '--original=D:\workspace\original touhou\th10' --output=assets-ogg
```

`build-eagler` verifies the C++ source digest and Wasm identity, then writes a
resource-free directory Runtime and `runtime-files.json`. `assets-ogg/th10.data`
contains the original Japanese DAT bytes, independently supplied by the user;
it is not an executable container. `assets-ogg/bgm-ogg` contains the OGG tracks.
These local outputs are ignored by Git. The Launcher release tooling consumes
explicit Runtime and original-content inputs for hosted, external and import
sites. No command here uploads or deploys.

## Runtime ownership

- `site/runtime/eagler-host.mjs`: common host lifecycle, managed DATA generation,
  resource delivery, input bridge and save commands. Save state uses an isolated
  Eagler IndexedDB store. The exposed FS facade accepts music resources only.
- `site/runtime/eagler-touch.mjs`: the existing Launcher touch vocabulary and
  gestures. Keyboard, touch and pulse ownership stay separate.
- `site/runtime/native-game.mjs` and `source/cpp/platform/EaglerMovement.hpp`:
  logical-frame movement, limited/unlimited direct touch, normal/free joystick.
  Movement goes through the original player's velocity, bounds and options
  update. Live touch cannot alter Replay playback.
- `site/runtime/eagler-music.mjs`: OGG PCM supply for the original audio owner.
  C++ retains track selection, looping, fade and SFX. `none` silences BGM only.
  Streaming retains bounded decode windows; full mode decodes the active track
  and releases inactive full-track PCM. PCM blocks are relative to each track,
  so preparing a track cannot decode its neighbour's tail. Progressive writes
  install compressed bytes; only native-selected tracks are decoded. The title
  entry remains available for synchronous native stream creation, and the last
  file seek identifies the selected track even when its cursor reaches EOF.
  Eagler's audio adapter uses the Launcher decode policy even when an imported
  config requests native preload. Its effective audio flags are shared by
  startup, title, world and HUD; saved configuration and graphics flags remain
  intact. This prevents native preload from permanently caching late OGG as
  silence, and avoids decoding all tracks before startup.

The Launcher card is extracted from `title.anm` in the original `th10.dat`:
`title/title00a.png` (512 x 480) and `title/title00b.png` (128 x 480), placed
at x=0 and x=512 as specified by the original title animation. The shared
`eagler-touhou/scripts/prepare-host-artwork.py` uses thtk and writes
`th10-card.webp`; artwork stays in host-owned resource outputs, outside Git.

For a self-host bundle, `prepare-eagler-content.mjs --runtime=DIR` can use the
packaged TH10 Runtime directly without a source checkout or compiler.

First-stage scope does not add a movement Replay extension. Original Replay
files remain supported; original key-only recordings cannot reproduce arbitrary
direct-touch or free-joystick movement. THPrac, translation packages and
multiplayer are not declared capabilities.

## Validation

The renderer retains the original `bufferData(..., STREAM_DRAW)` upload path
and offset-zero draws. Uniform values are cached separately for each program,
including owned matrix values; inactive uniforms are skipped. Viewport/depth
range, texture sampling parameters and framebuffer depth/stencil attachments
are submitted only when their values change. Clear, copy and presentation keep
their required bindings and write masks. Simulation and shader math are intact.

The synchronous WebGL consumer borrows native vertex memory until `queue`
returns. Ordinary triangle batches copy directly into their reusable staging
buffer. Instanced batches own one geometry snapshot across native calls; other
Direct3D consumers retain the original copied draw-packet contract.

Both direct canvas input and Launcher-forwarded input share a viewport cache.
The first pointer refreshes it; canvas/window size, visual viewport and fullscreen
changes invalidate it. Pointer moves no longer read layout on every event, and
audio resume is requested only by a new interaction while audio is suspended.

`npm run test:renderer` checks mutable uniforms, program changes, framebuffer
attachment transitions and native vertex reuse. These are contract checks, not
physical-device FPS measurements.

```powershell
npm run test:touch
npm run test:renderer
npm run test:music
node scripts/test-eagler-native.mjs '--original=D:\workspace\original touhou\th10'
```

The native test enters Stage 1 through the game menus and checks actual player
displacements. Browser and deployment validation results are recorded separately;
neither source/build tests nor browser automation establishes physical-device
acceptance or public deployment.

Testing resumed on 2026-09-13 after the user reported a startup stall. The old
archive-aligned PCM cache shared blocks between adjacent tracks. Installing each
background OGG invalidated shared blocks and decoded neighbouring tails, blocking
successive native frames for 206–1438 ms in the real Launcher.

With track-relative blocks and native-selected windows, an Edge headless
Launcher comparison reduced initial OGG preparation from 858–940 ms to 51–58 ms.
The final artifact's repeat measured 268–340 ms for OGG and 6.1–6.9 seconds for
asset/font loading; total cold/warm first-frame times were 11.2/9.4 seconds.
After first-frame it continued at 59.7–60.3 FPS through background installation,
with title audio output. These local timings do not establish upstream startup
parity. Launcher runs for `ogg-stream`, `ogg-full` and `none`
entered Stage 1. The music suite also checks PCM equality, backward seek, late
installation, inactive-track isolation, EOF/loop reads and late OGG recovery in
the real C++ game with the original CFG preload bit set.
Local evidence is under `artifacts/validation/startup/` and
`artifacts/validation/launcher/`; physical-device and public deployment acceptance
remain separate. No upload or public deployment was performed.
