// 修为与杀伐：服炼丹药魂魄涨修为，破境要钥匙；修为高过对方，就能杀人夺宝——货、灵石、尸身、魂魄、妖丹
'use strict';

// need：破入下一境所需修为；key：破境的钥匙
const REALMS = [
  { name: '凡人' },
  { name: '炼气', need: 400, key: 'pill_found' },
  { name: '筑基', need: 1600, key: 'blood_infant' },
  { name: '金丹', need: 5000, key: 'soul_crystal' },
  { name: '元婴' },
];

// 服炼所得修为；evil：吞人魂血，损阴德
const CULT_XP = {
  pill_qi: [12], pill_blood: [40], pill_found: [90], waste_pill: [3], herb_blood: [6], vine_fruit: [10],
  soul_wisp: [8, true], soul_grudge: [20, true], soul_pearl: [45, true], yao_core: [35, true],
  live_soul: [80, true], blood_essence: [25, true], blood_infant: [500, true], soul_crystal: [220, true],
};

function initDao() { S.cult = S.cult || { lv: 1, xp: 0 }; }

const realm = (lv = S.cult.lv) => REALMS[lv];
const realmName = (lv = S.cult.lv) => REALMS[lv].name;

// 赝品照样服得下，炼出的是里头那味的修为（见 bodyOf）
function cultXp(it) {
  it = bodyOf(it);
  if (it.id === 'water') return it.purity >= 99.9 ? 20 : 0;
  const e = CULT_XP[it.id];
  if (!e || it.fake) return 0;
  // 走火入魔涨不动，中毒涨得慢
  const state = Math.pow(0.4, condSev('me', 'deviation')) * (condSev('me', 'poisoned') ? 0.7 : 1);
  return Math.round(e[0] * potency(it) * state);
}

// 服炼：涨修为。吞魂饮血的，越炼越不像人
function cultivate(it) {
  const xp = cultXp(it);
  if (!xp) return '这东西炼不出修为。';
  const err = exert('cultivate');
  if (err) return err;
  S.cult.xp += xp;
  if ((CULT_XP[bodyOf(it).id] || [])[1]) karmaShift(-1);
  log(`你服炼${itemName(it)}，修为 +${xp}（${S.cult.xp}/${realm().need || '—'}）。`, 'gain');
  tasteFake(it);
  destroyItem(it);
  return null;
}

function breakOdds() {
  const r = realm();
  const hurt = 0.15 * condSev('me', 'injured') + 0.1 * condSev('me', 'poisoned');
  return clamp(0.55 + (S.retreat ? 0.15 : 0) + Math.min(0.2, (S.cult.xp - r.need) / r.need * 0.4) - hurt, 0.05, 0.95);
}

// 破境之物要真、要足：赝品、以次充好的服得下去，冲不开关
const flawedKey = it => !!it.fake || isDressed(it);
// 冲关用哪一件：先挑真的；没有真的，就是你看不出毛病、当成真的那件
const breakKey = (r = realm()) => r.key && (ownItem(it => it.id === r.key && !flawedKey(it)) || ownItem(it => it.id === r.key && !knownFlaw(it)));

function canBreak() {
  const r = realm();
  if (!r.need) return '已至此界尽头';
  if (S.cult.xp < r.need) return `修为未满（${S.cult.xp}/${r.need}）`;
  if (condSev('me', 'deviation')) return '走火入魔未愈，冲不了关';
  if (!breakKey(r)) { const bad = owns(r.key); return bad ? `手里的${ITEMS[r.key].name}是${bad.fake ? '赝品' : '以次充好的'}，冲不开关` : `缺破境之物：${ITEMS[r.key].name}`; }
  return null;
}

