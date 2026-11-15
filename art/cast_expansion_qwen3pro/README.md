# 55 位生态角色 · Qwen Image 3.0 Pro 扩展批次

本批次按照 `dangpu-character` 人物技能实现，生图服务遵照用户指定，使用百炼 **qwen-image-3.0-pro**，不使用技能默认的 GPT-image。

已完成生成、验收与本地接入：55 张底图 + 330 张同人状态 = **385 张**。逐图成功记录在 `provider/*/complete.json`。`references/` 是底图清理后的派生参考，不是额外生图。

### 2026-11-15 续接核对

实际已完成 **385/385 张**提供方成图，55 人七状态齐套；全部完成全身／面部联系表检查、去绿、真 PNG／透明 WebP 转换并接入本地游戏。最后补齐白传灯五种状态，宋云游、余望川、苏采苓、许行针、石捡阵和圆行亦已齐套接入。没有部署。

- [continuation.json](continuation.json)：待生成清单已清空，未决标记为零。两次旧中断请求已保留到 `attempts/*-interrupted-20261115/`；只留下请求及 `in-flight` 标记，没有响应、图片、任务 ID 或可匹配的完成日志，旧请求是否计费仍未知。检查恢复途径后，按已获授权补齐两张交付图，详见 [interrupted-request-recovery.json](interrupted-request-recovery.json)。
- [resume-verification.json](resume-verification.json)：385 对 PNG／WebP 的编码、透明通道、高 1300、源图及运行图哈希、游戏清单登记检查均通过。续接前已有的 725 个人物文件中，709 个保持原字节；另 16 个为明确要求修复的女散修虚弱态 PNG／WebP，以及后续指出面巾黑色像素的 `xian_spy_f1` 七种状态 PNG／WebP，原件全部归档并校验。后者详见 [Qwen 重绘记录](../repairs/xian_spy_f1_qwen_20261115/README.md)。
- [resume-game-checks.json](resume-game-checks.json)：55 人、385 条确定性分支测试通过；55 位人物均通过七结局穷举及 6 局、每局 200 天的模拟。全量检查退出码为 0，无缺图、无意外失败；完整输出在 `resume-cast-check.log`。
- [resume-baseline-20261115.json](resume-baseline-20261115.json)：此次接入前的现有人物文件哈希。`tools/cast/resume_qwen_assets.py` 只做本地断点整理、齐套安装与验证，不发云端请求。
- 云端版本预检：CLI／技能／npm 均为 2.10.1；本批续补使用 `bl image edit` 与既有 `qwen-image-3.0-pro`，不更换提供方。
- 旧待办中的 `xian_spy` 修复已由后续明确要求的 GPT-image spy／snake 修复覆盖，不再执行旧的 70% 透明面巾方案。`ren_cultivator_f2_wasted` 已在本批完成后用 Qwen 修复换脸和多手问题，保持底图人物、衣着、抱臂姿势及佩剑；[修复对比](../repairs/ren_cultivator_f2_wasted/comparison.jpg) 从左到右是底图、旧缺陷图、修复图，原件存于该目录 `archive/`。

## 范围和数据

- [roster.json](roster.json)：55 位人物的姓名、性别、年龄、职业、英文造型、处境、施压者、各自结果、需求物品和登场日期。
- 计划分组：人族 9、妖族 12、魔修 10、仙门生态 24。后者包含 6 位无宗门散修；按现有游戏规则，散修接入 `ren`，所以代码阵营实际新增 `ren 15 / yao 12 / mo 10 / xian 18`，没有重复计数。
- 角色定义位于 `game/js/cast/<id>.js`；共用分支逻辑在 `game/js/cast-ecology.js`。每人有独立的职业处境、胁迫文本、成功与失利后果，使用同一套“求助→夜访→核证→后果”的四节点骨架；不是 55 条完全不同结构的长篇剧情。
- 每人有不介入、退回、出卖、卖后补救、临时和解、作证保护、成为耳目等结局；支持公平买卖的单次帮助记录、死亡时收束故事、按职业设置需求物品。
- 故事至少第 9 日起分段登场，概率 0.4，本扩展同时最多四条进行；没安装底图者不提前来访。其余故事和已有人物不覆盖。

## 资产流程

使用 `bl image generate` 生成底图，`bl image edit` 编辑六种现有状态：pleased / angry / afraid / sly / wasted / thrall。状态定义来自 `game/tools/art/specs.py` 的 `MOODS`，不另增换装或战斗状态。

本批次先保留 `provider/` 原始输出与请求、响应、种子和 SHA256；仅对生成子进程去掉代理环境变量，并使用 Token Plan 端点，不改全局配置或凭据。观察到请求频率限制后，采用每次提交至少间隔 7 秒、最多四个并发；限流拒绝记录保存在 `attempts/`。

`cutouts/` 是本批次的透明 WebP，统一高 1300；`references/` 用处理后的底图重新合成干净绿色底，作为同人变体参考。原图会多画游离灯笼，因此后期在去绿后保留最大连通人物，去掉分离的背景道具；人物手持的连通道具保留。半透明暗雾与细发仍可能有损失，需要看联系表验收，不能只凭文件存在判断质量。

完整验收前不把图复制到正式目录。安装只复制本批次的唯一文件名，并向 `assets/art.js` 追加登记；遇到同名异内容立即停止。`baseline-assets.json` 保留安装前 301 张原图和 301 张运行图的哈希，用于确认旧资产未被覆盖。这比先前对账的 294 多了同期新增的鲁半仙 7 张：全部完成后，若无其他并行新增，运行人物图应为 **301 + 385 = 686 张**，不是旧预算中的 679 张。

最早秋篆／照微的 14 张实验图仍在原实验目录，不安装，不计入本批次。

## 命令（从 game/ 目录）

```bash
python3 tools/cast/qwen_batch.py --phase bases --jobs 4
python3 tools/cast/qwen_batch.py --phase variants --jobs 4
python3 tools/cast/qwen_batch.py --phase preview
# 确认联系表与文件校验以后安装；拒绝覆盖不属于本批次的同名文件
python3 tools/cast/qwen_batch.py --phase install
node tools/cast/check_ecology.mjs
node tools/cast/cast.mjs check --days 200 --runs 6
```

后续单角色续补可用 `node tools/cast/cast.mjs art <id>`，工具根据该批人物的 `artProvider`／`artModel` 记录调用 Qwen，不会转用 GPT-image。已有成功记录跳过；遇到未决 `in-flight.json` 必须先检查，不自动重试。不要同时启动多个生图进程。

重绘须先检查远端是否已生成／有任务 ID、归档旧记录，再重跑缺失项；不直接删图或删除未决标记重试。HTTP 429 是服务端明确拒绝，已保留该次记录后降低速率重新提交；未知网络结果不能按同样方式盲重试。

## 检查

- `check_ecology.mjs` 验证 55 人注册、姓名性别与底图映射、七条确定性分支（385 条路径）、灵石／修为条件、公平买卖与死亡钩子、未安装图的登场拦截、四条并行上限。不把内存里的图清单测试夹具冒充真实资产。
- 安装后用人物技能要求的 `cast.mjs check` 穷举和真实日循环模拟；图像编码、透明度、高度、SHA256 与旧资产保护另外校验。
- 修正了人物工具误把 `lu_tiechui.js` 当作 `ui.js` 排除的问题：仅排除精确路径 `js/ui.js`。
- 本轮不部署远端站点，也不自动提交或推送代码。
