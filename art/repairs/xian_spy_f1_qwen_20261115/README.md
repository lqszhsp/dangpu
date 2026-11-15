# xian_spy_f1 白面巾整套重绘

用户指出旧图面巾周围有涂抹状黑色像素。本次使用百炼 `bl image edit`、`qwen-image-3.0-pro` 重绘底图，再从检查过的新底图生成 pleased / angry / afraid / sly / wasted / thrall 六种神态。

保留成熟女性、银饰盘发、深蓝披风、浅蓝长袍、腰带及双手自然垂下的站姿。面巾重画为完整、不透明的白色织物，遮住口鼻和下颌；去除两侧黑色块状涂抹与矩形缺口，神态由露出的眼眉表达。thrall 保留游戏既有的全白眼睛。

七种状态已逐张检查全身、面部和深浅底色下的面巾边缘，并接入本地游戏。仅替换 `xian_spy_f1` 七张 PNG 和七张 WebP；其余 1358 个人物文件保持原字节。全部替换图均有透明通道，高 1300 像素，面巾中央不透明。没有部署。

- [面部新旧对比](comparison-faces.jpg)：上排旧图，下排新图。
- [全身新旧对比](comparison-full.jpg)。
- [深浅背景边缘检查](veil-edges-dark-light.jpg)。
- `provider/*/request.json` 保存完整提示词、种子、参考图及哈希；同目录保留提供方原图与响应。
- `before/` 保留原有 14 个文件，`before.json` 记录替换前全部人物文件哈希。
- `cleaned/` 为去绿后的透明 PNG／WebP；`installed.json` 和 `verification.json` 记录接入及范围校验。

从 `game/` 运行 `python3 tools/cast/repair_spy_f1_qwen.py verify` 可重新校验本次替换、面巾不透明性、原件备份及无关人物文件。原 spy／snake 批次的 xian_spy_f1 成图和接入哈希属于旧版本，已由本目录替代；其他五张面孔保留。
