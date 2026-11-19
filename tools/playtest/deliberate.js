// 刻意去凑：一个只走正当渠道的模拟玩家，逐条把多物品行为做成一次。在游戏的上下文里执行（behaviors.mjs 注入）。
// 渠道分三档，材料按设计的档次来：
//   低阶 = 买（货郎、鬼市、批发处）＋ 低风险拾荒（遇险率低于 DLB_SAFE 的地方）
//   中阶 = 再加高风险拾荒
//   高阶 = 再加功勋兑换（功勋按需给，记下要多少）
// 都只用游戏里玩家能点的那几样：buySupply、buyLot、buyMachine、买书 readBook、startScavenge/scavSearch、redeemMerit、
// 自己开炉做（machineCheck + machineRun）、服炼（cultivate）、冲关（breakthrough）。缺货就过一天等货郎、过一周等鬼市补货。
// 灵石不设限（只记花了多少），魔宗声望按需要的最低档给（记下要多少）——看的是“凑不凑得齐”，不是“攒不攒得起”。
// 客人来卖、杀人越货、故事偶得一概不用：靠这些才凑得齐的，不算“刻意能凑”
'use strict';

const DLB_SAFE = 0.1;      // 低风险拾荒：初始遇险率低于这个
const DLB_TIERS = ['低阶', '中阶', '高阶'];

function deliberateAll(start = 'apprentice', only = null) {
  const out = {};
  for (const b of BEHAVIORS.filter(b => !only || only.includes(b.id))) {
    newGame('normal', start);
    const t0 = S.day;
    const D = { route: {}, spent: 0, rep: 0, merit: 0, tier: 0, err: null };
    S.stones = 1e7; const stones0 = S.stones;
    ['store1', 'store2'].forEach(buyUpgrade);
    try { D.ok = deliberateOne(b, D); } catch (e) { D.ok = false; D.err = String(e.message || e); }
    out[b.id] = { ok: !!D.ok, days: S.day - t0, spent: stones0 - S.stones, rep: D.rep, merit: D.merit, tier: DLB_TIERS[D.tier], route: D.route, err: D.err };
  }
  return out;
}

// 等一天：货郎换货（鬼市按周补货，dealerStock 自己会看日子）
function dlbWait(n = 1) { S.day += n; rollMarket(); S.vit.st = S.vit.sp = 100; }
// 手上空着、能拿去用的：不在设备格里、没掺料、不是假货、没有原主烙印
const dlbHeld = id => Object.values(S.items).filter(it => HELD(it) && it.id === id && !/^m\d+:/.test(it.pos.g) && !it.laced && !it.fake && !it.mark);
// 声望按需抬：只抬到这一项要的那一档
function dlbRep(D, need) { if (S.rep.mo < need) { S.rep.mo = need; rollMarket(); } D.rep = Math.max(D.rep, need); }

// 一样东西最低要哪一档的渠道：买得到 0，低风险拾荒 0，高风险拾荒 1，功勋 2；都没有为 null
const dlbBuyable = id => SUPPLY.some(s => s[0] === id) || Object.values(DEALERS).some(d => d.sells.some(([y]) => y === id));
const dlbScav = id => LOCATIONS.filter(l => l.loot.some(([x]) => x === id)).sort((a, b) => a.danger - b.danger)[0];
const dlbMerit = id => Object.entries(MERIT_SHOP).find(([, list]) => list.some(([x]) => x === id));
function dlbTierOf(id) {
  if (dlbBuyable(id)) return 0;
  const l = dlbScav(id);
  if (l) return l.danger < DLB_SAFE ? 0 : 1;
  return dlbMerit(id) ? 2 : null;
}

