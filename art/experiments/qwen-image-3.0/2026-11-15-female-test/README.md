# Qwen Image 3.0 女性人物独立测试

日期：2026-11-15。**实验未接入游戏，当前成功生成图片 0 张。**

## 隔离范围

本次新增文件全部位于此目录。未修改正式 `assets/`、`art/raw/`、`art/manifest.json`、`assets/art.js`、`tools/art/` 或 `js/`，没有启动、终止或修改其他正在运行的美术任务。`references/` 只是从已有原图制作的风格参考快照，不是本次生成结果。

测试使用 `exp_` 名称，不占用任何正式角色 ID，也不修改 `_f1`、`_f2` 等既有面孔。不调用现有全量后期脚本；将来产出的测试抠图也只落在本目录 `cutouts/`。

## 已准备的角色和变体

| 测试人物 | 独立设定 | 计划状态 |
| --- | --- | --- |
| `exp_qiuzhuan` / 秋篆 | 42 岁女符箓修补师；灰紫旧袍、暗朱窄袖、铜簪与修符工具 | neutral / pleased / angry / afraid |
| `exp_zhaowei` / 照微 | 28 岁女夜巡灯使；深靛披肩、墨灰长衣、铜灯与眉尾旧疤 | neutral / pleased / angry / afraid |

计划共 8 张，未批量发起。画风沿用现有真人写实东方玄幻、暖红主光与冷紫轮廓光、完整全身站立。底图用现有图作摄影风格参考、换成新的脸与衣着；表情变体依赖各自成功生成的底图，以尽量保持身份一致。绿色底生成后仅在本目录做透明抠图、缩放为高 1300 的 WebP。

完整角色描述、画风提示词、参数见 [plan.json](plan.json)，脚本见 [run_test.py](run_test.py)。

## 当前阻塞与已做检查

- 已使用 `bailian-gen` / `bailian-protocol`，CLI 和技能均为 2.9.0；npm 当时查询的版本为 1.18.0，未升级或修改 CLI。
- 当前环境只有 Token Plan 类型的 `DASHSCOPE_API_KEY`；去除环境覆盖后，默认 Profile 没有普通 API Key。没有修改凭据或全局 Profile。
- 普通 DashScope 端点的本地文件改图被 CLI 在上传前拦截，提示 Token Plan 不支持临时文件上传。
- 通过图像数据请求普通端点返回 HTTP 401 `InvalidApiKey`，证实不能把 Token Plan Key 用作普通百炼 Key。
- 按 CLI 自带 preset 使用 Token Plan 北京端点，分别尝试 **qwen-image-3.0 改图和文生图**，均返回 HTTP 404 `InvalidParameter` / `Model not exist.`。
- 以上没有获得成功生成结果；没有擅自换用另一个模型或服务商。失败属于鉴权／模型可用性问题，未提交外部 CLI issue。

请求与原始错误保存在 `attempts/`，不含明文 API Key。远端返回错误不用于推断实际计费；本次未查询计费数据。

## 恢复条件与执行

需要先在运行环境或 CLI Profile 中配置**可调用 qwen-image-3.0 的普通百炼 API Key**。不要把凭据写进项目文件。普通 Key 配置好后从项目根目录执行：

```bash
python3 game/art/experiments/qwen-image-3.0/2026-11-15-female-test/run_test.py --generate bases --role qiuzhuan --jobs 1
```

先检查首张是否完整全身、符合画风；满意后再进行其余测试：

```bash
python3 game/art/experiments/qwen-image-3.0/2026-11-15-female-test/run_test.py --generate all --jobs 2
python3 game/art/experiments/qwen-image-3.0/2026-11-15-female-test/run_test.py --preview
```

生成会调用百炼服务并可能计费。脚本默认跳过已成功的输出，发现未决请求则停止，避免中断后重复计费。所有输出仍是独立实验，不会自动复制到正式资产中。未来生成后还需人工检查人物一致性、表情辨识、手部、脚部和透明边缘；当前未形成任何质量结论。
