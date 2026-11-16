// 宗门派系：执法堂、战堂、丹房、少宗主一系明争暗斗。攀上一系，换来的不是货，而是别人拿不到的买卖；
// 押错了人，靠山倒台时一并清算。权贵也在这张网里——傲慢、阔绰、眼力平平，正好拿假货宰他们
'use strict';

// likes：进献时看重的品类；eye：验货的眼力；opps：独家买卖的种类
const CLIQUES = {
  law:  { name: '执法堂', head: '冷长老', portrait: 'mo_enforcer', rival: 'heir', likes: ['xin', 'fu', 'ju'], eye: 3, opps: ['auction', 'launder', 'contra'],
    desc: '管着刑名与抄没。攀上他们，抄家抄来的好货先过你的手，赃物也能过明路。' },
  war:  { name: '战堂', head: '屠长老', portrait: 'mo_disciple', rival: 'dan', likes: ['qi', 'shi', 'hun', 'fu'], eye: 2, opps: ['order', 'captive', 'order'],
    desc: '前线的军需都从这儿走。军械订单出价高，战俘也论斤卖。' },
  dan:  { name: '丹房', head: '药长老', portrait: 'ren_cultivator', rival: 'war', likes: ['dan', 'cai', 'yao', 'zhi'], eye: 3, opps: ['license', 'supply', 'order'],
    desc: '宗门的丹药生意。拿到包销，你的丹药不愁卖；珍稀药材也按配给价拨给你。' },
  heir: { name: '少宗主一系', head: '血公子', portrait: 'noble', rival: 'law', likes: ['wan', 'qi', 'yin'], eye: 1, opps: ['salon', 'order', 'tip'],
    desc: '少宗主和他身边那群纨绔。出手阔绰，眼力平平，最好面子——雅集上的权贵，个个是待宰的肥羊。' },
};

// 各系订单要的货：前几样常有，后面的要“门下”才给
const ORDER_GOODS = {
  war: ['sword_std', 'fu_jingang', 'soul_pearl', 'iron_corpse', 'puppet_doll', 'corpse_king'],
  dan: ['pill_qi', 'pill_blood', 'vine_fruit', 'herb_blood', 'pill_found', 'blood_infant'],
  heir: ['spirit_wine', 'jade_pendant', 'bronze_mirror', 'scroll_manual', 'soul_banner', 'demon_blade'],
};

function initPolitics() {
  if (S.cliques) return;
  S.cliques = { joined: null, opps: [], week: -1 };
  for (const k in CLIQUES) S.cliques[k] = { st: 0, pw: rint(45, 65) };
}

const cliqueSt = k => S.cliques[k].st;
function tierOf(k) {
  if (S.cliques.joined === k) return 3;
  const st = cliqueSt(k);
  return st >= 60 ? 2 : st >= 30 ? 1 : st >= 10 ? 0 : -1;
}
const TIER_NAME = { '-1': '陌生', 0: '有往来', 1: '座上客', 2: '心腹', 3: '门下' };

function shiftSt(k, d) { S.cliques[k].st = clamp(Math.round(S.cliques[k].st + d), -60, 100); }

// ───────────── 结交 ─────────────

// 孝敬灵石：越熟越难再往上走
function cliqueTribute(k, n) {
  if (S.stones < n) return '灵石不够';
  spend(n, `孝敬${CLIQUES[k].head} ${n} 灵石。`);
  shiftSt(k, n / (8 + Math.max(0, cliqueSt(k)) / 4));
  shiftSt(CLIQUES[k].rival, -n / 60);
  return null;
}

// 进献货物：对口的加倍看重；假货要过他们的眼
function cliqueGiftValue(k, it) {
  return Math.round(knownValue(it) * priceMul(it.id) * (CLIQUES[k].likes.includes(ITEMS[it.id].cat) ? 1.5 : 0.6));
}

