#!/usr/bin/env node
// 设备格子对账：每台设备的格子放不放得下它该放的东西、一夜的料与产物装不装得下、手机竖屏摆不摆得开。
//   node tools/goods/grids.mjs            报告
//   node tools/goods/grids.mjs --check    有放不下的（材料、模组、样品、产物塞不进格子，一夜的料喂不满，产物被吞掉）就退出码非零
//   node tools/goods/grids.mjs --mobile   另开无界面 Firefox，量竖屏（480 / 640 宽）与电脑（1280 宽）下每台设备的窗口有没有撑出画面
// 配方取自 tools/play/behaviors.js；一夜几炉是真的开炉量出来的：功法练满、闭关、模组格能放的增益都放上，
//   格子放大到装得下 → 设计上一夜几炉；换回真的输入格 → 输入格喂得了几炉；再换回真的产出格 → 产物装得下几件、有没有被吞掉
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadGame } from '../lib/headless.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

function audit() {
  const ctx = loadGame([], { quiet: true });
  vm.runInContext(fs.readFileSync(path.resolve(HERE, '../play/behaviors.js'), 'utf8'), ctx);
  return vm.runInContext(`(() => {
    const nm = id => ITEMS[id].name, dim = id => ITEMS[id].w + '×' + ITEMS[id].h;
    const fitsIn = (id, g) => !!g && ITEMS[id].w <= g[0] && ITEMS[id].h <= g[1];
    const BOOSTS = ['fire_disk', 'dan_fire', 'soul_bell', 'zhen_fu', 'dan_guide'];
    const out = {};
    const note = (t, kind, text) => ((out[t] = out[t] || { bad: [], warn: [], runs: [] })[kind]).push(text);

    // ── 一、放得下：设备收的每样东西，尺寸塞不塞得进那一格 ──
    newGame('normal', 'apprentice');
    for (const [t, d] of Object.entries(MACHINES)) {
      const cell = d.stalls ? [d.stallSize, 1] : d.in;
      for (const id of d.inputs || []) if (!fitsIn(id, cell)) note(t, 'bad', (d.stalls ? '饲料格 ' : '输入格 ') + cell.join('×') + ' 放不下' + nm(id) + '（' + dim(id) + '）');
      for (const id of d.habitat || []) if (!fitsIn(id, d.pot)) note(t, 'bad', (d.potLabel || '盅内') + '格放不下' + nm(id));
      const mods = t === 'forgery' ? Object.keys(COUNTERFEITS) : Object.keys(ITEMS).filter(id => modAccepts({ id }, t));
      for (const id of mods) if (!fitsIn(id, d.mod)) note(t, 'bad', '模组格 ' + (d.mod || []).join('×') + ' 放不下' + (t === 'forgery' ? '仿造样品' : '') + nm(id) + '（' + dim(id) + '）');
      // 什么都收的格子（作伪台以次充好、傀儡货摊上架）：列出塞不进去的货
      if (d.in && !d.inputs && !d.stalls) {
        const ok = t === 'forgery' ? id => dressable({ id }) : id => !ITEMS[id].book && !ITEMS[id].tool;
        const big = Object.keys(ITEMS).filter(id => ok(id) && !fitsIn(id, d.in));
        if (big.length) note(t, 'warn', '输入格 ' + d.in.join('×') + ' 放不下 ' + big.length + ' 种货：' + big.map(nm).join('、'));
      }
    }
    for (const b of BEHAVIORS.filter(b => b.machine)) {
      const d = MACHINES[b.machine];
      for (const id of b.made.filter(id => ITEMS[id])) {
        if (!fitsIn(id, d.out)) note(b.machine, 'bad', '产出格 ' + (d.out || []).join('×') + ' 放不下' + nm(id) + '（' + dim(id) + '）');
        else if (d.overflow && !d.feedStack && !fitsIn(id, [S.grids.floor.w, S.grids.floor.h])) note(b.machine, 'warn', nm(id) + '（' + dim(id) + '）溢不到地上（地面 ' + S.grids.floor.w + '×' + S.grids.floor.h + '）：产出格满了就停工');
      }
    }

    // ── 二、一夜几炉：开炉量 ──
    function trial(b, a, mode, rv) {
      newGame('normal', 'apprentice'); S.stones = 1e7; S.retreat = true;
      for (const t in TECHS) S.tech[t] = TECHS[t].max;
      const m = addMachine(b.machine), d = MACHINES[b.machine];
      if (mode === 'nominal') S.grids[gridOf(m, 'in')] = { w: 12, h: 12 };
      if (mode !== 'real') S.grids[gridOf(m, 'out')] = { w: 12, h: 12 };
      S.grids.floor = { w: 6, h: 2 };
      const put = (id, gid, extra = {}) => { const it = makeItem(id, Object.assign({ q: 60 }, extra)); if (autoPlace(it, [gid])) return it; destroyItem(it); return null; };
      if (a.mod) put(a.mod, gridOf(m, 'mod'));
      if (a.modAny) { put(a.modAny, gridOf(m, 'mod')); S.forgeKnown[a.known] = 4; }
      for (const id of BOOSTS) if (d.mod && modAccepts({ id }, b.machine)) put(id, gridOf(m, 'mod'));
      const extra = id => id === 'water' ? { purity: 60 } : id === 'herb_seed' || YAO_SEEDS[id] ? { growth: 95 } : {};
      for (const [id, n] of a.has || []) for (let i = 0; i < n; i++) put(id, gridOf(m, 'in'), extra(id));
      if (b.made.includes('~purify')) put('water', gridOf(m, 'in'), { purity: 60 });
      let sets = 0;
      for (; sets < 30 && (a.use || []).length; sets++) {
        const got = [];
        const ok = a.use.every(([id, n]) => { for (let i = 0; i < n; i++) { const it = put(id, gridOf(m, 'in'), extra(id)); if (!it) return false; got.push(it); } return true; });
        if (!ok) { got.forEach(destroyItem); break; }
        if (b.made.includes('~purify')) { if (!put('water', gridOf(m, 'in'), { purity: 60 })) break; }
      }
      const before = new Set(Object.keys(S.items));
      const watch = [gridOf(m, 'out'), 'floor'];
      const moved0 = itemsIn(gridOf(m, 'out')).length;
      let lost = 0, stowed = 0;
      const out0 = output;
      output = (mm, it) => { const r = out0(mm, it); if (!r) lost++; else if (!['out', 'floor'].includes(r)) stowed++; return r; };
      const r0 = Math.random; Math.random = () => rv;
      try { machineRun(m); } finally { Math.random = r0; output = out0; }
      const made = watch.flatMap(itemsIn).filter(it => !before.has(String(it.uid))).length + (b.made.includes('~purify') ? itemsIn(gridOf(m, 'out')).length - moved0 : 0);
      return { sets, made: made + stowed, lost, stowed };
    }
    for (const b of BEHAVIORS.filter(b => b.machine && !MACHINES[b.machine].stalls && !MACHINES[b.machine].pot && MACHINES[b.machine].in)) {
      for (const a of b.alt.filter(a => a.use || b.made.includes('~purify'))) {
        const best = mode => [0.99, 0.01].map(rv => trial(b, a, mode, rv)).reduce((x, y) => (y.made > x.made || y.lost + y.stowed > x.lost + x.stowed ? y : x));
        const nom = best('nominal'), inn = best('in'), real = best('real');
        const what = b.name + (b.alt.length > 1 ? '（' + (a.use || []).map(([id, n]) => nm(id) + '×' + n).join('+') + '）' : '');
        out[b.machine] = out[b.machine] || { bad: [], warn: [], runs: [] };
        // 种一株长一株的（药圃、妖植盆）：格子有多少就种多少，格子就是规模，不算喂不满
        const perCell = nom.sets >= 30 && nom.made >= nom.sets;
        out[b.machine].runs.push({ what, nominal: perCell ? '按格' : nom.made, input: inn.made, real: real.made, lost: real.lost, stowed: real.stowed, sets: inn.sets });
        if (real.lost) note(b.machine, 'bad', what + '：一夜吞掉 ' + real.lost + ' 件产物（产出格与地面都放不下）');
        if (real.stowed) note(b.machine, 'warn', what + '：一夜有 ' + real.stowed + ' 件产物产出格放不下，搬进了库房');
        if (perCell) continue;
        if (inn.made < nom.made) note(b.machine, 'bad', what + '：输入格只喂得了 ' + inn.made + ' 件，功法模组练满一夜能出 ' + nom.made + ' 件');
        else if (real.made < inn.made) note(b.machine, 'warn', what + '：产出格一夜只装得下 ' + real.made + ' 件（能出 ' + inn.made + ' 件），得天天清');
      }
    }
    return Object.fromEntries(Object.entries(out).map(([t, v]) => [t, Object.assign(v, { name: MACHINES[t].name,
      grids: ['in', 'pot', 'out', 'mod'].filter(k => MACHINES[t][k]).map(k => k + ' ' + MACHINES[t][k].join('×')).concat(MACHINES[t].stalls ? ['栏 ' + MACHINES[t].stallSize + '×1 ×' + MACHINES[t].stallMax] : []).join('，'),
      starts: STARTS.filter(s => (s.machines || []).includes(t)).map(s => s.name) })]));
  })()`, ctx);
}

