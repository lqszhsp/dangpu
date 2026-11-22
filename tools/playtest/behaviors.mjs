#!/usr/bin/env node
// 多物品行为对账：合成配方、加料、装瓶、封印、抹印、种魂印、破境——程序上能不能成，测试里材料出现过没有、有没有机会、做了几次。
// 找出“代码里有、事实上凑不齐条件”的行为，并写明最常缺的是什么。
//   node tools/playtest/behaviors.mjs <结果目录> [<结果目录> ...] [--out 报告.md]
//   node tools/playtest/behaviors.mjs --check     只做“刻意去凑”：每条行为只走正当渠道做成一次，有做不成的就退出码非零
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
if (!roots.length && !argv.includes('--check')) { console.log('用法：node tools/playtest/behaviors.mjs <结果目录>... [--out 报告.md] | --check'); process.exit(1); }
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
          if (b.act === 'lace') { if (isGuLace(b.kind)) { newGame('normal', 'gu'); S.stones = 99999; S.tech.gumaster = 3; } const add = Object.keys(ITEMS).find(id => ITEMS[id].additive === b.kind); const [a] = give(add); const [t] = give('pill_qi'); laceWith(t, a); return t.laced === b.kind; }
          if (b.act === 'bottle') { give('jade_bottle'); const [w] = give('water', 1, { purity: 99.5 }); return !bottle(w) && w.bottled; }
          if (b.act === 'seal') { give('seal_xian'); const [t] = give('sword_std'); return !sealItem(t) && t.sealed; }
          if (b.act === 'erase') { S.tech.erase = 1; const [t] = give('sword_std', 1, { mark: { owner: 'beggar', str: 1 }, stolen: 5 }); return !eraseMark(t) && !t.mark; }
          if (b.act === 'soulmark') { S.tech.soul = 1; S.cult.lv = 3; give('soul_pearl'); const p = Object.values(S.people).find(p => !canSoulMark(p)); const r = p && soulMark(p); return !!(r && !r.err && p.soulBound); }
          // 下蛊：蛊掺进吃食送出去，对方揣回去吃下才中
          if (b.act === 'plantgu') { newGame('normal', 'gu'); S.stones = 99999; S.cult.lv = 2; Math.random = () => rv; const p = Object.values(S.people).find(p => p.status === 'alive' && !isLawman(p) && npcLevel(p) <= guReach()); p.visits = 1; const [g] = give('gu', 1, { growth: 100, tox: 40 }); const [t] = give('pill_qi'); if (laceWith(t, g) || giveGift(p, t).caught) return false; S.day += 5; eatStash(p); return guBound(p); }
          if (b.act === 'break') { S.cult.xp = realm().need; give(realm().key); const lv = S.cult.lv, r = breakthrough(); return !r.err && S.cult.lv === lv + 1; }
          return false;
        }
        const a = b.alt[0];
        if (a.tech) S.tech[a.tech[0]] = a.tech[1];
        const m = addMachine(b.machine), live = b.machine === 'pen' || b.machine === 'gupot';
        // 蛊、灵宠要先养到火候才出东西：放进去时就是快成的
        // 灵兽圈：灵宠进第一栏，饲料进第一栏的饲料格
        const stalls = !!MACHINES[b.machine].stalls;
        // 蛊盅：蛊养在蛊虫格；封盅斗蛊的先封上
        for (const [id, n] of a.has || []) give(id, n, id === 'gu' ? { growth: 95 } : ITEMS[id].cat === 'chong' ? { growth: 60 } : {}, stalls ? gridOf(m, 'b0') : MACHINES[b.machine].pot ? gridOf(m, 'pot') : live ? gridOf(m, 'out') : gridOf(m, 'in'));
        m.seal = !!a.seal;
        for (const [id, n] of a.use || []) give(id, n, id === 'water' ? { purity: 60 } : {}, stalls ? gridOf(m, 'f0') : gridOf(m, 'in'));
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
            || (b.made.includes('~wandu_gu') && Object.values(S.items).some(it => it.id === 'gu' && guStage(it) >= 2))
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