// 拾荒：去最安全的那处翻，直到翻到；遇险就回家养伤，明天再去
function dlbScavenge(id, D, n = 1) {
  const l = dlbScav(id);
  for (let trip = 0; trip < 300; trip++) {
    if (dlbHeld(id).length >= n) { D.trips = (D.trips || 0) + trip; return true; }
    cureCond('me', 'injured'); cureCond('me', 'poisoned'); S.heat = 0;
    startScavenge(l.id);
    while (S.scav && !S.scav.ended && S.scav.tries > 0) { S.vit.st = S.vit.sp = 100; const r = scavSearch(); if (!r || r.tired) break; if (S.scav.pending) { const it = S.items[S.scav.pending]; S.scav.pending = null; if (it) autoPlace(it, ['store', 'floor']); } }
    if (S.scav) { itemsIn('basket').filter(it => it.id !== id).forEach(destroyItem); endScavenge(); }
    D.route[ITEMS[id].name] = `拾荒·${l.name}`;
    D.tier = Math.max(D.tier, l.danger < DLB_SAFE ? 0 : 1);
    dlbWait();
  }
  return false;
}

// 功勋兑换：功勋按需给，记下花了多少；渠道没开就按需开
function dlbRedeem(id, D) {
  const [f, list] = dlbMerit(id), cost = list.find(([x]) => x === id)[1];
  if (!channelOpen(f)) S.rep[f] = Math.max(S.rep[f], f === 'ren' ? 5 : 15);
  S.merit[f] += cost; D.merit += cost;
  const err = redeemMerit(f, list.findIndex(([x]) => x === id));
  if (err) throw new Error(err);
  D.route[ITEMS[id].name] = `${FACTIONS[f].name}功勋`;
  D.tier = Math.max(D.tier, 2);
}

// 弄到 n 件 id：先看手上，再买，再自己做，再拾荒，最后功勋
function dlbObtain(id, n, D, depth = 0) {
  if (depth > 6) throw new Error(`凑${ITEMS[id].name}绕不出来`);
  for (let guard = 0; dlbHeld(id).length < n; guard++) {
    if (guard > 400) throw new Error(`凑不齐${ITEMS[id].name}`);
    const sup = SUPPLY.find(s => s[0] === id);
    if (sup) {
      dlbRep(D, Math.max(0, sup[2]));
      const e = S.supply.find(x => x.id === id);
      if (e && e.stock > 0) { if (!buySupply(e)) { D.route[ITEMS[id].name] = '货郎'; continue; } }
      dlbWait(); continue;
    }
    const key = Object.keys(DEALERS).find(k => DEALERS[k].sells.some(([x]) => x === id));
    if (key) {
      const d = DEALERS[key];
      if (d.need && !d.need()) dlbRep(D, 10);
      const st = dealerStock(key), i = st.offers.findIndex(o => o.id === id);
      if (i >= 0 && st.offers[i].lots > 0) { if (!buyLot(key, i)) { D.route[ITEMS[id].name] = d.name; continue; } }
      dlbWait(7); continue;
    }
    const makers = BEHAVIORS.filter(x => x.machine && (x.made || []).includes(id) && dlbMakeable(x));
    const maker = makers.find(x => x.made[0] === id) || makers[0];
    if (maker) { if (!deliberateOne(maker, D, depth + 1)) throw new Error(`做不出${ITEMS[id].name}`); D.route[ITEMS[id].name] = `自己做（${maker.name}）`; continue; }
    if (dlbScav(id)) { if (!dlbScavenge(id, D, n)) throw new Error(`拾荒翻不到${ITEMS[id].name}`); continue; }
    if (dlbMerit(id)) { dlbRedeem(id, D); continue; }
    throw new Error(`${ITEMS[id].name}没有刻意能去的来路`);
  }
}

// 学到某门功法的某一重：按顺序弄到书、读书——一二重在货郎那儿买，三重往上拿功勋换（传艺要看交情，不算刻意来路）
function dlbTech(t, lv, D) {
  while (techLv(t) < lv) {
    const bk = BOOKS.find(b => b[1] === t && b[2] === techLv(t) + 1);
    if (!bk) throw new Error(`${TECHS[t].name}没有第${techLv(t) + 1}重的秘籍`);
    let it;
    if (bk[2] <= BOOK_SHOP_MAX) {
      dlbRep(D, Math.max(0, bk[4]));
      spend(Math.round(bk[3] * (1 + diff().markup) * warStage().supply));
      it = giveItem(bk[0]);
    } else {
      if (!dlbMerit(bk[0])) throw new Error(`${ITEMS[bk[0]].name}鬼市不卖，功勋也换不到`);
      dlbRedeem(bk[0], D);
      it = dlbHeld(bk[0])[0];
    }
    const err = readBook(it);
    if (err) throw new Error(err);
    D.route[`${TECHS[t].name}${bk[2]}重`] = bk[2] <= BOOK_SHOP_MAX ? '买秘籍' : D.route[ITEMS[bk[0]].name];
  }
}

