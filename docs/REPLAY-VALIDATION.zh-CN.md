# 实战录像验证账本

[English](REPLAY-VALIDATION.md) | [简体中文](REPLAY-VALIDATION.zh-CN.md)

本篇纯是验证一致性的，而不是一个对照原游戏的还原过程，故而用了一种偷懒的验证方法——如果 No miss 录像出现死亡，就可以直接返修。不过显然，没有。

## 本篇 Lunatic 全六关

| 玩家 / 标签 | 机体 | 最终分数 | 死亡 |
| --- | --- | ---: | ---: |
| Pearl NN | Reimu B | 134,340,180 | **0** |

对应参考录像文件为 `th10_ud84RB.rpy`，大小 70,639 字节，SHA-256 为 `1ae670e9da12d4e24fb65596ad13369569f9831a404b01b17307fb00ee9fb464`。录像内可读元数据写有 `Score 134340182`，与游戏画面最终显示的 134,340,180 分开记录。

## Extra 完整无 miss 录像

这些录像取自 [Silent Selene](https://www.silentselene.net/) / [RoyalFlare Archive](https://maribelhearn.com/royalflare/th10) 的存档。

原注释均自称无 miss，独立版本完整回放也观察到 0 次死亡。

| 玩家 | 机体 | 最终分数 | 死亡 | 结果 |
| --- | --- | ---: | ---: | --- |
| Yuyumaru | Reimu A | 987,343,680 | **0** | Extra clear |
| GEPPO | Marisa C | 969,310,230 | **0** | Extra clear |
| EBI | Reimu B | 967,537,530 | **0** | Extra clear |

## Lunatic 无 miss、使用 bomb

这一组有意覆盖「长流程保持零死亡，但资源、灵击和计分状态持续变化」的输入。

| 玩家 | 机体 | 最终分数 | 死亡 | 其他一致性证据 |
| --- | --- | ---: | ---: | --- |
| K・G | Marisa C | 2,191,458,180 | **0** | 最终分数一致 |
| K・G | Reimu B | 2,171,052,580 | **0** | 最终分数一致 |
| AMAMIHRK | Reimu B | 2,154,730,490 | **0** | 最终分数一致 |