function cliqueOffer(k, it) {
  const C = CLIQUES[k], name = itemName(it);
  if (isFlawed(it) && Math.random() < (C.eye >= (it.grade || 1) ? 0.7 : 0.05)) {
    destroyItem(it);
    shiftSt(k, -15);
    if (k === 'law') addHeat(8);
    return { bad: true, text: `${C.head}把${name}往地上一摔：“拿这种东西糊弄我？”` };
  }
  const v = cliqueGiftValue(k, it);
  const d = v / (20 + Math.max(0, cliqueSt(k)) / 2);
  shiftSt(k, d);
  destroyItem(it);
  return { text: `${C.head}收下了${name}。（${C.name}好感 +${Math.round(d)}）` };
}

// 投靠：从此是这一系的人，对头一系把你当眼中钉
function joinClique(k) {
  if (S.cliques.joined) return '你已经有靠山了';
  if (cliqueSt(k) < 30) return `${CLIQUES[k].name}还没把你当自己人（好感 30 才肯收）`;
  S.cliques.joined = k;
  shiftSt(CLIQUES[k].rival, -25);
  for (const o in CLIQUES) if (o !== k && o !== CLIQUES[k].rival) shiftSt(o, -5);
  S.cliques.week = -1;
  log(`你投到了${CLIQUES[k].head}门下。${CLIQUES[CLIQUES[k].rival].name}从此视你为敌。`, 'gold');
  return null;
}

// ───────────── 独家买卖 ─────────────

function marketPrice(id) { return Math.round(rawValue({ id, q: 70 }) * priceMul(id)); }

function makeOpp(k, type, tier) {
  const until = S.day + 7, o = { cid: k, type, until, key: `${k}${type}${S.day}${rint(0, 9999)}` };
  const goods = ORDER_GOODS[k];
  switch (type) {
    case 'order': {
      const id = pick(goods.slice(0, tier >= 3 ? goods.length : 4));
      const n = ITEMS[id].base >= 600 ? 1 : rint(2, 4);
      return Object.assign(o, { id, left: n, unit: Math.round(marketPrice(id) * (1.6 + 0.15 * tier)) });
    }
    case 'auction': {
      // 抄家抄来的整批货：来路已由执法堂洗净
      const pool = [...SELL_POOLS.mo, ...SELL_POOLS.xian].filter(([id]) => ITEMS[id].base >= 70);
      const items = Array.from({ length: rint(3, 4) }, () => weighted(pool));
      const v = items.reduce((s, id) => s + marketPrice(id), 0);
      return Object.assign(o, { items, value: v, price: Math.round(v * (tier >= 3 ? 0.3 : 0.42) / 10) * 10 });
    }
    case 'launder': return Object.assign(o, { rate: tier >= 3 ? 0.06 : 0.12 });
    case 'contra': {
      // 仙门禁物在执法堂这儿是缴获，可以明着收
      const id = pick(['xian_sword', 'xian_talisman', 'xian_robe']);
      return Object.assign(o, { type: 'order', id, left: rint(1, 3), unit: Math.round(marketPrice(id) * (1.3 + 0.1 * tier)) });
    }
    case 'captive': return Object.assign(o, { price: tier >= 3 ? 220 : 320, left: tier >= 3 ? 2 : 1 });
    case 'license': return Object.assign(o, { cat: 'dan', mul: 1.3 + 0.05 * tier, left: 6 });
    case 'supply': {
      const id = pick(['yao_core', 'herb_blood', 'dan_guide', tier >= 2 ? 'pill_recipe' : 'yao_core']);
      return Object.assign(o, { id, left: id === 'pill_recipe' ? 1 : rint(2, 4), unit: Math.round(marketPrice(id) * 0.5) });
    }
    case 'salon': return Object.assign(o, { guests: tier >= 2 ? 3 : 2 });
    case 'tip': return o;
  }
  return o;
}