// 有没有刻意能去的来路：买、拾荒、功勋、自己能做（蛊从蛊卵孵）
const dlbSourced = (id, not) => id === 'gu' || dlbTierOf(id) != null || BEHAVIORS.some(y => y.machine && y !== not && (y.made || []).includes(id) && dlbMakeable(y));
// 这条配方自己的材料是不是都有来路（不绕回自己）
const dlbMakeable = (b, depth = 0) => depth < 5 && b.alt.some(x => (x.use || []).every(([id]) => id === 'gu' || dlbTierOf(id) != null
  || BEHAVIORS.some(y => y.machine && y !== b && (y.made || []).includes(id) && dlbMakeable(y, depth + 1))));

// 灵兽圈没有 in / out 两格：灵宠进第一栏，饲料进第一栏的饲料格
const dlbSlot = (m, slot) => !MACHINES[m.type].stalls ? slot : slot === 'in' ? 'f0' : slot === 'out' ? 'b0' : slot;

// 让设备的某个格子里有 n 件 id：缺的先弄到手，再挪进去
function dlbStock(m, slot, id, n, D, depth) {
  const lack = n - itemsIn(gridOf(m, dlbSlot(m, slot))).filter(it => it.id === id).length;
  if (lack <= 0) return;
  dlbObtain(id, lack, D, depth);
  dlbLoad(m, slot, id, n);
}

// 把手上的 n 件 id 挪进设备的某个格子
function dlbLoad(m, slot, id, n, extra = it => true) {
  const gid = gridOf(m, dlbSlot(m, slot));
  n -= itemsIn(gid).filter(it => it.id === id && extra(it)).length;   // 格子里已经有的不用再挪
  if (n <= 0) return;
  const list = dlbHeld(id).filter(extra).slice(0, n);
  if (list.length < n) throw new Error(`手上的${ITEMS[id].name}不够`);
  for (const it of list) { const p = findSpot(gid, it); if (!p) throw new Error(`${MACHINES[m.type].name}的格子放不下${ITEMS[id].name}`); placeItem(it, gid, p.x, p.y); }
}

