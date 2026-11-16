// 天机密探：来客各有不可告人的身份；神识探出来，举报给对立的一方换赏金、功勋与声望，或者拿来要挟、卖个人情
'use strict';

// type：秘密；to：该向哪一方举报；chance：各族有此秘密的几率
const SECRETS = {
  xian: [{ type: '仙门卧底', to: 'mo', bounty: [260, 480], merit: 3, chance: 0.55 }],
  mo: [{ type: '猎妖人', to: 'yao', bounty: [150, 300], merit: 3, chance: 0.16 },
       { type: '血煞宗密探', to: 'xian', bounty: [240, 440], merit: 3, chance: 0.12 },
       { type: '临阵逃兵', to: 'mo', bounty: [120, 240], merit: 2, chance: 0.08 }],
  yao: [{ type: '妖族细作', to: 'mo', bounty: [180, 340], merit: 3, chance: 0.3 }],
  ren: [{ type: '逃奴', to: 'mo', bounty: [80, 160], merit: 1, chance: 0.14 },
        { type: '魔宗眼线', to: 'ren', bounty: [100, 180], merit: 2, chance: 0.1 }],
};

function rollSecret(p) {
  if (p.story || p.official) return null;
  for (const s of SECRETS[p.faction] || []) {
    if (Math.random() < s.chance) return { type: s.type, to: s.to, bounty: rint(...s.bounty), merit: s.merit, known: false };
  }
  return null;
}

// 神识探查：鉴定术越高、他越信你、越不精明，越容易看透
function probeOdds(p) { return clamp(0.45 + appraiseLevel() * 0.1 + Math.max(0, p.aff) / 200 - p.savvy * 0.3 + 0.05 * (S.cult.lv - 1), 0.05, 0.92); }

function probe(c) {
  const p = personOf(c);
  if (!p || c.probed) return { err: '探不了' };
  const err = exert('probe');
  if (err) return { err };
  c.probed = true;
  if (Math.random() >= probeOdds(p)) {
    if (Math.random() < p.savvy * 0.4) { remember(p, '察觉你用神识窥探他。', -8, 'insulted'); return { text: `你的神识刚一探出，${p.name}眉头一皱，往后退了半步。他察觉了。`, cls: 'bad' }; }
    return { text: `${p.name}的心思藏得很深，你什么也没看出来。` };
  }
  if (!p.secret) { p.cleared = true; return { text: `你看透了${p.name}：身家清白，没什么可疑的。` }; }
  p.secret.known = true;
  return { text: `你的神识掠过${p.name}的识海——此人是<b>${p.secret.type}</b>！`, cls: 'good' };
}

// 熟到一定份上，有人会主动向你吐露
function maybeConfide(c) {
  const p = personOf(c);
  if (p && p.secret && !p.secret.known && p.aff >= 60 && Math.random() < 0.3) { p.secret.known = true; c.confided = true; }
}

// 举报：赏金、功勋、受益方声望；被举报者的同族记恨，风声也可能走漏
// 举报：可以当面，也可以凭线索在「人物」页暗中递上去
function reportSecret(c) {
  const p = c.pid ? S.people[c.pid] : personOf(c), s = p.secret;
  if (!channelOpen(s.to)) return { err: `还没和${CHANNEL_NAME[s.to]}搭上线（${channelHint(s.to)}）` };
  // 战事越紧，细作越值钱
  s.bounty = Math.round(s.bounty * (1 + 0.4 * S.world.stage) / 10) * 10;
  s.merit += S.world.stage >= 2 ? 1 : 0;
  earn(s.bounty, `向${CHANNEL_NAME[s.to]}举报${s.type}${p.name}，得赏金 ${s.bounty} 灵石。`);
  S.merit[s.to] += s.merit;
  adjustRep(s.to, 4); adjustRep(p.faction, -4);
  remember(p, `你把他是${s.type}的事告发了。`, -100, 'betrayed');
  p.status = s.to === 'mo' ? 'jailed' : 'dead';
  lifeNote(p, s.to === 'mo' ? `被你告发是${s.type}，押入血狱。` : `被你告发是${s.type}，死在${FACTIONS[s.to].name}手里。`);
  p.secret = null;
  let leak = '';
  if (Math.random() < 0.2) {
    adjustRep(p.faction, -8);
    leak = `风声走漏，${FACTIONS[p.faction].name}都知道是你告的密。`;
  }
  if (S.customer && S.customer.pid === p.pid) dismissCustomer(false);
  return { text: `${CHANNEL_NAME[s.to]}的人当天就把${p.name}带走了。赏金 ${s.bounty} 灵石，${FACTIONS[s.to].name}功勋 +${s.merit}。${leak}`, cls: leak ? 'bad' : 'good' };
}