// ───────────── 刻意去凑：只走正当渠道（买、自己做）做成一次 ─────────────

let DLB_CTX = null;
function dlbCtx() {
  if (DLB_CTX) return DLB_CTX;
  DLB_CTX = loadGame([], { quiet: true });
  vm.runInContext(fs.readFileSync(path.join(PLAYDIR, 'behaviors.js'), 'utf8'), DLB_CTX);
  vm.runInContext(fs.readFileSync(path.join(HERE, 'deliberate.js'), 'utf8'), DLB_CTX, { filename: 'deliberate.js' });
  return DLB_CTX;
}
const deliberate = () => vm.runInContext('deliberateAll()', dlbCtx());
const entries = () => vm.runInContext('startEntries()', dlbCtx());

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
const ok = games.filter(g => !g.b.error), feas = feasibility(), dlb = deliberate();
if (argv.includes('--check')) {
  const bad = Object.entries(dlb).filter(([, x]) => !x.ok);
  const ent = entries(), badStart = ent.flatMap(st => st.groups.filter(g => !g.ok).map(g => `${st.name}·${g.name}`));
  console.log('各开局的起步路线（开局设备至少一条低阶就做得成的行为）：');
  for (const st of ent) console.log(`  ${st.groups.every(g => g.ok) ? '✓' : '✗'} ${st.name.padEnd(5)} ${st.groups.map(g => `${g.name}：${g.ok ? `${g.best.name}（${g.best.days} 天${g.best.rep ? `，魔宗声望 ${g.best.rep}` : ''}），低阶可做 ${g.lowCount}/${g.total}` : '没有低阶就做得成的'}`).join('；')}`);
  console.log('');
  for (const [id, x] of Object.entries(dlb)) console.log(`${x.ok ? '✓' : '✗'} ${(x.tier || '').padEnd(3)} ${id.padEnd(14)} ${x.ok ? `${x.days} 天，${x.spent} 灵石${x.rep ? `，魔宗声望 ${x.rep}` : ''}${x.merit ? `，功勋 ${x.merit}` : ''}` : x.err || '做不成'}  ${Object.entries(x.route).filter(([, v]) => /拾荒|功勋/.test(v)).map(([k, v]) => `${k}←${v}`).join('、')}`);
  console.log(bad.length ? `\n${bad.length} 种行为刻意去凑也做不成` : `\n✓ ${Object.keys(dlb).length} 种行为只走正当渠道都做得成`);
  console.log(badStart.length ? `✗ 这些开局设备起步没有低阶路线：${badStart.join('、')}` : `✓ ${ent.length} 个开局起步都能靠购买和低风险拾荒`);
  process.exit(bad.length || badStart.length ? 1 : 0);
}

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
  const f = feas[id], dx = dlb[id];
  const route = dx && dx.ok ? `✓ ${dx.days} 天${dx.rep ? `·魔宗声望 ${dx.rep}` : ''}` : `✗ ${dx ? dx.err || '做不成' : '—'}`;
  const diag = f !== true ? `✗ 程序上做不成${typeof f === 'string' ? `：${f}` : ''}` : dx && !dx.ok ? '✗ 刻意去凑也凑不齐' : !seen ? '⚠ 材料从没凑全过：事实上可能无法发生'
    : !oppG ? '⚠ 材料出现过，条件从没同时凑齐' : !doneG ? '有机会，没人用' : '正常';
  return { id, name, f, route, seen, oppG, oppN, doneG, doneN, top, diag };
});
// 卡住的材料：各局手上从没出现过的、配方要用的东西，写出代码里它的来路，分清“弄不到”和“没去弄”
const seenAny = new Set(ok.flatMap(g => g.b.seen || []));
function sources() {
  const ctx = loadGame([], { quiet: true });
  vm.runInContext(fs.readFileSync(path.join(PLAYDIR, 'behaviors.js'), 'utf8'), ctx);
  return vm.runInContext(`(() => {
    const src = {}, add = (id, t) => (src[id] = src[id] || []).push(t);
    for (const [id, p, rep] of SUPPLY) add(id, rep > -100 ? '货郎（魔宗声望 ' + rep + '）' : '货郎');
    for (const d of Object.values(DEALERS)) for (const [id] of d.sells) add(id, d.name);
    for (const l of LOCATIONS) for (const [id] of [...l.loot, ...(l.warLoot || [])]) add(id, '拾荒·' + l.name);
    for (const [f, pool] of Object.entries(SELL_POOLS)) for (const [id] of pool) add(id, FACTIONS[f].name + '客人来卖');
    for (const b of BEHAVIORS) for (const x of b.made || []) if (ITEMS[x]) add(x, '自己做·' + b.name);
    // 不在数据表里、写在函数里的来路：杀人越货（lootPerson）、战堂的战俘买卖（politics.js captive）
    ['cult_corpse', 'live_soul', 'blood_essence'].forEach(id => { add(id, '杀人越货·有修为的人'); add(id, '战堂·买战俘'); });
    add('yao_core', '杀人越货·妖族'); add('corpse', '杀人越货·凡人'); add('soul_grudge', '杀人越货');
    const need = new Set(BEHAVIORS.flatMap(b => (b.alt || []).flatMap(a => [...(a.use || []), ...(a.has || [])].map(x => x[0]).concat(a.mod ? [a.mod] : []))));
    return [...need].map(id => ({ id, name: ITEMS[id].name, src: [...new Set(src[id] || [])] }));
  })()`, ctx);
}
const stuck = sources().filter(x => !seenAny.has(x.id));
const unlisted = {};
for (const g of ok) for (const [k, n] of Object.entries(g.b.unlisted || {})) unlisted[k] = (unlisted[k] || 0) + n;
const order = { '✗': 0, '⚠': 1, '有': 2, '正': 3 };