// 每周换一批机会：交情越深、越是自己人，机会越多越好
function refreshOpps() {
  const week = Math.floor((S.day - 1) / 7);
  if (S.cliques.week === week) return;
  S.cliques.week = week;
  S.cliques.opps = [];
  for (const k in CLIQUES) {
    const t = tierOf(k);
    if (t < 0) continue;
    const pool = CLIQUES[k].opps;
    for (let i = 0; i < Math.min(3, t + 1); i++) S.cliques.opps.push(makeOpp(k, pool[i % pool.length], t));
  }
}

const liveOpps = () => { refreshOpps(); return S.cliques.opps.filter(o => o.until >= S.day && !o.done); };
const findOpp = key => S.cliques.opps.find(o => o.key === key);

// 交货：按单价收；验货不过，整单作废
function oppGoods(o) {
  if (o.type === 'order') return Object.values(S.items).filter(it => HELD(it) && it.id === o.id);
  if (o.type === 'license') return Object.values(S.items).filter(it => HELD(it) && ITEMS[it.id].cat === o.cat && !ITEMS[it.id].illicit);
  return [];
}

function oppUnit(o, it) {
  if (o.type === 'license') return Math.round(knownValue(it) * priceMul(it.id) * o.mul);
  return Math.round(o.unit * (hasQuality(it) ? 0.75 + shownQ(it) / 280 : 1));
}

function deliverOpp(o, it) {
  const C = CLIQUES[o.cid], name = itemName(it);
  if (isFlawed(it) && Math.random() < (C.eye >= (it.grade || 1) ? 0.7 : 0.05)) {
    destroyItem(it);
    o.done = true;
    shiftSt(o.cid, -20);
    if (o.cid === 'law') addHeat(10);
    return { bad: true, text: `${C.name}的执事验出${name}有假，当场撕了单子：“往后别再来了。”` };
  }
  const price = oppUnit(o, it);
  if (isFlawed(it)) S.cliques.fakes = (S.cliques.fakes || 0) + 1;
  if (ITEMS[it.id].war) fuelWar(it, price);
  earn(price, `${name}交给${C.name}，得 ${price} 灵石。`);
  destroyItem(it);
  shiftSt(o.cid, 2);
  if (--o.left <= 0) o.done = true;
  return { text: `${C.name}收下${name}，付 ${price} 灵石。` };
}

function takeOpp(o) {
  const C = CLIQUES[o.cid];
  switch (o.type) {
    case 'auction': {
      if (S.stones < o.price) return { err: '灵石不够' };
      spend(o.price, `在${C.name}的抄没拍卖上拍下一批货。`);
      const got = o.items.map(id => giveItem(id, { q: rint(55, 85) })).filter(Boolean);
      o.done = true;
      return { text: `抄没的货送到了：${got.map(itemName).join('、')}。来路干净，执法堂的封条还贴着。` };
    }
    case 'launder': {
      const dirty = Object.values(S.items).filter(it => HELD(it) && (it.stolen > 0 || it.mark));
      if (!dirty.length) return { err: '你手里没有来路不明的货' };
      const fee = Math.max(20, Math.round(dirty.reduce((s, it) => s + claimedValue(it), 0) * o.rate / 10) * 10);
      if (S.stones < fee) return { err: `过明路要 ${fee} 灵石` };
      spend(fee, `托${C.name}给 ${dirty.length} 件赃物过了明路。`);
      dirty.forEach(it => { it.stolen = 0; delete it.mark; });
      o.done = true;
      return { text: `${dirty.length} 件货补上了执法堂的勘合，从此来路清白。` };
    }
    case 'captive': {
      if (S.stones < o.price) return { err: '灵石不够' };
      spend(o.price, `从${C.name}手里买下一名战俘。`);
      const got = [giveItem('cult_corpse', { q: rint(50, 75) }), giveItem('live_soul', { q: rint(50, 80) }), giveItem('blood_essence'), giveItem('blood_essence')].filter(Boolean);
      karmaShift(-3);
      commitSin('harm', { w: 1, what: '买下战俘处置' });
      if (--o.left <= 0) o.done = true;
      return { text: `战俘是个仙门的筑基弟子，押来时已经只剩半口气。处置完了，你得到${got.map(itemName).join('、')}。` };
    }
    case 'supply': {
      if (S.stones < o.unit) return { err: '灵石不够' };
      const it = giveItem(o.id);
      if (!it) return { err: '库房放不下' };
      spend(o.unit, `按丹房配给价购得${itemName(it)}。`);
      if (--o.left <= 0) o.done = true;
      return { text: `${itemName(it)}按配给价拨给了你。` };
    }
    case 'salon': {
      S.flags.salon = { day: S.day + (S.phase === 'morning' ? 0 : 1), n: o.guests };
      o.done = true;
      return { text: `血公子在请柬上添了你铺子的名字。${S.phase === 'morning' ? '今天' : '明天'}，会有 ${o.guests} 位权贵上门“赏玩”。` };
    }
    case 'tip': {
      const it = makeIntel('market');
      o.done = true;
      return it ? { text: `少宗主身边的人透了个口风，你记成了一份${itemName(it)}。` } : { err: '库房放不下' };
    }
  }
  return { err: '' };
}

