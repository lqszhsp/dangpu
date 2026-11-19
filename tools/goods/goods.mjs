#!/usr/bin/env node
// 货品册工具：新建货品/设备、生成图标、检查来路去路与配方、看行情
//   node tools/goods/goods.mjs list                        货品册里的货品、配方、设备
//   node tools/goods/goods.mjs browse [品类]               现有物品一览：价钱、尺寸、来路去路（找参照、找可复用的图）
//   node tools/goods/goods.mjs new <id> --name 名字 --cat dan --base 260 [--w 1 --h 1] (--art "英文画面描述" | --reuse 现有图标) [--file 文件名]
//   node tools/goods/goods.mjs new-machine <type> --name 名字 --price 600 --art "英文画面描述" [--file 文件名]
//   node tools/goods/goods.mjs art <id|type> [--redo [low,top]]   生成图标：物品为底图+下品/上品/极品，设备为停着+运转；data.js 的老物品按 tools/art/specs.py 重画
//   node tools/goods/goods.mjs check [id] [--runs 4 --days 40]    检查：图齐不齐、有没有来路去路、配方能不能做出来、赚不赚钱；再模拟实战看见不见得到
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { GAME, loadGame, hasArt, registerScript, artSpecs, runArt } from '../lib/headless.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = k => args.includes(`--${k}`);
const EXPOSE = ['GOODS', 'RECIPES', 'NEW_MACHINES', 'ITEMS', 'MACHINES', 'CATS', 'SUPPLY', 'SELL_POOLS', 'LOCATIONS', 'DEALERS', 'MERIT_SHOP', 'BUY_WANTS',
  'ORDER_GOODS', 'WISHES', 'CULT_XP', 'RESTORE', 'NOBLE_WANTS', 'NO_QUALITY', 'TECHS'];
const TIERS = ['low', 'high', 'top'];
// 老设备里写死的产物（game.js / crafts.js），仅供来路显示
const BUILTIN_MADE = {
  iron_ingot: ['furnace'], sword_std: ['forge'], demon_blade: ['forge'], pill_qi: ['danlu'], pill_blood: ['danlu'], pill_found: ['danlu'], wangyou: ['danlu'],
  blood_infant: ['danlu'], water: ['spring', 'pool'], herb_dew: ['herbbed'], herb_blood: ['herbbed'], gu: ['gupot'], gu_egg: ['gupot'], gu_venom: ['gupot'], spirit_wine: ['winejar'],
  soul_pearl: ['soulfurnace'], soul_crystal: ['soulfurnace'], iron_corpse: ['coffin'], corpse_king: ['coffin'], corpse_poison: ['coffin'], puppet_doll: ['puppetbench'],
  mihun_flower: ['yaopot'], vine_fruit: ['yaopot'], xuan_essence: ['dihuo'], god_blank: ['dihuo'], spirit_sand: ['pen'], beast_feed: ['pen'], dan_guide: ['pen'],
  fu_jingang: ['fudesk'], fu_shehun: ['fudesk'], demon_charm: ['fudesk'], zhen_fu: ['fudesk'], seal_xian: ['fudesk'], treasure_rat: ['pen'], gold_bug: ['pen'],
};

// ───────────── 查表：一件物品的来路与去路 ─────────────

