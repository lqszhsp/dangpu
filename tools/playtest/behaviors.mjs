#!/usr/bin/env node
// 多物品行为对账：合成配方、加料、装瓶、封印、抹印、种魂印、破境——程序上能不能成，测试里材料出现过没有、有没有机会、做了几次。
// 找出“代码里有、事实上凑不齐条件”的行为，并写明最常缺的是什么。
//   node tools/playtest/behaviors.mjs <结果目录> [<结果目录> ...] [--out 报告.md]
// 目录在 tools/play/behaviors.js。每局用它自己那份游戏副本重放（换上当前的 tools/play 来数），不碰正在测的副本；
// “程序可行”一栏用当前代码在新开的一局里把材料放齐了真的做一次
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadGame } from '../lib/headless.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), PLAYDIR = path.resolve(HERE, '../play'), LIB = path.resolve(HERE, '../lib');
const argv = process.argv.slice(2), oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv[oi + 1] : null;
const roots = argv.filter((a, i) => !a.startsWith('--') && (oi < 0 || i !== oi + 1));
const NAME = { kind: '善良', ruthless: '不择手段', balanced: '权衡' };

// ───────────── 程序可行：放齐材料真的做一次 ─────────────

function feasibility() {
  const ctx = loadGame([], { quiet: true });
  vm.runInContext(fs.readFileSync(path.join(PLAYDIR, 'behaviors.js'), 'utf8'), ctx);
  // 有的判定掷小数才成（成功率），有的掷小数反而坏事（炸炉、反噬）：几种随机数各试一回，有一回做成就算程序上能成
  return vm.runInContext(`(() => {
    const res = {};
    const give = (id, n = 1, extra = {}, gid) => { const out = []; for (let i = 0; i < n; i++) { const it = makeItem(id, { q: 60, ...extra }); if (!autoPlace(it, gid ? [gid] : ['store', 'floor'])) throw new Error('放不下' + ITEMS[id].name); out.push(it); } return out; };
    const attempt = (b, rv) => {
      newGame('normal', 'apprentice'); S.stones = 99999;
      const r0 = Math.random; Math.random = () => rv;
      try {
        if (b.act) {
          if (b.act === 'lace') { const add = Object.keys(ITEMS).find(id => ITEMS[id].additive === b.kind); const [a] = give(add); const [t] = give('pill_qi'); laceWith(t, a); return t.laced === b.kind; }
          if (b.act === 'bottle') { give('jade_bottle'); const [w] = give('water', 1, { purity: 99.5 }); return !bottle(w) && w.bottled; }
          if (b.act === 'seal') { give('seal_xian'); const [t] = give('sword_std'); return !sealItem(t) && t.sealed; }
          if (b.act === 'erase') { S.tech.erase = 1; const [t] = give('sword_std', 1, { mark: { owner: 'beggar', str: 1 }, stolen: 5 }); return !eraseMark(t) && !t.mark; }
          if (b.act === 'soulmark') { S.tech.soul = 1; S.cult.lv = 3; give('soul_pearl'); const p = Object.values(S.people).find(p => !canSoulMark(p)); const r = p && soulMark(p); return !!(r && !r.err && p.soulBound); }
          if (b.act === 'break') { S.cult.xp = realm().need; give(realm().key); const lv = S.cult.lv, r = breakthrough(); return !r.err && S.cult.lv === lv + 1; }
          return false;
        }
        const a = b.alt[0];
        if (a.tech) S.tech[a.tech[0]] = a.tech[1];
        const m = addMachine(b.machine), live = b.machine === 'pen' || b.machine === 'gupot';
        // 蛊、灵宠要先养到火候才出东西：放进去时就是快成的
        for (const [id, n] of a.has || []) give(id, n, id === 'gu' ? { growth: 95 } : ITEMS[id].cat === 'chong' ? { growth: 60 } : {}, live ? gridOf(m, 'out') : gridOf(m, 'in'));
        for (const [id, n] of a.use || []) give(id, n, id === 'water' ? { purity: 60 } : {}, gridOf(m, 'in'));
        if (b.made.includes('~purify')) give('water', 1, { purity: 60 }, gridOf(m, 'in'));
        if (a.mod) give(a.mod, 1, {}, gridOf(m, 'mod'));
        if (a.modAny) { S.tech.forgery = 1; give(a.modAny, 1, {}, gridOf(m, 'mod')); S.forgeKnown = S.forgeKnown || {}; S.forgeKnown[a.known] = 1; }
        if (a.dressable) give('iron_ingot', 1, { q: 40 }, gridOf(m, 'in'));
        S.retreat = !!a.retreat;
        const outs = () => Object.values(S.items).filter(it => it.pos && [gridOf(m, 'out'), 'floor'].includes(it.pos.g));
        const before = new Set(outs().map(it => it.uid)), water0 = Math.max(0, ...Object.values(S.items).filter(it => it.id === 'water').map(it => it.purity));
        for (let night = 0; night < 6; night++) {
          if (machineCheck(m).ok) machineRun(m);
          const fresh = outs().filter(it => !before.has(it.uid));
          if (fresh.some(it => b.made.includes(it.id) || b.made.includes('*') || (b.made.includes('~fake') && it.fake))
            || (b.made.includes('~purify') && Object.values(S.items).some(it => it.id === 'water' && it.purity > water0))
            || (b.made.includes('~gold_gu') && Object.values(S.items).some(it => it.id === 'gu' && it.growth >= 100))
            || (b.made.includes('~dress') && Object.values(S.items).some(it => it.forged && !it.fake))) return true;
        }
        return false;
      } finally { Math.random = r0; }
    };
    for (const b of BEHAVIORS) {
      let ok = false, err = null;
      for (const rv of [0.01, 0.3, 0.6, 0.99]) { try { if (attempt(b, rv)) { ok = true; break; } } catch (e) { err = e.message; } }
      res[b.id] = ok || (err ? '出错：' + err : false);
    }
    return res;
  })()`, ctx);
}

