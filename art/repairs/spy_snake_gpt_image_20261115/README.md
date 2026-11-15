# Spy / snake 人物立绘修复

后续修订：用户指出 `xian_spy_f1` 面巾周围有涂抹状黑色像素，现已用 Qwen 重画该面孔的七种状态并接入，详见 [xian_spy_f1 新版](../xian_spy_f1_qwen_20261115/README.md)。本目录该面孔的图、接入哈希及预览为历史版本；其余五张面孔保持原字节。

范围：`xian_spy`、`xian_spy_f1`、`xian_spy_f2`、`yao_snake`、`yao_snake_f1`、`yao_snake_f2`，每张面孔包含 neutral / pleased / angry / afraid / sly / wasted / thrall 七种状态。

- Spy：面巾为真实织物，位于口鼻前方，完整遮住口鼻和下颌；避免嘴唇、鼻孔或脸部纹理浮在面巾表面。白巾和黑巾、各自服装及女性身份沿用原设计；神态通过露出的眼睛、眉毛和额头表达。
- Snake：强化双侧面颊、太阳穴、颈部和手部的立体绿色蛇鳞，以及金绿色竖瞳。沿用底图女性、f1 成熟男性、f2 年轻男性身份；thrall 状态仍使用游戏既有的全白眼睛，其余蛇妖特征保留。
- 使用 GPT-image 图生图，以原立绘修复底图，再从修复后的底图派生六种神态，保持同人、同衣、同构图。默认模型 `gpt-image-2.5-sunburst-adobe`；实际每张使用的模型和请求结果见 `batch_log.jsonl`。

生成及接入工具：`tools/cast/repair_spy_snake_gpt.py`。`bases.json`、`opaque-veils.json`、`primary-spy.json`、`variants.json`、`redo-states.json` 保存各阶段完整提示词、尺寸、质量和参考图依赖。主 `xian_spy` 使用 `primary-spy.json` 重新生成；其余底图通过原立绘编辑。`references/` 保存原立绘参考，`generated/` 保存最终选用图；未采用的尝试和抠图前响应保存在 `attempts/`。

```bash
python3 tools/cast/repair_spy_snake_gpt.py prepare
source ~/.profile
python3 ~/.codex/skills/gpt-image/scripts/gpt_image.py batch art/repairs/spy_snake_gpt_image_20261115/bases.json --jobs 4
python3 tools/cast/repair_spy_snake_gpt.py sheets
# 白巾、黑巾的进一步重绘见 opaque-veils.json 和 primary-spy.json。
# normalize 去掉提供方画入的棋盘格；restore-white-veil 保护白巾前景。
# 检视六张底图后再生成神态。
python3 ~/.codex/skills/gpt-image/scripts/gpt_image.py batch art/repairs/spy_snake_gpt_image_20261115/variants.json --jobs 4
python3 tools/cast/repair_spy_snake_gpt.py sheets
# 检视全身及面部状态联系表后接入。
python3 tools/cast/repair_spy_snake_gpt.py install
python3 tools/cast/repair_spy_snake_gpt.py verify
```

`before/` 保存处理前存在的 40 张原 PNG 与全部 42 张运行 WebP；`before.json` 记录处理前人物资源的 SHA-256。原先缺失的 `xian_spy_f1_angry.png`、`xian_spy_f2_sly.png` 已补齐。接入后的资源为 42 张真 PNG 源图和 42 张同名 WebP，保持透明底、运行图高 1300 像素及既有引用。棋盘格抠图时使用已对齐的底图前景保护白巾，避免误删白色布料。

`installed.json` 保存接入后的哈希与范围检查；`verification.json` 保存格式、透明通道、白巾不透明性、尺寸和未涉及人物资源的哈希检查结果。已逐张检视两组全身、面部状态联系表。预览：`base-comparison-faces.jpg`、`base-comparison-full.jpg`、`xian_spy-faces.jpg`、`yao_snake-faces.jpg`。未部署。