function routes(G, id) {
  const it = G.ITEMS[id], from = [], to = [];
  const s = G.SUPPLY.find(x => x[0] === id); if (s) from.push(`货郎 ${s[1]}`);
  for (const [f, pool] of Object.entries(G.SELL_POOLS)) if (pool.some(x => x[0] === id)) from.push(`${f}客人卖`);
  for (const l of G.LOCATIONS) if (l.loot.concat(l.warLoot || []).some(x => x[0] === id)) from.push(`拾荒·${l.name}`);
  for (const [k, d] of Object.entries(G.DEALERS)) { if (d.sells.some(x => x[0] === id)) from.push(`${d.name}出`); if (d.buys.includes(id)) to.push(`${d.name}收`); }
  for (const [f, list] of Object.entries(G.MERIT_SHOP)) if (list.some(x => x[0] === id)) from.push(`功勋·${f}`);
  const made = G.RECIPES.filter(r => r.out === id).map(r => `${G.MACHINES[r.machine].name}制`);
  if (BUILTIN_MADE[id]) made.push(...BUILTIN_MADE[id].map(t => `${G.MACHINES[t].name}制`));
  from.push(...made);
  const wantBy = Object.entries(G.BUY_WANTS).filter(([, w]) => w[it.cat]).map(([f]) => f);
  if (wantBy.length) to.push(`${wantBy.join('/')}客人买`);
  if (G.NOBLE_WANTS[it.cat]) to.push('权贵买');
  for (const [k, list] of Object.entries(G.ORDER_GOODS)) if (list.includes(id)) to.push(`订单·${k}`);
  const wish = Object.entries(G.WISHES).filter(([, l]) => l.includes(id)).map(([t]) => t);
  if (wish.length) to.push(`所求·${wish.join('/')}`);
  for (const r of G.RECIPES) if (r.in.some(x => x[0] === id)) to.push(`原料→${G.ITEMS[r.out].name}`);
  for (const [type, m] of Object.entries(G.MACHINES)) if (Array.isArray(m.inputs) && m.inputs.includes(id) && !G.MACHINES[type].custom) to.push(`入${m.name}`);
  if (it.mod) to.push(`模组·${[].concat(it.mod).map(t => (G.MACHINES[t] || {}).name || t).join('/')}`);
  if (G.CULT_XP[id]) to.push(`服炼+${G.CULT_XP[id][0]}`);
  if (G.RESTORE[id]) to.push('可服用');
  return { from, to };
}

// ───────────── list / browse ─────────────

function list() {
  const g = loadGame(EXPOSE), G = g.__G;
  const ids = Object.keys(G.GOODS);
  if (!ids.length && !G.RECIPES.length) return console.log('货品册是空的。用 new 新建。');
  for (const id of ids) {
    const it = G.ITEMS[id], r = routes(G, id), icon = it.icon || id;
    const art = [icon, ...(G.GOODS[id].noTier ? [] : TIERS.map(t => `${icon}_${t}`))].filter(n => hasArt('items', n)).length;
    console.log(`${id.padEnd(16)} ${it.name}（${G.CATS[it.cat]} ${it.w}×${it.h}）基价 ${it.base} · 图 ${art}/${G.GOODS[id].noTier ? 1 : 4}${it.icon ? `（复用 ${it.icon}）` : ''}`);
    console.log(`${''.padEnd(17)}来路：${r.from.join('，') || '—'}\n${''.padEnd(17)}去路：${r.to.join('，') || '—'}`);
  }
  for (const r of G.RECIPES) console.log(`配方  ${G.MACHINES[r.machine].name}：${r.in.map(([id, n]) => `${G.ITEMS[id].name}×${n}`).join(' + ')}${r.mod ? `（模组 ${G.ITEMS[r.mod].name}）` : ''} → ${G.ITEMS[r.out].name}×${r.qty}，每夜 ${r.batches} 炉`);
  for (const [t, m] of Object.entries(G.NEW_MACHINES)) console.log(`设备  ${t}：${m.name} ${m.price} 灵石，灵力 ${m.power}/夜`);
}

function browse(cat) {
  const g = loadGame(EXPOSE), G = g.__G;
  const ids = Object.keys(G.ITEMS).filter(id => !G.ITEMS[id].book && (!cat || G.ITEMS[id].cat === cat)).sort((a, b) => G.ITEMS[a].base - G.ITEMS[b].base);
  for (const id of ids) {
    const it = G.ITEMS[id], r = routes(G, id);
    console.log(`${id.padEnd(16)} ${(it.name + '').padEnd(6, '　')} ${G.CATS[it.cat]} ${it.w}×${it.h} 基价 ${String(it.base).padStart(4)}${it.war ? ` 战${it.war}` : ''}${it.lux ? ' 奢' : ''}${it.contra ? ' 禁' : ''}${it.illicit ? ' 违' : ''}  来:${r.from.join(',') || '—'}  去:${r.to.join(',') || '—'}`);
  }
}

// ───────────── new / new-machine ─────────────

const fileFor = (name) => path.join(GAME, 'js/goods', `${name}.js`);

function appendOrCreate(file, header, block) {
  if (fs.existsSync(file)) fs.appendFileSync(file, `\n${block}`);
  else fs.writeFileSync(file, `${header}\n'use strict';\n\n${block}`);
  registerScript('goods', `js/goods/${path.basename(file)}`);
}

