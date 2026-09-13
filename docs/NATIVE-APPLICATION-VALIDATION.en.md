# Standalone C++ application validation

[简体中文](NATIVE-APPLICATION-VALIDATION.md) | [English](NATIVE-APPLICATION-VALIDATION.en.md)

The standalone build contains reconstructed game systems, a browser integration layer, and release-verification records. Both Japanese and Simplified Chinese variants run through `site/runtime/native-worker.mjs`, which loads only `th10-game.wasm`, DAT files, music, and pre-baked fonts. It does not load the original executable, D3DX DLL, JIT, or a static instruction executor.

## Evidence layers

| Layer | Evidence | Boundary |
| --- | --- | --- |
| Distribution integrity | `scripts/verify.mjs`, manifests, hashes | Confirms that the supplied source, module, and assets agree; does not execute gameplay |
| Automated regression | 307 checks in `validation/native-complete-regression.log` | Covers named systems and scenarios; not every possible input |
| Original oracle | 96,000 long-run frames and 6,526,503 draw packets across seven stages | Matches named state and rendering observations for fixed inputs |
| Complete scripted flows | Six-stage main game, Extra, and 12 endings | Exercises natural script progression; some flows use test-only invulnerability |
| Real replays | Seven complete high-difficulty replays with zero observed deaths | Uses real long-form inputs; see `REPLAY-VALIDATION.md` |
| Browser acceptance | Local browser demo, touch entry, save and exit | Named local environment only; not a promise for every phone or GPU |

## Recorded coverage

- The first 2,400 frames of every stage were compared across six shot types and five difficulty settings.
- Stage 1 ran for 12,000 frames to its transition request. Stages 2–6 and Extra ran for 14,000 frames each. The seven long runs total 96,000 frames and 6,526,503 draw packets.
- A Normal Reimu A flow progressed naturally through all six stages, an ending, and the clear menu: 76,473 stage frames, 5,582 ending frames, and 5,190,304 draw packets. It used test-only invulnerability but did not change boss HP or transition requests.
- An Extra Marisa B flow progressed through the final spell and clear results: 35,038 frames and 2,864,265 draw packets, also with test-only invulnerability.
- All 12 endings were exercised in both language variants, each for 34,572 frames and 137,196 draw packets. They were created directly and are not counted as complete clears.
- Replay import, preview, playback, end-of-file handling, saving, repeated saving, and return to the replay menu are covered by automated checks.
- Capture and scaling output matched the reference D3DX DLL byte for byte across 108 format, rectangle, size, and filter combinations.
- The 404 supplied source files rebuilt with WASI SDK 34 to the same candidate Wasm bytes recorded by the release.

## Historical records

| File | Contents |
| --- | --- |
| `validation/native-complete-regression.log` | 307 passing checks, zero failures, zero skips |
| `validation/browser-extra-tests.log` | Complete Extra-flow test added after the main regression run |
| `validation/browser-world-long-oracle.log` | Stage 1 long oracle |
| `validation/browser-world-all-long-oracle.log` | Long oracle history, including a Stage 5 diagnostic-budget failure |
| `validation/browser-world-stage5-long-verified.log` | Final passing Stage 5 run with a bounded higher diagnostic budget |
| `validation/source-rebuild.log` | Independent source rebuild record |
| `validation/native-public-port8090-verification.json` | Historical local/public-host packaging checks with the maintainer domain redacted |

The retained Stage 5 failure was caused by a diagnostic executor's ten-million-instruction per-frame budget. Raising that bounded budget to one hundred million allowed all 14,000 frames to pass; game logic was not changed and no comparison was skipped.

## Release identity

- Wasm size: 764,480 bytes.
- Wasm SHA-256: `22d167fdcc3b72d06489c31d32d714d5467ffb6c5b50d86a0433e8b2ec1a7b61`.
- Source files: 404.
- Source/path digest: `5d67f65a27ba7c00d4e99e9907d6f00fd6287c478685cbf715069cb2bc6dda06`.
- Runtime modules: 30.
- Music chunks: 1,541.

Exact current values are machine-readable in `release.json` and `source/build-report.json`.

## Limits

The evidence supports behavior matching as accurately as demonstrated within its stated observations and inputs. It does not exhaust every shot type, difficulty, replay, and input combination; it does not prove zero differences under every browser scheduling condition; and it does not guarantee rendering, audio, or frame rate on every phone and GPU. The project-authored class and field names are not claimed to be the original author's symbols.