// 做成一次：设备、功法、材料都凑齐，开炉（或做那件事），看有没有出东西
function deliberateOne(b, D, depth = 0) {
  if (b.act) return dlbAct(b, D);
  if (!S.machines.some(m => m.type === b.machine)) { if (buyMachine(b.machine)) throw new Error('买不起设备'); D.route[MACHINES[b.machine].name] = '买设备'; }
  // 挑一种做法：材料、模块、样品全都有刻意来路的那种
  const need = x => [...(x.use || []), ...(x.has || []), ...(x.mod ? [[x.mod]] : []), ...(x.modAny ? [[x.modAny]] : [])].map(([id]) => id);
  const cost = id => dlbBuyable(id) || id === 'gu' ? 0 : BEHAVIORS.some(y => y.machine && y !== b && y.made[0] === id && dlbMakeable(y)) ? 0.5
    : dlbScav(id) ? (dlbScav(id).danger < DLB_SAFE ? 1 : 2) + (ITEMS[id].appraise ? 1 : 0) : dlbMerit(id) ? 3 : 9;
  const a = b.alt.filter(x => need(x).every(id => dlbSourced(id, b))).sort((x, y) => Math.max(0, ...need(x).map(cost)) - Math.max(0, ...need(y).map(cost)))[0] || b.alt[0];
  if (a.tech) dlbTech(a.tech[0], a.tech[1], D);
  if (a.dressable) dlbTech('forgery', 1, D);
  if (a.known) {
    // 仿造要先学会：读到教这门仿法的作伪秘籍
    const bk = BOOKS.filter(x => x[1] === 'forgery' && (x[6] || []).includes(a.known)).sort((x, y) => x[2] - y[2])[0];
    if (!bk) throw new Error(`没有秘籍教仿${ITEMS[a.known].name}`);
    dlbTech('forgery', bk[2], D);
  }
  const m = S.machines.find(x => x.type === b.machine), live = b.machine === 'pen' || b.machine === 'gupot';
  for (const [id, n] of a.has || []) {
    if (id === 'gu') { dlbStock(m, 'pot', 'gu_egg', n, D, depth); D.route[ITEMS.gu.name] = '买蛊卵孵'; continue; }
    dlbStock(m, live ? 'out' : 'in', id, n, D, depth);
  }
  for (const [id, n] of a.use || []) dlbStock(m, 'in', id, n, D, depth);
  if (b.made.includes('~purify')) dlbObtain('water', 1, D, depth);
  if (a.mod) dlbStock(m, 'mod', a.mod, 1, D, depth);
  if (a.modAny) dlbStock(m, 'mod', a.modAny, 1, D, depth);
  if (a.dressable) dlbObtain('iron_ingot', 1, D, depth);
  const outs = () => Object.values(S.items).filter(it => it.pos && [gridOf(m, 'out'), 'floor'].includes(it.pos.g));
  const before = new Set(outs().map(it => it.uid));
  const water0 = Math.max(0, ...Object.values(S.items).filter(it => it.id === 'water').map(it => it.purity));
  // 开炉：材料每夜补上（养蛊、灵宠、噬血藤要喂好几夜），最多熬一个月
  for (let night = 0; night < 30; night++) {
    for (const [id, n] of a.use || []) {
      // 种子只下一次；噬血藤的血食每夜补一份就够
      const want = night && /_seed$/.test(id) ? 0 : night && b.machine === 'yaopot' && ['bones', 'corpse'].includes(id) ? 1 : n;
      dlbStock(m, 'in', id, want, D, depth);
    }
    if (b.made.includes('~purify') && !itemsIn(gridOf(m, 'in')).some(it => it.id === 'water')) dlbLoad(m, 'in', 'water', 1);
    if (a.dressable && !itemsIn(gridOf(m, 'in')).some(dressable)) dlbLoad(m, 'in', 'iron_ingot', 1, it => it.q < 80);
    S.retreat = !!a.retreat; S.vit.st = S.vit.sp = 100;
    // 封盅斗蛊：买来的卵封着不孵，等都孵出来了再封
    if (a.seal) m.seal = itemsIn(gridOf(m, 'pot')).every(it => it.id === 'gu');
    if (machineCheck(m).ok) machineRun(m);
    S.retreat = false;
    const fresh = outs().filter(it => !before.has(it.uid));
    if (fresh.some(it => b.made.includes(it.id) || b.made.includes('*') || (b.made.includes('~fake') && it.fake))
      || (b.made.includes('~purify') && Object.values(S.items).some(it => it.id === 'water' && it.purity > water0))
      || (b.made.includes('~gold_gu') && Object.values(S.items).some(it => it.id === 'gu' && it.growth >= 100))
      || (b.made.includes('~wandu_gu') && Object.values(S.items).some(it => it.id === 'gu' && guStage(it) >= 2))
      || (b.made.includes('~dress') && Object.values(S.items).some(it => it.forged && !it.fake))) {
      // 产物挪回库房，给下一步腾地方
      outs().forEach(it => { if (!b.machine || !live || ITEMS[it.id].cat !== 'chong') autoPlace(it, ['store', 'floor']); });
      return true;
    }
    dlbWait();
  }
  return false;
}