function scaffoldItem(id) {
  if (!/^[a-z][a-z0-9_]*$/.test(id || '')) throw new Error('id 只能用小写字母、数字、下划线，且以字母开头');
  const g = loadGame(EXPOSE), G = g.__G;
  if (G.ITEMS[id]) throw new Error(`物品 ${id} 已存在`);
  const name = opt('name'), cat = opt('cat'), base = +opt('base');
  if (!name || !G.CATS[cat] || !base) throw new Error(`要 --name、--cat（${Object.entries(G.CATS).map(([k, v]) => `${k}${v}`).join(' ')}）、--base 基础价`);
  const reuse = opt('reuse'), art = opt('art');
  if (!reuse && !art) throw new Error('要 --art "英文画面描述"（新画）或 --reuse 现有图标名（复用，例如 pill_qi）');
  if (reuse && !hasArt('items', reuse)) throw new Error(`没有现成图标 ${reuse}；用 browse 看看有哪些`);
  const w = +opt('w', 1), h = +opt('h', 1), file = fileFor(opt('file', id));
  const wants = Object.entries(G.BUY_WANTS).filter(([, x]) => x[cat]).map(([f]) => f);
  const block = `// ${name}：TODO 一句话写清它在经济里的位置（谁做、谁要、为什么值这个价）
defineItem({
  id: '${id}', name: '${name}', cat: '${cat}', w: ${w}, h: ${h}, base: ${base},${reuse ? `\n  icon: '${reuse}',` : `\n  art: ${JSON.stringify(art)},`}
  desc: 'TODO 物品说明（悬停时显示）：长什么样、有什么用、怎么来的',
  from: {
    sell: { ${wants[0] || 'ren'}: 1 },          // TODO 哪族客人会拿来卖（权重参照 data.js 的 SELL_POOLS，常见 1–4）
  },
  to: {
    // wish: ['某身份'], dealer: ['league'], order: ['heir'], cultivate: [修为], restore: [体力, 精神], lace: true
  },
});
// 做法（可选）：defineRecipe({ machine: 'danlu', in: [['herb_blood', 1]], out: '${id}', tech: ['alchemy', 1], desc: '……' });
`;
  appendOrCreate(file, `// 货品册：${name}`, block);
  console.log(`已写进 ${path.relative(GAME, file)}，并登记到 index.html。把 TODO 换成真东西，再跑 check ${id}${art ? `；图标用 art ${id} 生成` : ''}。`);
}

function scaffoldMachine(type) {
  if (!/^[a-z][a-z0-9_]*$/.test(type || '')) throw new Error('type 只能用小写字母、数字、下划线');
  const g = loadGame(EXPOSE), G = g.__G;
  if (G.MACHINES[type]) throw new Error(`设备 ${type} 已存在`);
  const name = opt('name'), price = +opt('price'), art = opt('art');
  if (!name || !price || !art) throw new Error('要 --name、--price、--art "英文画面描述"');
  const file = fileFor(opt('file', type));
  const block = `// ${name}：TODO 这台设备在生产链里做什么
defineMachine({
  type: '${type}', name: '${name}', price: ${price}, power: 2, in: [3, 2], out: [3, 2], cost: [4, 4],
  art: ${JSON.stringify(art)},
  desc: 'TODO 设备说明：放什么、出什么、每夜几炉',
});
// TODO 给它写配方：defineRecipe({ machine: '${type}', in: [['某原料', 2]], out: '某产物', batches: 2 });
`;
  appendOrCreate(file, `// 货品册：${name}`, block);
  console.log(`已写进 ${path.relative(GAME, file)}。写好配方后跑 art ${type} 生成设备图，再 check。`);
}

// ───────────── art ─────────────