// 要挟：他掂量你的势力，给钱或翻脸
function blackmail(c) {
  const p = personOf(c), s = p.secret;
  const ask = Math.round(s.bounty * 0.6 * Math.max(0.5, p.budgetMul) / 10) * 10;
  if (Math.random() < overpowerOdds(p) + 0.1) {
    earn(ask, `${p.name}拿 ${ask} 灵石换你闭嘴。`);
    remember(p, `你拿他${s.type}的身份要挟他，敲了 ${ask} 灵石。`, -30, 'blackmailed');
    p.blackmailed = (p.blackmailed || 0) + 1;
    dismissCustomer(false);
    return { text: `${p.name}脸色铁青，数了 ${ask} 灵石放在柜上：“够了吧？”`, cls: 'good' };
  }
  const dmg = retaliate(p, 60);
  remember(p, '你想拿他的身份要挟他。', -40, 'blackmailed');
  dismissCustomer(false);
  return { text: `${p.name}冷冷地看着你：“你大可去告。”\n${ta(p)}转身走了——${dmg}`, cls: 'bad' };
}

// 守口如瓶：他欠你一个人情，往后会替你留意风声
function keepSecret(c) {
  const p = personOf(c);
  remember(p, `你知道他是${p.secret.type}，却替他保守了秘密。`, 18, 'helped');
  p.owes = true;
  return { text: `你压低声音：“你的事，我不会说出去。”${p.name}愣了愣，郑重地点了点头。`, cls: 'good' };
}

// 交好的熟客夜里会透露别人的底细
function gossipTick() {
  const out = [];
  const friends = Object.values(S.people).filter(p => p.status === 'alive' && !p.story && p.aff >= 30 && S.day - p.lastDay <= 10);
  for (const f of friends) {
    if (Math.random() > 0.12) continue;
    const t = pick(Object.values(S.people).filter(p => p !== f && p.status === 'alive' && p.secret && !p.secret.known) || []);
    if (!t) continue;
    t.secret.known = true;
    out.push({ icon: 'ic_secret', title: '线索', text: `${f.name}悄悄告诉你：${t.name}（${t.title}）是${t.secret.type}。可在「人物」页向${CHANNEL_NAME[t.secret.to]}举报。`, cls: 'warn' });
    if (out.length >= 2) break;
  }
  return out;
}

// 欠你人情的人也是线人
function owedInformants() {
  return Object.values(S.people).filter(p => p.owes && p.status === 'alive').map(p => [p, 0.35]);
}

// ───────────── 消息买卖 ─────────────

// 消息是一纸密报：可以自己用，也可以卖、可以送。值多少看写的是什么、给了谁、过没过时
// info：{ kind, title, text, value, until, ... }
const intelExpired = it => !it.info || it.info.until < S.day;
function intelValue(it) { return intelExpired(it) ? 2 : it.info.value; }

const RUMORS = [
  ['dan', '丹会提前开市'], ['qi', '外门大比改了日子'], ['hun', '血月祭要多炼一批魂幡'], ['shi', '战堂要补一批铁尸'],
  ['yin', '妖族使团要进山'], ['fu', '护山大阵要换符'], ['cai', '炼器坊要赶一批军械'], ['wan', '内门长老要办寿宴'],
];
const DIRT = ['私吞抄没财物', '与仙门暗通款曲', '虚报军饷', '拿活人试药', '私开灵脉'];

// 造一份密报，放进库房；放不下返回 null
function makeIntel(kind, opt = {}) {
  const info = { kind, until: S.day + 14 };
  if (kind === 'market') {
    const [cat, why] = pick(RUMORS), day = S.day + rint(2, 3), up = rnd(0.35, 0.6);
    S.world.pending = S.world.pending || [];
    S.world.pending.push({ day, cats: { [cat]: up }, days: 4, text: `${why}，${CATS[cat]}行情大涨。` });
    Object.assign(info, { title: `密报·${CATS[cat]}`, until: day, value: Math.round(60 + up * 300),
      text: `第${day}日前后${why}，${CATS[cat]}要涨${Math.round(up * 100)}%上下。趁消息没传开囤货；过了那天，这张纸就不值钱了。` });
  } else if (kind === 'secret') {
    const p = opt.p, s = p.secret;
    Object.assign(info, { title: `把柄·${p.name}`, pid: p.pid, value: Math.round(s.bounty * 0.5),
      text: `${p.name}（${p.title}）是${s.type}。卖给${FACTIONS[s.to].name}的人，他们自会动手；卖回给${ta(p)}本人，${ta(p)}肯出大价钱买你闭嘴。` });
    s.filed = true;
  } else if (kind === 'treasure') {
    const loc = pick(LOCATIONS), id = pick(loc.loot.filter(([, w]) => w <= 2))[0];
    Object.assign(info, { title: `藏宝·${loc.name}`, loc: loc.id, id, value: Math.round(ITEMS[id].base * 0.35 + 20),
      text: `${loc.name}某处埋着一件${ITEMS[id].name}。去那儿拾荒时，头一回翻找必有所获。` });
  } else if (kind === 'clique') {
    const cid = opt.cid || pick(Object.keys(CLIQUES)), C = CLIQUES[cid];
    Object.assign(info, { title: `内幕·${C.name}`, cid, value: 180,
      text: `${C.head}${pick(DIRT)}的凭据。递给${CLIQUES[C.rival].name}，足以动摇${C.name}的根基；卖给魔宗的人，也能换些灵石。` });
  }
  const it = makeItem('intel', { info, q: 60 });
  stow(it);
  return it;
}