// ───────────── 每局的漏斗 ─────────────

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'behaviors-'));
function behaviorsOf(base) {
  const shadow = path.join(TMP, path.basename(path.dirname(base)) + '-' + path.basename(base));
  fs.mkdirSync(path.join(shadow, 'tools'), { recursive: true }); fs.mkdirSync(path.join(shadow, 'assets'), { recursive: true });
  for (const f of ['index.html', 'js', 'assets/art.js']) fs.cpSync(path.join(base, 'game', f), path.join(shadow, f), { recursive: true });
  fs.cpSync(LIB, path.join(shadow, 'tools/lib'), { recursive: true });
  fs.cpSync(PLAYDIR, path.join(shadow, 'tools/play'), { recursive: true });
  try { return JSON.parse(execFileSync('node', [path.join(shadow, 'tools/play/play.mjs'), path.join(base, 'run'), 'behaviors'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (e) { return { error: String(e.stderr || e.message).trim().slice(0, 200) }; }
}

const games = [];
for (const root of roots) for (const id of fs.readdirSync(root)) {
  const base = path.join(root, id);
  if (!fs.existsSync(path.join(base, 'run/log.jsonl')) || !fs.readFileSync(path.join(base, 'run/log.jsonl'), 'utf8').trim()) continue;
  const res = fs.existsSync(path.join(base, 'result.json')) ? JSON.parse(fs.readFileSync(path.join(base, 'result.json'), 'utf8')) : null;
  const persona = res ? res.persona : (fs.readFileSync(path.join(base, 'prompt.md'), 'utf8').match(/扮演一位(\S+?)的掌柜/) || [])[1];
  games.push({ id, root: path.basename(root), persona: Object.keys(NAME).find(k => NAME[k] === persona) || persona, done: !!res, b: behaviorsOf(base) });
}
fs.rmSync(TMP, { recursive: true, force: true });
const ok = games.filter(g => !g.b.error), feas = feasibility();

// ───────────── 汇总 ─────────────

const ids = ok.length ? Object.keys(ok[0].b.behaviors) : Object.keys(feas);
const nights = ok.reduce((s, g) => s + g.b.nights, 0);
const rows = ids.map(id => {
  const per = ok.map(g => g.b.behaviors[id]).filter(Boolean), name = per.length ? per[0].name : id;
  const seen = per.filter(x => x.seen).length, oppG = per.filter(x => x.opp).length, oppN = per.reduce((s, x) => s + x.opp, 0);
  const doneG = per.filter(x => x.done).length, doneN = per.reduce((s, x) => s + x.done, 0);
  const miss = {};
  for (const x of per) for (const [k, n] of Object.entries(x.miss || {})) miss[k] = (miss[k] || 0) + n;
  const top = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}（${Math.round(n / Math.max(1, nights - oppN) * 100)}%）`).join('、');
  const f = feas[id];
  const diag = f !== true ? `✗ 程序上做不成${typeof f === 'string' ? `：${f}` : ''}` : !seen ? '⚠ 材料从没凑全过：事实上可能无法发生'
    : !oppG ? '⚠ 材料出现过，条件从没同时凑齐' : !doneG ? '有机会，没人用' : '正常';
  return { id, name, f, seen, oppG, oppN, doneG, doneN, top, diag };
});
const unlisted = {};
for (const g of ok) for (const [k, n] of Object.entries(g.b.unlisted || {})) unlisted[k] = (unlisted[k] || 0) + n;
const order = { '✗': 0, '⚠': 1, '有': 2, '正': 3 };

let md = `## 多物品行为对账

${ok.length} 局（${[...new Set(ok.map(g => g.root))].join('、')}），共 ${nights} 夜${games.length > ok.length ? `；${games.length - ok.length} 局重放出错没算` : ''}。

- **程序可行**：用当前代码新开一局，把材料、设备、手艺放齐了真的做一次，看做不做得成。
- **材料凑全过**：这条行为要的每样东西都在玩家手上出现过（不必同时）的局数。
- **有机会**：设备、材料、手艺、模块同一夜全在手上的局数 / 夜数。
- **做过**：实际做成的局数 / 次数（从真实产出数）。
- **最常缺**：没机会的那些夜里，离做成最近的那种做法缺什么，括号里是占没机会夜数的比例。

| 行为 | 程序可行 | 材料凑全过 | 有机会（局 / 夜） | 做过（局 / 次） | 诊断 | 最常缺 |
| --- | --- | --- | --- | --- | --- | --- |
${rows.sort((a, b) => order[a.diag[0]] - order[b.diag[0]] || a.doneN - b.doneN).map(r => `| ${r.name} | ${r.f === true ? '✓' : '✗'} | ${r.seen} | ${r.oppG} / ${r.oppN} | ${r.doneG} / ${r.doneN} | ${r.diag} | ${r.top || '—'} |`).join('\n')}
${Object.keys(unlisted).length ? `\n**目录没登记的产出**（behaviors.js 该补一条）：${Object.entries(unlisted).map(([k, n]) => `${k} ×${n}`).join('、')}\n` : ''}
### 按性格

| 性格 | 局数 | 做过的行为（种） | 做过的次数 | 其中加料 |
| --- | --- | --- | --- | --- |
${Object.entries(ok.reduce((o, g) => ((o[g.persona] = o[g.persona] || []).push(g), o), {})).map(([pk, gs]) => {
  const kinds = new Set(), lace = gs.reduce((s, g) => s + Object.entries(g.b.behaviors).filter(([k]) => k.startsWith('lace_')).reduce((t, [, x]) => t + x.done, 0), 0);
  let n = 0; for (const g of gs) for (const [k, x] of Object.entries(g.b.behaviors)) if (x.done) { kinds.add(k); n += x.done; }
  return `| ${NAME[pk] || pk} | ${gs.length} | ${kinds.size} | ${n} | ${lace} |`;
}).join('\n')}
`;
if (OUT) fs.writeFileSync(OUT, md);
console.log(md);
