#!/usr/bin/env node
// 手段监测：每局用过哪些手段（议价、压价、作伪、下药、出卖……）、手段丰富度，按性格汇总。进行中的局也能看。
//   node tools/playtest/monitor.mjs <结果目录> [<结果目录> ...]
// 每局都用它自己那份游戏副本重放（代码以开局时为准），只是换上当前的 play.mjs 来数；不碰正在测的副本
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), PLAY = path.resolve(HERE, '../play/play.mjs'), LIB = path.resolve(HERE, '../lib');
const NAME = { kind: '善良', ruthless: '不择手段', balanced: '权衡' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tactics-'));
// 现行代码里标了恶行的故事选项：选项文字 → 种类。旧版游戏没有这些标签，就拿日志里点过的选项文字来对
const SIN_NAME = { fraud: '欺诈', betray: '出卖', fence: '销赃包庇', harm: '害人' };
const SIN_LABELS = {};
for (const f of fs.readdirSync(path.resolve(HERE, '../../js'), { recursive: true }).filter(f => f.endsWith('.js')))
  for (const m of fs.readFileSync(path.resolve(HERE, '../../js', f), 'utf8').matchAll(/label: (['`])([^'`]+)\1, sin: \['(\w+)'/g)) SIN_LABELS[m[2]] = m[3];

function tactics(base) {
  const game = path.join(base, 'game'), run = path.join(base, 'run'), shadow = path.join(TMP, path.basename(path.dirname(base)) + '-' + path.basename(base));
  fs.mkdirSync(path.join(shadow, 'tools/play'), { recursive: true }); fs.mkdirSync(path.join(shadow, 'assets'), { recursive: true });
  for (const f of ['index.html', 'js', 'assets/art.js']) fs.cpSync(path.join(game, f), path.join(shadow, f), { recursive: true });
  fs.cpSync(LIB, path.join(shadow, 'tools/lib'), { recursive: true });
  fs.copyFileSync(PLAY, path.join(shadow, 'tools/play/play.mjs'));
  let t;
  try { t = JSON.parse(execFileSync('node', [path.join(shadow, 'tools/play/play.mjs'), run, 'tactics'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (e) { return { error: String(e.stderr || e.message).trim().slice(0, 200) }; }
  if (!fs.existsSync(path.join(game, 'js/fate.js'))) {
    // 旧版：故事里的恶行按选项文字补数
    for (const l of fs.readFileSync(path.join(run, 'log.jsonl'), 'utf8').split('\n').filter(Boolean)) {
      const m = JSON.parse(l).cmd.match(/^click (.*)$/); if (!m) continue;
      const b = JSON.parse(m[1]); if (b.act !== 'story-choose') continue;
      const hit = Object.keys(SIN_LABELS).find(lb => lb.length > 2 && b.label.startsWith(lb));   // “收下”这类两个字的太泛，不认
      if (hit) { const k = `恶·故事里作恶：${SIN_NAME[SIN_LABELS[hit]]}`; if (!t.counts[k]) { t.kinds++; t.evilKinds++; } t.counts[k] = (t.counts[k] || 0) + 1; }
    }
  }
  return t;
}

const games = [];
for (const root of process.argv.slice(2)) for (const id of fs.readdirSync(root)) {
  const base = path.join(root, id);
  if (!fs.existsSync(path.join(base, 'run/meta.json'))) continue;
  const started = fs.readFileSync(path.join(base, 'run/log.jsonl'), 'utf8').trim().length > 0;
  const res = fs.existsSync(path.join(base, 'result.json')) ? JSON.parse(fs.readFileSync(path.join(base, 'result.json'), 'utf8')) : null;
  const persona = res ? res.persona : (fs.readFileSync(path.join(base, 'prompt.md'), 'utf8').match(/扮演一位(\S+?)的掌柜/) || [])[1];
  const pk = Object.keys(NAME).find(k => NAME[k] === persona) || persona;
  games.push({ id, persona: pk, done: !!res, started, outcome: res ? res.outcome : started ? '进行中' : '排队中', day: res ? res.day : null, t: started ? tactics(base) : null });
}
fs.rmSync(TMP, { recursive: true, force: true });

const by = {};
for (const g of games.filter(g => g.started)) (by[g.persona] = by[g.persona] || []).push(g);
const queued = games.filter(g => !g.started).length;
const avg = (a, f) => a.length ? (a.reduce((s, x) => s + f(x), 0) / a.length).toFixed(1) : '—';

let out = '## 手段丰富度（按性格）\n\n| 性格 | 局数 | 平均手段种数 | 平均等效种数 | 其中恶手段 | 其中善手段 | 合计用过的手段 |\n| --- | --- | --- | --- | --- | --- | --- |\n';
const allKinds = {};
for (const [pk, gs] of Object.entries(by)) {
  const ok = gs.filter(g => !g.t.error), union = {};
  for (const g of ok) for (const [k, n] of Object.entries(g.t.counts)) union[k] = (union[k] || 0) + n;
  allKinds[pk] = union;
  out += `| ${NAME[pk] || pk} | ${gs.length}${gs.some(g => !g.done) ? `（${gs.filter(g => !g.done).length} 局进行中）` : ''} | ${avg(ok, g => g.t.kinds)} | ${avg(ok, g => g.t.effective)} | ${avg(ok, g => g.t.evilKinds)} | ${avg(ok, g => g.t.goodKinds)} | ${Object.keys(union).length} |\n`;
}
out += (queued ? `\n另有 ${queued} 局还在排队，没算进去。\n` : '') + '\n“等效种数”把用得多的手段权重放大：只靠一两招反复用的低，各种手段都常用的高。\n\n## 各类手段用了多少次（所有局合计）\n\n';
const keys = [...new Set(Object.values(allKinds).flatMap(Object.keys))].sort((a, b) => a.localeCompare(b, 'zh'));
const pks = Object.keys(by);
out += `| 手段 | ${pks.map(k => NAME[k] || k).join(' | ')} |\n| --- | ${pks.map(() => '---').join(' | ')} |\n`;
out += keys.map(k => `| ${k} | ${pks.map(p => allKinds[p][k] || '').join(' | ')} |`).join('\n');
out += '\n\n## 议价\n\n| 性格 | 平均每局报价回合 | 平均卖价/心理价 | 平均收价/开价 | 用过的报价档 |\n| --- | --- | --- | --- | --- |\n';
for (const [pk, gs] of Object.entries(by)) {
  const ok = gs.filter(g => !g.t.error), pre = {};
  for (const g of ok) for (const [k, n] of Object.entries(g.t.haggle.presets)) pre[k] = (pre[k] || 0) + n;
  const sr = ok.map(g => g.t.haggle.sellRatio).filter(x => x != null), br = ok.map(g => g.t.haggle.buyRatio).filter(x => x != null);
  out += `| ${NAME[pk] || pk} | ${avg(ok, g => g.t.haggle.offers)} | ${sr.length ? (sr.reduce((s, x) => s + x, 0) / sr.length).toFixed(2) : '—'} | ${br.length ? (br.reduce((s, x) => s + x, 0) / br.length).toFixed(2) : '—'} | ${Object.entries(pre).map(([k, n]) => `${k} ${n}`).join('、') || '只拖滑杆'} |\n`;
}
out += '\n## 每局\n\n| 开局 | 性格 | 状态 | 种数 | 等效 | 恶 | 善 | 用过的恶手段 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const g of games.filter(g => g.started).sort((a, b) => a.id.localeCompare(b.id) || a.persona.localeCompare(b.persona)))
  out += g.t.error ? `| ${g.id} | ${NAME[g.persona] || g.persona} | ${g.outcome} | ⚠ ${g.t.error} ||||| |\n`
    : `| ${g.id} | ${NAME[g.persona] || g.persona} | ${g.outcome}${g.day ? ` 第${g.day}日` : ''} | ${g.t.kinds} | ${g.t.effective} | ${g.t.evilKinds} | ${g.t.goodKinds} | ${Object.keys(g.t.counts).filter(k => k.startsWith('恶·')).map(k => `${k.slice(2)}×${g.t.counts[k]}`).join('、') || '—'} |\n`;
console.log(out);
