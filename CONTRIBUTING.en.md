# Contributing

[简体中文](CONTRIBUTING.md) | [English](CONTRIBUTING.en.md)

Thank you for helping. The most valuable contribution does not broaden a claim; it makes one concrete behavior easier to understand, port, or verify.

## Useful contribution areas

- Reproducible compatibility reports and real-replay results;
- Browser, operating-system, GPU, audio, and input-device adapters;
- Performance and maintainability work that preserves game rules;
- Automated tests, validation tools, and evidence curation;
- Documentation, translation, and accessible input improvements.

## Before starting

1. Read `README.md`, `docs/NATIVE-APPLICATION-VALIDATION.en.md`, and the relevant source area.
2. Search for an existing implementation and reuse the project's abstractions. Do not add a special branch for one replay or device.
3. Identify whether the change belongs to game logic, platform integration, or the browser host.
4. Do not submit original executables, DLLs, private assets, credentials, bulk third-party replay collections, or code with unclear provenance.

## Evidence required for behavioral changes

A change description should include at least:

- Reproduction conditions: version, language, shot type, difficulty, stage, browser, or device;
- The observable difference before and after the change;
- The replay, input sequence, or test scenario used;
- The exact validation commands and results;
- Boundaries that remain untested.

Keep these evidence levels separate:

| Evidence | What it establishes |
| --- | --- |
| `npm run verify` | Internal consistency of current source, modules, and release assets |
| Automated unit or regression test | Compliance with the test contract in a named scenario |
| Instruction- or frame-level oracle comparison | Agreement with the reference for a named input and observation set |
| Complete replay playback | A long, real input reaches the expected outcome and state |
| Browser or physical-device test | Rendering, audio, input, and performance work in the named environment |

## Code constraints

- C++ targets C++17; the current Wasm build disables exceptions and RTTI.
- Preserve fixed timing, replay formats, save formats, and original resource semantics.
- Put platform features in `source/cpp/platform` or `site/runtime`; do not leak them into general game rules.
- Revert a fix attempt once evidence shows it does not help. Do not leave unexplained compatibility branches behind.
- When adding or replacing third-party code, record its pinned version, source, license, and necessary hashes.

## Suggested validation flow

```powershell
.\tools\node.exe scripts\verify.mjs
```

After changing C++, rebuild with WASI SDK 34 and run `verify`. If behavior may change, add the relevant regression or replay evidence. A successful compilation alone is not behavioral validation.

## Languages and documentation

Maintain Simplified Chinese and English versions of core user-facing documentation. Terms, numbers, commands, and evidence boundaries must agree across both versions. Translation-only changes do not require gameplay tests, but links, tables, and commands should still be checked.

## Licensing boundary

Project-authored code follows the project's already established license. That license does not cover the original game, translation assets, or third-party components. Contributions must preserve those separate rights and must not include materials that a contributor may use but may not redistribute.
