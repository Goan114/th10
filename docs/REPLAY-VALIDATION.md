# Real-player replay validation ledger

[English](REPLAY-VALIDATION.md) | [简体中文](REPLAY-VALIDATION.zh-CN.md)

This document is purely a consistency check, not a reconstruction procedure that compares each implementation step with the original game. It therefore uses a deliberately simple shortcut: if a no-miss replay produces a death, the implementation goes straight back for repair. None did.

## Six-stage Lunatic run

| Player / label | Shot type | Final score | Deaths |
| --- | --- | ---: | ---: |
| Pearl NN | Reimu B | 134,340,180 | **0** |

The corresponding reference replay is `th10_ud84RB.rpy`, 70,639 bytes, with SHA-256 `1ae670e9da12d4e24fb65596ad13369569f9831a404b01b17307fb00ee9fb464`. Its readable metadata contains `Score 134340182`, recorded separately from the final in-game display of 134,340,180.

## Complete no-miss Extra replays

These replays came from the [Silent Selene](https://www.silentselene.net/) / [RoyalFlare Archive](https://maribelhearn.com/royalflare/th10) collection.

Their original comments describe them as no-miss runs, and complete playback in the standalone version also produced zero observed deaths.

| Player | Shot type | Final score | Deaths | Result |
| --- | --- | ---: | ---: | --- |
| Yuyumaru | Reimu A | 987,343,680 | **0** | Extra clear |
| GEPPO | Marisa C | 969,310,230 | **0** | Extra clear |
| EBI | Reimu B | 967,537,530 | **0** | Extra clear |

## No-miss Lunatic replays with bombs

This group deliberately covers long zero-death runs in which resources, bombs, and scoring state continue to change.

| Player | Shot type | Final score | Deaths | Additional consistency evidence |
| --- | --- | ---: | ---: | --- |
| K・G | Marisa C | 2,191,458,180 | **0** | Final score matches |
| K・G | Reimu B | 2,171,052,580 | **0** | Final score matches |
| AMAMIHRK | Reimu B | 2,154,730,490 | **0** | Final score matches |