let md = `## 多物品行为对账

${ok.length} 局（${[...new Set(ok.map(g => g.root))].join('、')}），共 ${nights} 夜${games.length > ok.length ? `；${games.length - ok.length} 局重放出错没算` : ''}。

- **程序可行**：用当前代码新开一局，把材料、设备、手艺放齐了真的做一次，看做不做得成。
- **刻意去凑**：一个只走正当渠道的模拟玩家（货郎、鬼市、批发处、买设备、买秘籍、自己开炉做；不靠拾荒、客人来卖、杀人、故事偶得），从新开一局起把这条行为做成一次要几天、要多少魔宗声望。
- **材料凑全过**：这条行为要的每样东西都在玩家手上出现过（不必同时）的局数。
- **有机会**：设备、材料、手艺、模块同一夜全在手上的局数 / 夜数。
- **做过**：实际做成的局数 / 次数（从真实产出数）。
- **最常缺**：没机会的那些夜里，离做成最近的那种做法缺什么，括号里是占没机会夜数的比例。

| 行为 | 程序可行 | 刻意去凑 | 材料凑全过 | 有机会（局 / 夜） | 做过（局 / 次） | 诊断 | 最常缺 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.sort((a, b) => order[a.diag[0]] - order[b.diag[0]] || a.doneN - b.doneN).map(r => `| ${r.name} | ${r.f === true ? '✓' : '✗'} | ${r.route} | ${r.seen} | ${r.oppG} / ${r.oppN} | ${r.doneG} / ${r.doneN} | ${r.diag} | ${r.top || '—'} |`).join('\n')}
${stuck.length ? `\n### 从没出现过的材料\n\n配方要用、但所有局里玩家手上一次都没有过的东西，和代码里它能从哪儿来：\n\n| 材料 | 来路 |\n| --- | --- |\n${stuck.map(x => `| ${x.name} | ${x.src.join('、') || '**没找到来路**（只能靠故事、报恩之类偶得）'} |`).join('\n')}\n` : ''}${Object.keys(unlisted).length ? `\n**目录没登记的产出**（behaviors.js 该补一条）：${Object.entries(unlisted).map(([k, n]) => `${k} ×${n}`).join('、')}\n` : ''}
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