// 破境：成则境界大进，败则修为折损、元气大伤
function breakthrough() {
  const why = canBreak();
  if (why) return { err: why };
  const err = exert('breakthrough');
  if (err) return { err };
  const r = realm(), key = breakKey(r);
  takeItem(key);
  // 赝品、以次充好的：药力撑不到关口，白白耗去一件，修为倒不折损
  if (flawedKey(key)) {
    log(`你服下${ITEMS[r.key].name}冲关，药力撑不到关口就散了——那是${key.fake ? '一件赝品' : '以次充好的货'}。`, 'loss');
    return { ok: false, text: `药力虚浮，冲到关口就散了，关没冲开。你细细一品才明白：这${ITEMS[r.key].name}是${key.fake ? '假的' : '以次充好的，药性早被作伪伤了'}。` };
  }
  if (Math.random() < breakOdds()) {
    S.cult.xp -= r.need;
    S.cult.lv++;
    S.vit.st = VIT_MAX; S.vit.sp = VIT_MAX;
    log(`你服下${ITEMS[r.key].name}冲关，一举破入${realmName()}！`, 'gold');
    return { ok: true, text: `灵气倒灌，经脉如江河奔涌——你破入了<b>${realmName()}</b>。杂役区里，能让你低头的人又少了一些。` };
  }
  S.cult.xp = Math.round(S.cult.xp * 0.6);
  drain(S.vit.st - 5, S.vit.sp - 5);
  addCond('me', 'deviation', 1, '冲关失败');
  log(`冲关失败，${ITEMS[r.key].name}白白耗去，修为折损四成。`, 'loss');
  return { ok: false, text: `丹力在经脉里横冲直撞，你一口血喷在蒲团上。关，没冲开。` };
}

// 闭关的夜里也在修行
function retreatXp() {
  if (!S.retreat) return 0;
  const n = 20 + 10 * S.cult.lv;
  S.cult.xp += n;
  return n;
}

// 修为在势力里的分量
function daoPower() { return [0, 0, 12, 26, 42][S.cult.lv] || 0; }

// ───────────── 对方的境界 ─────────────

function npcLevel(p) {
  if (p.realm != null) return p.realm;
  const pw = npcBasePower(p);
  return pw < 20 ? 0 : pw < 40 ? 1 : pw < 60 ? 2 : pw < 80 ? 3 : 4;
}

const PROTECTED = ['qian', 'sun', 'tu'];
const killable = p => p && p.status === 'alive' && !p.official && !PROTECTED.includes(p.pid);
// 跟你动手时，中了你的蛊的人跌一境
const cultGap = p => S.cult.lv - (npcLevel(p) - guDrop(p));

function canKill(p) {
  if (!killable(p)) return '动不得：此人是宗门官差';
  if (cultGap(p) < 1) return `${p.name}是${realmName(npcLevel(p))}，你杀不了${ta(p)}`;
  return null;
}

function killOdds(p, night) {
  const w = ownWeapon();
  const arms = !w ? 0 : w.id === 'demon_blade' ? 0.2 : 0.1;
  const guards = Math.min(0.15, Object.values(S.items).filter(it => HELD(it) && ['iron_corpse', 'corpse_king', 'puppet_doll'].includes(it.id)).length * 0.05);
  // 你带伤中毒则难，对方带伤中毒则易
  const state = (condPenalty(p) - condPenalty('me')) / 100;
  return clamp(0.45 + 0.2 * (cultGap(p) - 1) + arms + guards + (night ? 0.08 : 0) - (p.faction === 'yao' ? 0.05 : 0) + state, 0.1, 0.97);
}

// 身上能搜出什么：灵石、肉身、魂魄、精血、妖丹，外加随身之物
function lootPerson(p, where) {
  const lv = npcLevel(p), got = [];
  const add = (id, extra = {}) => { const it = giveItem(id, extra); if (it) got.push(itemName(it)); return it; };
  const cash = Math.round(rnd(30, 120) * p.budgetMul * (lv + 1));
  earn(cash, `从${p.name}身上搜出 ${cash} 灵石。`);
  if (where === 'counter') goodsOf().forEach(it => {
    ['ask', 'knew', 'told', 'disputed'].forEach(k => delete it[k]);
    it.stolen = 5;
    if (hasQuality(it) && !it.mark) stampMark(it, p.faction);
    stow(it);
    got.push(itemName(it));
  });
  if (p.faction === 'yao') {
    add('yao_core', { q: clamp(45 + lv * 12 + rint(0, 15), 5, 100) });
    if (Math.random() < 0.5) add('beast_hide', { q: rint(50, 85) });
    add('soul_grudge');
  } else if (lv === 0) {
    add('corpse', { fresh: 6 });
    add(p.aff < -30 ? 'soul_grudge' : 'soul_wisp');
  } else {
    add('cult_corpse', { q: clamp(40 + lv * 12, 5, 100) });
    add('live_soul', { q: clamp(45 + lv * 12, 5, 100) });
    for (let i = 0; i < lv; i++) add('blood_essence', { q: rint(50, 85) });
  }
  if (Math.random() < 0.5) add(weighted(SELL_POOLS[p.faction]), { stolen: 4 });
  return { cash, got };
}