function makeArt(id) {
  const g = loadGame(EXPOSE), G = g.__G;
  const redoArg = opt('redo'), redo = flag('redo') ? (redoArg ? redoArg.split(',') : true) : null;
  const sp = artSpecs(['ITEM_PREFIX', 'MACHINE_PREFIX', 'MACHINE_RUN', 'TIERS', 'ITEMS', 'NO_TIER']);
  const edit = c => `Same object, same framing, same camera angle and lighting, same style. Only change this: ${c}. Keep the transparent background.`;
  let jobs;
  if (G.NEW_MACHINES[id]) {
    const m = G.NEW_MACHINES[id], icon = m.icon || id, base = `raw/machines/${icon}.png`;
    jobs = [{ id: `machine:${icon}`, variant: 'idle', prompt: sp.MACHINE_PREFIX.replace('{d}', `${m.art}, idle, cold and dark`), out: base, size: '1024x1024', quality: 'high', background: 'transparent' },
      { id: `machine:${icon}_running`, variant: 'running', refs: [base], prompt: edit(sp.MACHINE_RUN), out: `raw/machines/${icon}_running.png`, size: '1024x1024', quality: 'high', background: 'transparent' }];
  } else if (G.GOODS[id]) {
    const d = G.GOODS[id];
    if (!d.art) throw new Error(`${id} 复用图标 ${d.icon}，不用生图（要新画就写 art、去掉 icon）`);
    const it = G.ITEMS[id], size = it.h > it.w ? '1024x1536' : it.w > it.h ? '1536x1024' : '1024x1024', base = `raw/items/${id}.png`;
    jobs = [{ id: `item:${id}`, variant: 'mid', prompt: sp.ITEM_PREFIX.replace('{d}', d.art), out: base, size, quality: 'high', background: 'transparent' }];
    if (!d.noTier) for (const t of TIERS) jobs.push({ id: `item:${id}_${t}`, variant: t, refs: [base], prompt: edit(sp.TIERS[t]), out: `raw/items/${id}_${t}.png`, size, quality: 'high', background: 'transparent' });
  } else if (sp.ITEMS[id]) {
    // data.js 里的老物品：画面描述写在 tools/art/specs.py 的 ITEMS（要改图先改那里）
    const it = G.ITEMS[id] || {}, size = it.h > it.w ? '1024x1536' : it.w > it.h ? '1536x1024' : '1024x1024', base = `raw/items/${id}.png`;
    jobs = [{ id: `item:${id}`, variant: 'mid', prompt: sp.ITEM_PREFIX.replace('{d}', sp.ITEMS[id]), out: base, size, quality: 'high', background: 'transparent' }];
    if (!sp.NO_TIER.includes(id) && !id.startsWith('book_')) for (const t of TIERS) jobs.push({ id: `item:${id}_${t}`, variant: t, refs: [base], prompt: edit(sp.TIERS[t]), out: `raw/items/${id}_${t}.png`, size, quality: 'high', background: 'transparent' });
  } else throw new Error(`货品册与 tools/art/specs.py 里都没有物品或设备 ${id}`);
  console.log(`生成 ${jobs.length} 张（清单 art/goods_${id}.json）`);
  runArt(`goods_${id}`, jobs, { jobsN: +opt('jobs', 4), redo });
  const missing = jobs.filter(j => !hasArt(j.out.split('/')[1], path.basename(j.out, '.png')));
  console.log(missing.length ? `还缺 ${missing.map(j => j.variant).join('、')}（再跑一次 art ${id} 会续上）` : '图齐了。用联系表或进游戏看看。');
}

// ───────────── check ─────────────

