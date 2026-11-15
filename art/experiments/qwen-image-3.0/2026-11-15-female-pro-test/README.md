# Qwen Image 3.0 Pro 女性人物独立测试

2026-11-15，使用百炼 `bl image generate` / `bl image edit`，模型为 **qwen-image-3.0-pro**。已成功生成 14 张 PNG，并制作 14 张透明 WebP 测试立绘。未接入游戏。

第二轮沿用项目已设计的变体类型，补齐两人的 `_sly`、`_wasted`、`_thrall`，新增 6 张。定义直接取自 `game/tools/art/specs.py` 的 `MOODS`，也检查了 `build_manifest.py` 的改图约束、`js/look.js` 的触发逻辑，以及现有 `noble_f2` 的三个变体原图。没有另行发明换装、受伤或姿态类型。

## 查看结果

- [新增状态全身对照](designed-variants.jpg)与[新增状态面部对照](designed-faces.jpg)：平常、狡黠、形销骨立、受控，秋篆在上、照微在下。
- [设计来源与逐项评价](design-review.md)、[设计定义快照](variant-design.json)：保留正式定义原文、来源文件 SHA256 和验收观察。
- [全身对照图](contact-sheet.jpg)：秋篆在上，照微在下；从左到右为平常、欣喜、愤怒、惊惧、狡黠、形销骨立、受控。
- [面部对照图](faces.jpg)：检查人物身份和表情区别。
- `provider/`：原始 PNG、请求参数、服务响应与完成记录。
- `cutouts/`：绿色背景抠图、边缘去绿、裁切后统一高 1300 的透明 WebP。
- [manifest.json](manifest.json)：图片路径、模型、种子、SHA256 和透明度统计。

| 人物 | 设定 | 成功状态 |
| --- | --- | --- |
| exp_qiuzhuan / 秋篆 | 女符箓修补师，灰紫旧袍、铜簪、纸卷与修符工具 | neutral / pleased / angry / afraid / sly / wasted / thrall |
| exp_zhaowei / 照微 | 女夜巡灯使，深靛披肩、墨灰长衣、铜灯 | neutral / pleased / angry / afraid / sly / wasted / thrall |

## 观察与限制

全身构图、真实布料和暖红／冷紫打光与当前项目方向相符。两位女性的身份、服装和道具在各自变体中基本保持，欣喜、愤怒、惊惧具有清晰区别；仍有轻微衣褶与比例变化，不能当作像素级对齐的表情层。

秋篆的视觉年龄比提示词的 42 岁偏大；照微眉尾旧疤不明显、提灯偏大。这些是模型测试观察，未因此替换或修改正式角色。透明边缘已经查看全身预览，但尚未经过游戏内背景与缩放验收。

秋篆底图使用文生图；照微底图使用既有风格快照作改图参考；六张表情变体均编辑各自新底图。[plan.json](plan.json) 保存原计划，单张实际参数以 `provider/*/request.json` 为准。`references/` 为已有素材快照，不计入新生成张数。

新增六张游戏状态变体同样直接参考各自的平常底图。三种状态均能生成可辨识的视觉区别；`thrall` 原图包含白眼、面颈黑纹与暗雾，但当前绿色抠图会明显损失半透明暗雾，黑纹部分偏裂纹质感。汗珠和颤抖感仍不足以逐项判为通过。不能把生成成功等同于全部细节已达到生产要求。

## 请求与网络

最初本地参考图、缩小参考图和纯文生图三次调用都遇到 `ECONNRESET`，记录保存在 `attempts/`。这些失败未返回图片或任务 ID，不能凭连接重置断言远端没有执行或计费。

随后仅对子进程移除代理环境变量，Token Plan 端点的文生图和改图均成功。没有修改全局代理、凭据或百炼 Profile；不再把此模型判断为不可用。

## 隔离与复现

所有 Pro 输出仅在当前目录，使用 `exp_` 测试 ID；不占用正式角色名额，不修改生产清单、不执行生产后处理，也不干预其他正在运行的生成计划。原 qwen-image-3.0 的失败测试仍在旁边独立目录。

脚本位于 `../2026-11-15-female-test/run_test.py`。在项目根目录运行下列命令可跳过已有成功记录，仅补齐缺失结果；生成调用可能计费。

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy -u ALL_PROXY -u all_proxy \
  python3 game/art/experiments/qwen-image-3.0/2026-11-15-female-test/run_test.py \
  --model qwen-image-3.0-pro --experiment 2026-11-15-female-pro-test --generate all --jobs 2

python3 game/art/experiments/qwen-image-3.0/2026-11-15-female-test/run_test.py \
  --model qwen-image-3.0-pro --experiment 2026-11-15-female-pro-test --preview
```

仅生成本轮已有设计类型时，将 `--generate all` 改为 `--generate variants --states sly wasted thrall`。已有完成记录会跳过。

未决调用有 `in-flight.json` 防重标记，遇到该标记必须先检查记录，不能直接反复提交。
