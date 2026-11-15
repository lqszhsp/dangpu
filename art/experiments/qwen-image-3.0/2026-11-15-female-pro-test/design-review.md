# 按现有设计补齐人物变体：Qwen Image 3.0 Pro

本轮在既有秋篆、照微两张实验底图上各补三种已设计状态，共新增 6 张；加上首轮 8 张，测试集现为 14 张。仅验证这两位实验人物，不据此推断全部正式角色都能稳定复现。

## 设计依据

- [`game/tools/art/specs.py` 的 `MOODS`](../../../../tools/art/specs.py)：正式人物共有 pleased、angry、afraid、sly、wasted、thrall 六种变体。
- [`build_manifest.py`](../../../../tools/art/build_manifest.py)：每种变体直接参考该人物底图，保持同一演员、服装、构图、机位和光线，只改变表情与状态。
- [`js/look.js` 的 `moodOf`](../../../../js/look.js)：受控优先于病弱，之后才是情绪／交情；贵客可取 sly，成瘾程度至少 2 或健康低于 40 取 wasted，controlled 或 soulBound 取 thrall。
- [`assets/STYLE.md`](../../../../assets/STYLE.md)：真人写实东方玄幻，全身立绘，暖红主光、冷紫轮廓光。

已查看现有 `noble_f2_sly.png`、`noble_f2_wasted.png`、`noble_f2_thrall.png`，以确认设计的视觉含义。生成时引用实验人物自己的底图，避免把示例角色的脸或服饰带入结果。正式定义原文与来源文件哈希见 [variant-design.json](variant-design.json)；每张实际提示词、底图路径及底图哈希见 `provider/*/request.json`。

## 逐类结果

| 现有类型 | 正式设计特征 | 秋篆观察 | 照微观察 | 本轮判断 |
| --- | --- | --- | --- | --- |
| sly / 狡黠 | 算计的半笑、眯起的眼睛 | 单侧嘴角上提、眼神更窄，仍可辨识原人物 | 半笑与挑眉明显，服装与提灯保留 | 可生成可辨识状态；眯眼强度较克制 |
| wasted / 形销骨立 | 凹颊、黑眼圈、出汗、颤抖、病白肤色 | 面颊消瘦、眼圈加重、肤色灰白 | 凹颊、深眼圈和病白肤色明显 | 主要病弱特征成立；汗珠弱，静态图不足以验证颤抖 |
| thrall / 受控 | 无瞳乳白眼、呆滞面容、面颈黑脉、头部淡暗雾 | 白眼、面颈黑纹及原图暗雾明显，头部位置有变化 | 白眼、黑纹、原图暗雾明显，脸部比例和发型略漂移 | 可生成主要受控特征；黑纹偏裂纹、头身比例有漂移，抠图丢失较多暗雾 |

查看[新增状态全身对照](designed-variants.jpg)和[面部对照](designed-faces.jpg)。列顺序固定为 neutral、sly、wasted、thrall；上排秋篆，下排照微。

## 模型与后期的区别

受控 PNG 原图中能看到头周暗雾。绿色背景抠图会把混合了绿色的半透明暗雾一并削弱，因此 WebP 中暗雾不足包含后期损失，不能直接认定模型没有生成。原图位于 `provider/exp_qiuzhuan_thrall/exp_qiuzhuan_thrall.png` 与 `provider/exp_zhaowei_thrall/exp_zhaowei_thrall.png`，保留供后续处理对照。

当前仅作独立测试，未调整正式后处理或接入游戏。全身与面部对照均已目视检查；文件完整性、原图／WebP 哈希、透明通道与 1300 像素高度通过本地验证。细节、暗雾透明度及游戏内显示仍需后续验收。