function check(only) {
  const g = loadGame(EXPOSE), G = g.__G;
  const runIn = code => vm.runInContext(code, g);
  // 查一台设备：连带检查它的配方用到和做出的货
  const ids = !only ? Object.keys(G.GOODS) : G.GOODS[only] ? [only]
    : [...new Set(G.RECIPES.filter(r => r.machine === only).flatMap(r => [r.out, ...r.in.map(i => i[0])]).filter(i => G.GOODS[i]))];
  const machines = only ? (G.NEW_MACHINES[only] ? [only] : []) : Object.keys(G.NEW_MACHINES);
  if (only && !G.GOODS[only] && !G.NEW_MACHINES[only]) throw new Error(`货品册里没有 ${only}`);
  let bad = 0;
  const out = (sym, msg) => { console.log(`  ${sym} ${msg}`); if (sym === '✗') bad++; };
  // 估价：一件物品在中等品相下的市价
  const val = id => Math.round(runIn(`valueAtQ({ id: ${JSON.stringify(id)} }, 60) * priceMul(${JSON.stringify(id)})`));

  for (const id of ids) {
    const d = G.GOODS[id], it = G.ITEMS[id], icon = it.icon || id, r = routes(G, id);
    console.log(`\n■ ${it.name}（${id}）${G.CATS[it.cat]} ${it.w}×${it.h} 基价 ${it.base}`);
    console.log(`  来路：${r.from.join('，') || '—'}\n  去路：${r.to.join('，') || '—'}`);
    const need = [icon, ...(d.noTier ? [] : TIERS.map(t => `${icon}_${t}`))].filter(n => !hasArt('items', n));
    if (need.length === (d.noTier ? 1 : 4)) out('✗', `没有图标（art ${id} 生成，或用 icon 复用现有的）`);
    else if (need.length) out('!', `缺品相图：${need.join('、')}（缺的退回底图）`);
    if (!r.from.length) out('✗', '没有来路：玩家永远得不到它（写 from，或给它一个配方）');
    if (!r.to.length) out('✗', '没有去路：没人买、也不能用（换个有人买的品类，或写 to）');
    if (/TODO/.test(d.desc)) out('!', '说明还是 TODO');
    if (!d.desc || d.desc.length < 8) out('!', '说明太短');
    // 价位：与同品类比
    const peers = Object.entries(G.ITEMS).filter(([k, v]) => v.cat === it.cat && k !== id && !v.book).map(([, v]) => v.base).sort((a, b) => a - b);
    if (peers.length && (it.base > peers[peers.length - 1] * 3 || it.base < peers[0] / 3)) out('!', `基价 ${it.base} 远离同品类（${peers[0]}–${peers[peers.length - 1]}）`);
    // 能不能生出来、显示得出来
    try {
      runIn(`(() => { newGame('normal', 'apprentice'); const it = makeItem(${JSON.stringify(id)}, { q: 70 }); itemName(it); itemIcon(it); claimedValue(it); })()`);
    } catch (e) { out('✗', `生成这件物品时出错：${e.message}`); }
  }

  // 配方：真的放进设备跑一夜
  for (const rcp of G.RECIPES.filter(x => !only || x.out === only || x.machine === only || x.in.some(i => i[0] === only))) {
    const m = G.MACHINES[rcp.machine];
    const label = `${m.name}：${rcp.in.map(([i, n]) => `${G.ITEMS[i].name}×${n}`).join('+')} → ${G.ITEMS[rcp.out].name}×${rcp.qty}`;
    console.log(`\n■ 配方 ${label}`);
    try {
      g.__r = rcp;
      const res = runIn(`(() => { newGame('normal', 'nothing'); S.stones = 99999; S.vit = { st: 100, sp: 100 };
        for (const t in TECHS) S.tech[t] = TECHS[t].max;
        const m = addMachine(__r.machine);
        for (const [id, n] of __r.in) for (let i = 0; i < n; i++) { const it = makeItem(id, { q: 60 }); if (!autoPlace(it, [gridOf(m, 'in')])) throw new Error('输入格放不下 ' + ITEMS[id].name + '（设备的 in 格子太小）'); }
        if (__r.mod) { const it = makeItem(__r.mod); if (!autoPlace(it, [gridOf(m, 'mod')])) throw new Error('模组格放不下 ' + ITEMS[__r.mod].name); }
        const chk = machineCheck(m), txt = chk.ok ? machineRun(m) : '';
        return { chk, txt, got: itemsIn(gridOf(m, 'out')).concat(itemsIn('floor')).filter(it => it.id === __r.out).length }; })()`);
      if (!res.chk.ok) out('✗', `设备说做不了：${res.chk.msg}`);
      else if (!res.got) out('✗', `跑了一夜没做出来：${res.txt}`);
      else out('✓', `一炉做出 ${res.got} 件（${res.txt}）`);
    } catch (e) { out('✗', `出错：${e.message}`); }
    const cost = rcp.in.reduce((s, [i, n]) => s + val(i) * n, 0), gain = val(rcp.out) * rcp.qty;
    const ratio = gain / Math.max(1, cost);
    out(ratio < 1.1 ? '!' : ratio > 5 ? '!' : '✓', `原料市价约 ${cost}，产出市价约 ${gain}（×${ratio.toFixed(2)}）${ratio < 1.1 ? '：几乎不赚钱' : ratio > 5 ? '：暴利，确认是否要设门槛（技艺、模组、稀有原料）' : ''}`);
    if (rcp.tech && !G.TECHS[rcp.tech[0]]) out('✗', `技艺 ${rcp.tech[0]} 不存在`);
  }

  for (const t of machines) {
    const m = G.MACHINES[t];
    console.log(`\n■ 设备 ${m.name}（${t}）${m.price} 灵石`);
    if (!hasArt('machines', m.icon)) out('✗', `没有设备图（art ${t}）`);
    else if (!hasArt('machines', `${m.icon}_running`)) out('!', '缺运转图');
    if (!G.RECIPES.some(r => r.machine === t)) out('✗', '没有任何配方：买回来什么也做不了');
  }

  // 模拟实战：这些货在一局里见不见得到
  const runs = +opt('runs', 4), days = +opt('days', 40);
  if (ids.length) {
    g.__ids = ids;
    const seen = runIn(`var __seen = {}; for (const id of __ids) __seen[id] = { supply: 0, offered: 0, wanted: 0, loot: 0, dealer: 0 };
      for (let r = 0; r < ${runs}; r++) { newGame('normal', 'apprentice'); S.stones = 5000;
        for (let d = 0; d < ${days} && !S.over; d++) {
          for (const e of S.supply) if (__seen[e.id]) __seen[e.id].supply++;
          openShop(); let c, k = 0;
          while ((c = nextCustomer()) && k++ < 40) {
            for (const it of goodsOf()) if (__seen[it.id]) __seen[it.id].offered++;
            if (__seen[c.wantId]) __seen[c.wantId].wanted++;
            if (c.kind === 'story') { const st = S.story[c.key], n = storyNode(st), p = storyPerson(st); const ch = n.choices(st, p); const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p)); if (ok.length) resolveChoice(c.key, pick(ok)); }
            if (S.customer) dismissCustomer(false); }
          closeShop();
          for (const k2 of Object.keys(DEALERS)) for (const o of dealerStock(k2).offers) if (__seen[o.id]) __seen[o.id].dealer++;
          if (d % 2 === 0) { startScavenge(pick(LOCATIONS).id); for (let i = 0; i < 6; i++) { const res = scavSearch(); if (res && res.item && __seen[res.item.id]) __seen[res.item.id].loot++; const pp = pendingScavItem(); if (pp && !pp.pos) { destroyItem(pp); S.scav.pending = null; } } endScavenge(); }
          for (const k2 of dueStories('night')) { const st = S.story[k2], n = storyNode(st), p = storyPerson(st); const ch = n.choices(st, p); const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p)); if (ok.length) resolveChoice(k2, pick(ok)); }
          nightResolve(); S.stones = Math.max(S.stones, 3000); } }
      __seen`);
    console.log(`\n■ 实战 ${runs} 局 × ${days} 天（每局平均）`);
    for (const id of ids) {
      const s = seen[id], f = n => (n / runs).toFixed(1);
      const made = G.RECIPES.some(r => r.out === id);
      console.log(`  ${G.ITEMS[id].name}：货郎上架 ${f(s.supply)} 天 · 客人拿来卖 ${f(s.offered)} 次 · 客人来问 ${f(s.wanted)} 次 · 拾荒翻到 ${f(s.loot)} 次 · 贩子出货 ${f(s.dealer)} 天${made ? ' · 另可自制' : ''}`);
      if (!made && !s.supply && !s.offered && !s.loot && !s.dealer && !G.GOODS[id].from?.merit) out('!', `${G.ITEMS[id].name} 一局里几乎见不到（权重太低？来路只靠剧情？）`);
      const sinkCat = Object.values(G.BUY_WANTS).some(w => w[G.ITEMS[id].cat]) || G.NOBLE_WANTS[G.ITEMS[id].cat];
      if (sinkCat && !s.wanted && !routes(G, id).to.some(x => !x.endsWith('客人买'))) out('!', `${G.ITEMS[id].name} 没有客人来问（同品类物品太多稀释了，可以加 to.wish 或订单）`);
    }
  }
  console.log(bad ? `\n共 ${bad} 处错误` : '\n✓ 没有错误');
  process.exit(bad ? 1 : 0);
}

{
  const [cmd, id] = args;
  try {
    ({ list, browse: () => browse(id && !id.startsWith('--') ? id : null), new: () => scaffoldItem(id), 'new-machine': () => scaffoldMachine(id), art: () => makeArt(id),
      check: () => check(id && !id.startsWith('--') ? id : null) }[cmd] || (() => {
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n').replace(/^\/\/ ?/gm, ''));
    }))();
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