// 非设备的那几样
function dlbAct(b, D) {
  S.vit.st = S.vit.sp = 100;
  switch (b.act) {
    case 'lace': {
      const add = Object.keys(ITEMS).find(id => ITEMS[id].additive === b.kind && dlbSourced(id));
      if (add === 'gu') { deliberateOne(BEHAVIORS.find(x => x.id === 'gold_gu'), D); } else dlbObtain(add, 1, D);
      dlbObtain('spirit_fruit', 1, D);
      const t = dlbHeld('spirit_fruit')[0], a = Object.values(S.items).find(it => HELD(it) && it.id === add);
      laceWith(t, a); return t.laced === b.kind;
    }
    case 'bottle': {
      dlbObtain('jade_bottle', 1, D); dlbObtain('water', 1, D);
      const w = Object.values(S.items).find(it => HELD(it) && it.id === 'water' && !it.bottled);
      return !bottle(w) && w.bottled;
    }
    case 'seal': {
      dlbObtain('seal_xian', 1, D); dlbObtain('pill_qi', 1, D);
      const t = Object.values(S.items).find(it => HELD(it) && canSeal(it));
      return !!t && !sealItem(t) && t.sealed;
    }
    case 'erase': {
      dlbTech('erase', 1, D);
      // 鬼市的法器七成是赃货、带原主烙印：买到一件烙印浅、看得见的为止
      for (let k = 0; k < 40; k++) {
        const t = Object.values(S.items).find(it => HELD(it) && it.mark && canErase(it));
        if (t) { const err = eraseMark(t); if (!err && !t.mark) { D.route['带烙印的赃物'] = '魔修鬼市'; return true; } }
        const st = dealerStock('ghost'), i = st.offers.findIndex(o => ITEMS[o.id].cat === 'qi' && o.lots > 0);
        if (i < 0 || buyLot('ghost', i)) dlbWait(7);
        S.vit.st = S.vit.sp = 100;
      }
      return false;
    }
    case 'soulmark': {
      dlbTech('soul', 1, D);
      for (let k = 0; k < 20; k++) {
        dlbObtain('soul_pearl', 1, D); S.vit.st = S.vit.sp = 100;
        const p = Object.values(S.people).find(p => p.status === 'alive' && !canSoulMark(p));
        if (!p) throw new Error('没有修为低于你、能种魂印的人');
        const r = soulMark(p);
        if (r && !r.err && p.soulBound) return true;
      }
      return false;
    }
    case 'break': {
      // 服炼攒修为：挑能买到的、每灵石修为最多的东西
      const lv = S.cult.lv, key = realm().key;
      D.route[`冲${REALMS[lv].name}之后的关`] = `攒 ${realm().need} 修为`;
      for (let k = 0; k < 800 && S.cult.lv === lv; k++) {
        S.vit.st = S.vit.sp = 100;
        if (condSev('me', 'deviation')) { dlbWait(); cureCond('me', 'deviation'); continue; }
        if (S.cult.xp >= realm().need) {
          dlbObtain(key, 1, D);
          const r = breakthrough(); if (r && r.err) throw new Error(r.err);
          continue;
        }
        // 服炼：回气丹最好买，攒修为
        dlbObtain('pill_qi', 1, D); const it = dlbHeld('pill_qi')[0]; const err = cultivate(it); if (err) throw new Error(err);
      }
      return S.cult.lv > lv;
    }
  }
  return false;
}

// 各开局的起步路线：开局自带的每台设备（没设备就看自带的手艺）至少有一条低阶（买、低风险拾荒）就做得成的行为
function startEntries() {
  return STARTS.map(st => {
    const machines = st.machines || [];
    const groups = machines.length ? machines.map(t => [MACHINES[t].name, BEHAVIORS.filter(b => b.machine === t).map(b => b.id)])
      : Object.keys(st.tech || {}).map(t => [TECHS[t].name, BEHAVIORS.filter(b => b.act === t).map(b => b.id)]).filter(g => g[1].length);
    if (!groups.length) groups.push(['（无设备，先买一台）', BEHAVIORS.filter(b => b.machine && MACHINES[b.machine].price <= 450).map(b => b.id)]);
    return { id: st.id, name: st.name, groups: groups.map(([name, ids]) => {
      const r = deliberateAll(st.id, ids);
      const best = Object.entries(r).filter(([, x]) => x.ok && x.tier === '低阶').sort((a, b) => a[1].days - b[1].days)[0];
      return { name, ok: !!best, best: best ? { id: best[0], name: BEHAVIORS.find(b => b.id === best[0]).name, days: best[1].days, rep: best[1].rep } : null,
        lowCount: Object.values(r).filter(x => x.ok && x.tier === '低阶').length, total: ids.length };
    }) };
  });
}