// 杀人夺宝。where：'counter' 关门打狗；'night' 夜里截杀
function killPerson(p, where) {
  const why = canKill(p);
  if (why) return { err: why };
  if (where === 'night' && S.scavenged) return { err: '今夜已经出过门了' };
  const err = exert('kill');
  if (err) return { err };
  if (where === 'night') S.scavenged = true;
  if (Math.random() >= killOdds(p, where === 'night')) {
    remember(p, '你想要他的命，被他逃了。', -100, 'betrayed');
    addCond('me', 'injured', 2, `与${p.name}搏命`); addCond(p, 'injured', 1, '从你手里拼死逃脱');
    const dmg = retaliate(p, 90);
    drain(30, 20); addHeat(8);
    const fee = payUpTo(rint(30, 100), '与人搏命受了伤，求医问药。');
    if (where === 'counter') dismissCustomer(false);
    return { ok: false, text: `${p.name}拼死挣脱，撞开门板逃了出去。你挨了一记，养伤花了 ${fee} 灵石。\n${dmg}` };
  }
  const loot = lootPerson(p, where);
  const traitor = p.secret && p.secret.known && p.secret.to === 'mo';
  die(p, where === 'night' ? `${p.name}夜里走在巷子里，从此再没人见过。` : `${p.name}进了一间当铺，从此再没人见过。`);
  p.killed = true;
  karmaShift(-12);
  commitSin('harm', { p, w: 3, what: `杀了${p.name}` });
  S.stats.kills = (S.stats.kills || 0) + 1;
  const seen = clamp((where === 'counter' ? 0.2 + 0.07 * S.queue.length : 0.1) - playerPower() / 500, 0.03, 0.8);
  let tail;
  if (traitor) {
    addHeat(-8); adjustRep('mo', 2);
    tail = `${ta(p)}是${p.secret.type}——执法堂只当你替宗门除了一害。`;
  } else if (Math.random() < seen) {
    addHeat(where === 'counter' ? 20 : 12); adjustRep(p.faction, -8);
    startScandal(p, 'murder');
    tail = '可惜有人看见了。风声已经传出去。';
  } else {
    adjustRep(p.faction, -1);
    tail = '没人看见。杂役区每天都有人失踪。';
  }
  if (where === 'counter') { clearCounter(); returnTray(); S.customer = null; }
  log(`你杀了${p.name}，搜得${loot.got.join('、')}。`, 'loss');
  return { ok: true, text: `${where === 'counter' ? '你闩上门板。' : '你在巷口等到三更。'}${p.name}还没来得及出声，就软倒了下去。\n搜得 ${loot.cash} 灵石、${loot.got.join('、')}。\n${tail}` };
}

// 种魂印：以魂珠为引，在修为低于你的人识海里烙下印记，从此难违你意
function soulMarkOdds(p) { return clamp(0.4 + 0.15 * cultGap(p) + techLv('soul') * 0.05, 0.05, 0.9); }

function canSoulMark(p) {
  if (!killable(p) || p.soulBound) return '种不了';
  if (cultGap(p) < 1) return '修为不及对方';
  if (!techLv('soul')) return '须通炼魂之术';
  if (!owns('soul_pearl')) return '缺一颗炼魂珠作引';
  return null;
}

function soulMark(p) {
  const why = canSoulMark(p);
  if (why) return { err: why };
  const err = exert('soulmark');
  if (err) return { err };
  takeItem(owns('soul_pearl'));
  karmaShift(-4);
  commitSin('harm', { p, w: 2, what: `给${p.name}种魂印` });
  if (Math.random() < soulMarkOdds(p)) {
    p.soulBound = { day: S.day };
    remember(p, '恍惚了一下，识海里多了些什么。', 0);
    return { ok: true, text: gx(p, `魂珠在你掌心化开，一缕黑气钻进${p.name}的眉心。他晃了晃，眼神空了一瞬，又恢复如常——只是从此，你说的话，他很难不听。`) };
  }
  remember(p, '你想在他识海里种魂印，被他察觉。', -60, 'controlled');
  startScandal(p, 'control');
  return { ok: false, text: gx(p, `${p.name}猛地一挣，魂印碎成黑烟。他惊怒交加地瞪着你：“你……你想炼我的魂？”`) };
}