// 谁肯为这份消息出价
function intelMul(c, it) {
  if (intelExpired(it)) return 0.1;
  const i = it.info;
  if (i.kind === 'secret') {
    const t = S.people[i.pid];
    if (!t || t.status !== 'alive' || !t.secret) return 0.1;
    return c.pid === i.pid ? 3 : c.faction === t.secret.to ? 1.6 : 0.3;
  }
  if (i.kind === 'treasure') return c.faction === 'ren' ? 1.2 : 0.6;
  if (i.kind === 'clique') return c.faction === 'mo' ? 1 : 0.3;
  return c.faction === 'ren' && c.title === '凡人行商' ? 1.3 : 1;
}

// 消息到了别人手里：把柄会要人命，行情让人发财
function deliverIntel(p, it) {
  if (!p || it.id !== 'intel' || intelExpired(it)) return;
  const i = it.info;
  if (i.kind === 'secret') {
    const t = S.people[i.pid];
    if (!t || t.status !== 'alive' || !t.secret) return;
    if (t === p) { remember(p, '从你手里买回了自己的把柄。', 4); return; }
    if (p.faction !== t.secret.to) return;
    t.status = t.secret.to === 'mo' ? 'jailed' : 'dead';
    lifeNote(t, `${t.secret.type}的身份被人卖给了${FACTIONS[t.secret.to].name}。`);
    remember(t, '有人把他的底细卖了出去。', -30);
    adjustRep(t.secret.to, 2);
    worldNews(`${t.name}（${t.title}）被揭发是${t.secret.type}，再没出现过。`);
    t.secret = null;
  } else if (i.kind === 'market') remember(p, '靠你给的消息赚了一笔。', 4, 'helped');
  else if (i.kind === 'clique' && p.faction === 'mo') S.cliques[i.cid].pw = clamp(S.cliques[i.cid].pw - 6, 0, 100);
}

// 风声成真：到了日子，密报里说的事就发生了
function pendingTick() {
  const out = [];
  S.world.pending = (S.world.pending || []).filter(e => {
    if (e.day > S.day + 1) return true;
    addShock(e.cats, e.days + 1, e.text);
    worldNews(e.text);
    out.push({ icon: 'ic_war', title: '风声成真', text: e.text, cls: 'warn' });
    return false;
  });
  return out;
}

// 拾荒时手里有这处的藏宝图，头一回翻找必得
function treasureFind(locId) {
  const map = Object.values(S.items).find(it => HELD(it) && it.id === 'intel' && !intelExpired(it) && it.info.kind === 'treasure' && it.info.loc === locId);
  if (!map) return null;
  const id = map.info.id;
  destroyItem(map);
  return id;
}

// 货郎那儿也有卖消息的
function intelShop() {
  if (!S.intelShop || S.intelShop.day !== S.day) {
    S.intelShop = { day: S.day, list: Array.from({ length: rint(1, 2) }, () => weighted([['market', 5], ['treasure', 3], ['clique', 2]])) };
  }
  return S.intelShop.list;
}
const INTEL_PRICE = { market: 130, treasure: 90, clique: 200 };

function buyIntel(i) {
  const kind = S.intelShop.list[i], price = Math.round(INTEL_PRICE[kind] * (1 + diff().markup));
  if (!kind) return '卖完了';
  if (S.stones < price) return '灵石不够';
  const it = makeIntel(kind);
  if (!it) return '库房放不下';
  spend(price, `从消息贩子处买下${itemName(it)}。`);
  S.intelShop.list.splice(i, 1);
  return null;
}
