# 《魔门当铺·来路不明》美术规范：真人写实 · 东方玄幻

所有正式美术由 GPT-image 生成（本机 Codex 技能 `gpt-image`），风格像一部高预算古装玄幻剧的剧照：
真人演员、真实布料与金属、电影级打光；东方元素与玄幻元素大量叠加；基调暗、冷，血月红与魔宗紫。
旧的手绘 SVG 留作兜底：某张写实图还没生成时，界面自动退回同名 SVG。

## 流程

```bash
source ~/.profile                                   # GPT_IMAGE_BASE_URL / GPT_IMAGE_API_KEY
python3 tools/art/build_manifest.py                 # 由 tools/art/specs.py 生成 art/manifest.json
python3 ~/.codex/skills/gpt-image/scripts/gpt_image.py batch art/manifest.json --jobs 4   # 出原图到 art/raw/（可反复续跑）
python3 tools/art/postprocess.py --sheets /tmp/sheets   # 转 webp 到 assets/，写 assets/art.js，出联系表
```

不合格的图：删掉 `art/raw/<目录>/<名字>.png`，再跑 batch 与 postprocess。改画面描述改 `tools/art/specs.py`。
`art/` 目录只在本地，不部署。

## 资产与变体

| 目录 | 底图 | 变体（以底图为参考改图，保持同一人/同一物） | 处理 |
| --- | --- | --- | --- |
| `chars/` | 全身站立、正对镜头、透明底；泛泛之辈每种身份多两张脸 `_f1` `_f2` | 神态 `_pleased` `_angry` `_afraid` `_sly` `_wasted`（成瘾、病弱）`_thrall`（受控） | 裁透明边，高 1300 |
| `items/` | 中等品相、透明底 | 品相 `_low` `_high` `_top`；状态 `_revealed`（假货露馅）`_rotting` `_charged` `_dim` `_expired` `_sprout` `_young` | 每格 256px 居中 |
| `machines/` | 停着 | `_running`（开炉、灵气流转） | 512 |
| `scene/` | `shop_front`：掌柜视角，隔着自家柜台望向店门与街面 | 柜台前景 `counter_top` 由同一张图切出 | 1536×1024 |
| `ui/` | 图标 | — | 128 |

## 取图规则（`js/look.js`）

- `asset(dir, 'base~variant')`：依次试 `base_variant.webp`、`base.webp`、`base.svg`。
- 物品：看得见的状态优先，否则按“看上去”的品相——以次充好的货与真货长得一样；加了料的货外观不变。
- 人物：同一个人始终是同一张脸（`p.face`）；神态按受控 > 形销骨立 > 当下情绪 > 交情。
- 站位：柜台前（腰以下被柜台挡住）、门口（求助的、拒绝交易的、被冒犯的）、门外（夜里的来客）。下两位候着的客人以暗影站在门外。
- 鉴宝小游戏的图谱（`js/art.js`）仍是矢量图：真伪特征必须逐处精确，生成图做不到。