// ── 三、手机竖屏：每台设备的窗口摊开有没有撑出画面 ──
async function mobile() {
  const { browserRun } = await import('../lib/launch.mjs');
  const r = await browserRun(`
    const res = [];
    for (const [w, h] of [[390, 844], [768, 1024], [1366, 768]]) {
      Object.defineProperty(window, 'innerWidth', { get: () => w, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => h, configurable: true });
      newGame('normal', 'apprentice'); fitStage(); enterGame();
      for (const t of Object.keys(MACHINES)) {
        S.machines = []; const m = addMachine(t);
        while (MACHINES[t].stalls && stallCount(m) < MACHINES[t].stallMax) addStall(m);
        tab = 'workshop'; openMid = m.mid; renderAll();
        // 画面横向放不下：工坊这一页（#tab-body）横着撑出了滚动条，或设备窗口的格子比窗口宽
        const body = document.querySelector('#tab-body'), el = body.querySelector('.machine:not(.array)'), grids = el.querySelector('.m-grids');
        const over = Math.max(body.scrollWidth - body.clientWidth, el.scrollWidth - el.clientWidth, grids.scrollWidth - grids.clientWidth);
        // 格子实际摊多宽：最右那个格子的右沿（离窗口左沿），对比窗口里能用的宽度
        const right = Math.max(...[...grids.querySelectorAll('.grid')].map(g => g.getBoundingClientRect().right)), sc = el.getBoundingClientRect().width / el.offsetWidth;
        const need = Math.round((right - el.getBoundingClientRect().left) / sc), room = el.clientWidth;
        res.push({ stage: STAGE.w, cell: CELL, t, name: MACHINES[t].name, need, room, over: Math.max(over, need - room),
          // 竖着：设备窗口的下沿（连同上面的功法条、设备卡片）落不落在工坊页可见的高度里
          height: Math.round(el.getBoundingClientRect().bottom - body.getBoundingClientRect().top) / sc | 0, bodyH: body.clientHeight });
      }
    }
    return res;`);
  return r;
}