// ───────────── 倾轧与清洗 ─────────────

const PURGE_TEXT = ['被查出私通仙门', '贪墨军饷事发', '炼丹害死了一位长老的亲传', '在宗主面前失了宠', '被人告发私藏禁物'];

// 每周推演各系消长；有人倒台，跟着他的人一并清算，对头一系论功行赏
function cliqueTick() {
  if (S.day % 7) return [];
  const out = [];
  const J = S.cliques.joined;
  for (const k in CLIQUES) {
    const c = S.cliques[k];
    c.pw = clamp(c.pw + rnd(-9, 9) + (J === k ? 3 : 0) - (J === CLIQUES[k].rival ? 2 : 0), 0, 100);
    if (J !== k) shiftSt(k, -2);
  }
  if (Math.random() < 0.4) {
    const a = pick(Object.keys(CLIQUES)), b = CLIQUES[a].rival;
    S.cliques[a].pw = clamp(S.cliques[a].pw + 5, 0, 100);
    S.cliques[b].pw = clamp(S.cliques[b].pw - 12, 0, 100);
    worldNews(`${CLIQUES[a].name}在宗主面前参了${CLIQUES[b].name}一本。`);
    out.push({ icon: 'ic_clique', title: '宗门倾轧', text: `${CLIQUES[a].name}在宗主面前参了${CLIQUES[b].name}一本，${CLIQUES[b].head}的位子有些不稳了。`, cls: 'warn' });
  }
  for (const k in CLIQUES) if (S.cliques[k].pw <= 20) out.push(purge(k));
  if (J && cliqueSt(CLIQUES[J].rival) <= -30 && Math.random() < 0.5) {
    addHeat(5);
    out.push({ icon: 'ic_clique', title: '使绊子', text: `${CLIQUES[CLIQUES[J].rival].name}的人记恨你，在执法堂给你记了一笔（执法堂关注 +5）`, cls: 'bad' });
  }
  return out;
}

function purge(k) {
  const C = CLIQUES[k], J = S.cliques.joined;
  const why = pick(PURGE_TEXT);
  worldNews(`${C.head}${why}，${C.name}一系遭到清洗。`, 'bad');
  S.cliques[k] = { st: Math.round(S.cliques[k].st * 0.3), pw: 50 };
  S.cliques.opps = S.cliques.opps.filter(o => o.cid !== k);
  S.cliques[C.rival].pw = clamp(S.cliques[C.rival].pw + 15, 0, 100);
  if (J === k) {
    S.cliques.joined = null;
    S.cliques[k].st = -20;
    addHeat(25); adjustRep('mo', -10);
    const seized = Object.values(S.items).filter(it => HELD(it) && it.pos.g !== 'hidden')
      .sort((a, b) => claimedValue(b) - claimedValue(a)).slice(0, 2);
    const names = seized.map(itemName);
    seized.forEach(destroyItem);
    return { icon: 'ic_clique', title: '靠山倒了', cls: 'bad',
      text: `${C.head}${why}，被废去修为打入血狱。你是他门下的人——执法堂上门抄走了${names.join('、') || '你的账册'}，执法堂关注 +25，魔宗声望 -10。` };
  }
  if (J === C.rival) {
    const n = rint(20, 40) * 10;
    earn(n, `${C.name}倒台，${CLIQUES[J].head}论功行赏。`);
    shiftSt(J, 10);
    return { icon: 'ic_clique', title: '对头倒了', cls: 'ok', text: `${C.head}${why}，${C.name}一系树倒猢狲散。${CLIQUES[J].head}赏了你 ${n} 灵石。` };
  }
  return { icon: 'ic_clique', title: '宗门清洗', cls: 'warn', text: `${C.head}${why}，${C.name}一系遭到清洗。新上来的人，不认得你。` };
}

