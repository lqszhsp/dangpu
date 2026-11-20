#!/usr/bin/env node
// 养蛊人实测：在无界面 Firefox 里点真按钮玩，逐项验证蛊虫精通、下蛊、情蛊、执法堂隐藏线；拾荒客的炼器台补料。
//   SAVE=<存档 JSON> node tools/playtest/gu/run.mjs <段落.js> [超时毫秒]
//   段落：p2_ABC.js（独门、成算、驾驭、下蛊、跌一境、不笑、差遣、不致死）p2_D.js（中蛊少识破）gift_odds.js（送礼单上的识破几率）
//         p2_E.js（蛊可加料）p2_FG.js（炼情蛊、只认成年女子、一生一人、好感锁、脸红）p3_law_love.js（执法堂察觉、冷翡、免狱、情蛊同命）
//         digger.js（拾荒客，不用存档）
//   存档用一局真实的养蛊人第 30 日（Codex 试玩里用 play.mjs dumpat 30 导出）。不得不直接改状态的地方一律记“加速”。
import fs from 'node:fs';
import { browserRun } from '../../lib/launch.mjs';
const helpers = fs.readFileSync(new URL('./helpers.js', import.meta.url), 'utf8');
const phase = fs.readFileSync(new URL(`./${process.argv[2]}`, import.meta.url), 'utf8');
const save = process.env.SAVE ? `window.__SAVE = ${JSON.stringify(fs.readFileSync(process.env.SAVE, 'utf8'))};\n` : '';
const r = await browserRun(`${save}${helpers}\n try { ${phase} } catch (e) { note('EXCEPTION ' + (e && e.stack || e)); }\n return { log: L, checks };`, { timeout: +(process.argv[3] || 1500000) });
if (r.result.fatal) console.log('FATAL', r.result.fatal);
for (const l of r.result.log || []) console.log(l);
const cs = r.result.checks || [];
console.log(`\n${cs.filter(c => c.ok).length}/${cs.length} 项通过`);
for (const c of cs.filter(c => !c.ok)) console.log(`✗ ${c.name}：${c.detail}`);
if (r.errors.length) console.log('页面报错：', r.errors.slice(0, 5));