const rep = audit();
let bad = 0;
for (const [t, v] of Object.entries(rep)) {
  if (!v.bad.length && !v.warn.length && !argv.includes('--all')) continue;
  console.log(`\n■ ${v.name}（${t}）  ${v.grids}${v.starts.length ? `  · 开局：${v.starts.join('、')}` : ''}`);
  for (const r of v.runs) console.log(`    ${r.what}：设计 ${r.nominal} · 输入格喂得了 ${r.input} · 产出格装得下 ${r.real}${r.lost ? ` · 吞掉 ${r.lost}` : ''}${r.stowed ? ` · 搬进库房 ${r.stowed}` : ''}`);
  v.bad.forEach(x => console.log(`  ✗ ${x}`));
  v.warn.forEach(x => console.log(`  ! ${x}`));
  bad += v.bad.length;
}
console.log(bad ? `\n${bad} 处格子与玩法对不上` : '\n✓ 设备格子放得下该放的东西，一夜的料喂得满、产物装得下');
if (argv.includes('--mobile')) {
  const { result, errors } = await mobile();
  if (result.fatal || !Array.isArray(result)) { console.log(`✗ 量不了：${result.fatal || JSON.stringify(result).slice(0, 300)}`); process.exit(1); }
  console.log('\n手机竖屏与电脑（设备窗口摊开要多宽 / 有多宽）：');
  for (const r of result) {
    const over = r.over > 0, tall = r.height > r.bodyH;
    if (over || tall || argv.includes('--all')) console.log(`  ${over ? '✗' : tall ? '!' : '·'} ${r.stage} 宽（格 ${r.cell}px）${r.name}：格子摊开 ${r.need}px / 窗口 ${r.room}px${over ? `，撑出 ${r.over}px` : ''}；窗口下沿 ${r.height}px / 工坊页可见 ${r.bodyH}px${tall ? '（要往下翻）' : ''}`);
    if (over) bad++;
  }
  if (errors.length) console.log(`  页面报错：${errors.slice(0, 3).join('；')}`);
}
if (argv.includes('--check') && bad) process.exit(1);