// 内幕递给对头：这一系的位子更不稳了
function leakDirt(it, to) {
  const k = it.info.cid, C = CLIQUES[k];
  if (to !== C.rival) return '这份内幕，只有对头一系才肯出大价钱';
  S.cliques[k].pw = clamp(S.cliques[k].pw - 14, 0, 100);
  shiftSt(to, 15); shiftSt(k, -10);
  destroyItem(it);
  log(`你把${C.name}的内幕递给了${CLIQUES[to].head}。`, 'warn');
  return null;
}

// ───────────── 权贵 ─────────────

const NOBLE_LINES = [
  '（{n}摇着折扇，眼皮都不抬）听说你这破铺子有几件像样的{item}？拿出来，别拿寒碜东西污了本公子的眼。',
  '（{n}用帕子掩着鼻子）这股穷酸味……罢了。有什么好{item}，赶紧拿上来。',
  '（{n}身后跟着两个家奴）本少爷的时间金贵。{item}，要最好的——价钱？你也配跟我谈价钱？',
];

function nobleLine(c) { return fill(pick(NOBLE_LINES), { n: c.name, item: c.wantId ? ITEMS[c.wantId].name : CATS[c.wantCat] }); }

function newNoble() {
  const p = newPerson('mo', { portrait: 'noble', anyFace: true, title: '权贵', savvy: rnd(0.25, 0.45),
    bio: '仗着长辈在内门的权势，在杂役区横着走。花钱如流水，最怕丢脸。' });
  p.title = pick(NOBLE_TITLE[sexOf(p)]);
  Object.assign(p, { noble: true, pride: rnd(0.6, 1), eye: 1, budgetMul: 1.2, wish: null, secret: null });
  return p;
}

// 雅集请柬、少宗主的交情，都会招来权贵
function queueNobles() {
  const s = S.flags.salon;
  let n = s && s.day === S.day ? s.n : 0;
  if (S.day >= 4 && Math.random() < 0.1 + Math.max(0, cliqueSt('heir')) / 400) n++;
  for (let i = 0; i < n; i++) {
    const old = Object.values(S.people).filter(p => p.noble && p.status === 'alive' && p.lastDay < S.day && !S.queue.some(c => c.pid === p.pid));
    const p = old.length && Math.random() < 0.5 ? pick(old) : newNoble();
    S.queue.splice(rint(0, S.queue.length), 0, makeCustomer('mo', 'noble', p));
  }
}

// 吹捧：捧得越高，他越舍得掏钱、越懒得细看；捧过了头，反倒惹他起疑
function flatter(c) {
  const p = personOf(c);
  c.flatter = (c.flatter || 0) + 1;
  if (c.flatter > 3 || Math.random() < p.savvy * 0.25 * c.flatter) {
    c.patience--;
    c.flatter = Math.min(c.flatter, 3);
    return { ok: false, text: `${c.name}冷笑：“马屁也要拍得像样些。”` };
  }
  return { ok: true, text: pick([`${c.name}嘴角一扬：“算你有眼力。”`, `${c.name}啪地合上折扇：“说下去。”`, `${c.name}听得受用，下巴又抬高了三分。`]) };
}
