// 人心与权谋：每个人按自己的利益行事——加料、成瘾、控心、送礼、打点官差、事发追责
'use strict';

// ───────────── 所求与利益 ─────────────

// 各身份最想得到的东西
const WISHES = {
  落魄散修: ['pill_found', 'pill_qi'], 凡人行商: ['spirit_wine', 'jade_pendant'], 杂役少年: ['pill_qi', 'sword_std'],
  游方剑客: ['xian_talisman', 'pill_qi'], 蒙面女修: ['bronze_mirror', 'jade_pendant'], 外门弟子: ['sword_std', 'pill_blood'],
  内门师姐: ['soul_banner', 'soul_pearl'], 狐妖: ['spirit_fruit', 'yao_core'], 虎妖: ['spirit_wine', 'beast_hide'],
  蛇妖: ['pill_found', 'wangyou'], 筑基修士: ['pill_found', 'soul_pearl'], 内门弟子: ['soul_pearl', 'iron_corpse', 'puppet_doll'],
};
WISHES.内门师兄 = WISHES.内门师姐; WISHES.蒙面修士 = WISHES.蒙面女修; WISHES.杂役少女 = WISHES.杂役少年;
const WAR_WISHES = { mo: ['sword_std', 'pill_blood', 'soul_pearl', 'iron_corpse', 'puppet_doll', 'vine_fruit'], ren: ['vine_fruit', 'pill_qi'], yao: ['vine_fruit', 'herb_blood'] };
const GREED = { ren: 0.5, mo: 0.65, xian: 0.3, yao: 0.4 };
const CAUTION = { ren: 0.6, mo: 0.2, xian: 0.9, yao: 0.5 };

function initTraits(p) {
  if (p.health == null) p.health = 100;
  if (p.greed == null) p.greed = clamp(GREED[p.faction] + rnd(-0.2, 0.2), 0.05, 0.95);
  if (p.integrity == null) p.integrity = 0.3;
  if (p.caution == null) p.caution = clamp(CAUTION[p.faction] + rnd(-0.15, 0.15), 0, 1);
  if (p.wish === undefined) p.wish = WISHES[p.title] && Math.random() < 0.65 ? pick(WISHES[p.title]) : null;
  if (p.secret === undefined) p.secret = rollSecret(p);
  if (p.eye == null) { const t = SAME_TITLE[p.title] || p.title; p.eye = EYES[t] != null ? EYES[t] : p.official ? 2 : 1; }
}

// 战事改变人们想要的东西
function rerollWarWishes() {
  const st = S.world.stage;
  for (const p of Object.values(S.people)) {
    if (p.story || p.official || p.status !== 'alive') continue;
    const pool = st >= 2 && WAR_WISHES[p.faction] && (p.faction !== 'ren' || st >= 3) ? WAR_WISHES[p.faction] : null;
    if (pool && Math.random() < 0.5) p.wish = pick(pool);
  }
}

// 陈列柜里摆着他想要的东西，消息会传到他耳朵里
function wishShown(p) { return !!p.wish && itemsIn('display').some(it => it.id === p.wish); }

// 来不来：好感与记忆、瘾、所求、对铺子名声的顾虑、处境、时令与战事
function visitScore(p) {
  if (p.status !== 'alive' || p.lastDay >= S.day) return 0;
  let s = 1 + Math.min(3, p.visits * 0.25);
  s *= clamp(1 + p.aff / 80, 0.25, 2.2);
  if (p.addict) s *= 1 + p.addict * 0.6 * (S.day - (p.lastFix || 0) > 2 ? 2 : 1);
  if (wishShown(p)) s *= 2.2;
  s *= 1 - clamp(S.heat / 100 * p.caution, 0, 0.7);
  s *= trafficMul(p.faction);
  if (p.desperate) s *= 1.6;
  if (p.controlled) s *= 1.3;
  return s;
}

function choosePerson() {
  const queued = new Set(S.queue.map(c => c.pid));
  const regs = Object.values(S.people).filter(p => (!p.story || castRegular(p)) && !p.official && p.status === 'alive' && !queued.has(p.pid));
  const opts = regs.map(p => [p, visitScore(p)]).filter(x => x[1] > 0);
  const total = opts.reduce((s, x) => s + x[1], 0);
  const newW = 2.5 + Math.max(0, 8 - regs.length) * 0.6;
  if (!opts.length || Math.random() < newW / (newW + total)) return newPerson(weighted(factionWeights()));
  return weighted(opts);
}

// 这回来干什么：成瘾的来讨药，走投无路的来当东西，听说有想要的就来买
function decideKind(p) {
  if (p.addict && Math.random() < 0.65) return 'crave';
  if (p.desperate && isWeak(p) && !p.indentured && Math.random() < 0.35) return 'plea';
  if (p.desperate) return Math.random() < 0.7 ? 'sell' : 'buy';
  if (wishShown(p) && Math.random() < 0.75) return 'wish';
  if (p.wantsFakes && Math.random() < 0.4) return 'wantfake';
  // 仙门弟子见多识广，可买去送礼的东西不必是真的——够像就行，图个便宜
  if (p.faction === 'xian' && Math.random() < 0.18) return 'giftfake';
  const r = Math.random();
  if (p.budgetMul > 1.3) return r < 0.25 ? 'sell' : r < 0.9 ? 'buy' : 'appraise';
  return r < 0.45 ? 'sell' : r < 0.86 ? 'buy' : 'appraise';
}

const isAddictive = it => it.id === 'wangyou' || it.laced === 'addict';

// 价格里属于“人”的那部分：所求、瘾、处境
function personPriceRows(c, it) {
  const p = personOf(c), rows = [];
  if (!p) return rows;
  if (c.wishId === it.id) rows.push(['正是他想要的', '+60%']);
  if (c.noble) rows.push(['权贵的排场', `+${10 + 12 * (c.flatter || 0)}%`]);
  if (c.craving && isAddictive(it)) rows.push(['瘾头上来了', `+${p.addict * 40}%`]);
  if (p.aff) rows.push(['好感', `${p.aff > 0 ? '+' : ''}${Math.round(p.aff / 5)}%`]);
  return rows;
}

function personValueMul(c, it) {
  const p = personOf(c);
  let k = 1;
  if (c.wishId === it.id) k *= 1.6;
  if (p && c.craving && isAddictive(it)) k *= 1 + 0.4 * p.addict;
  if (c.noble) k *= 1.1 + 0.12 * (c.flatter || 0);
  if (it.id === 'intel') k *= intelMul(c, it);
  return k;
}

// ───────────── 加料 ─────────────

const LACE = {
  addict:  { name: '忘忧散', verb: '掺了忘忧散', detect: 0.35, desc: '服者成瘾：越来越常来、越来越肯出钱，也越来越虚、越来越穷，直到油尽灯枯。' },
  control: { name: '噬心蛊', verb: '种了噬心蛊', detect: 0.5,  desc: '服者心神受你摆布，可令其上贡、打探、替你行方便。蛊越毒越难察觉。一旦被识破，后果极重。' },
  tonic:   { name: '血灵芝', verb: '添了血灵芝', detect: 0,    desc: '实打实的滋补：气血大补，更易破境，对方念你的好。' },
  poison:  { name: '尸毒',   verb: '下了尸毒',   detect: 0.4,  desc: '服者数日内暴毙。亲友若起疑，必追查到底。' },
};
// 能掺料的：服得下、对人有好处的吃食与药——补气力、涨修为、治伤毒的丹药、灵饮、灵果、草药、妖材入药都算；
// 吞魂饮血的魂魄精血妖丹（不是丹药的）、点的香、本身就是料的、废料不算。货品册写 to.lace 的另补进 LACEABLE
const LACEABLE = [];
const LACE_CATS = ['dan', 'yin', 'zhi', 'cai', 'yao'];
const isLaceable = id => LACEABLE.includes(id) || (LACE_CATS.includes(ITEMS[id].cat) && !ITEMS[id].additive && !JUNK.includes(id)
  && !!(RESTORE[id] || CULT_XP[id] || id === 'water' || Object.values(CONDS).some(c => c.cure.includes(id)))
  && !(CULT_XP[id] && CULT_XP[id][1] && ITEMS[id].cat !== 'dan'));

const canLace = it => isLaceable(it.id) && !it.laced && !it.fake;

// 市面上偶尔混着别人掺过料的货：成瘾的多，下毒、种蛊的少；chance 是这件货被掺过的机会
function marketLace(id, extra, chance) {
  if (!isLaceable(id) || Math.random() >= chance) return extra;
  extra.laced = weighted([['addict', 6], ['poison', 1.5], ['control', 1]]);
  extra.laceGrade = rint(1, 3);
  if (extra.laced === 'control') extra.laceTox = rint(10, 45);
  return extra;
}
const additives = () => Object.values(S.items).filter(it => HELD(it) && ITEMS[it.id].additive);

// 掺了料的货：自己掺的、或验出来了的才算知道；市面上也有别人掺好了的，外表看不出来
const lacedKnown = it => !!it.laced && (it.lacedBy === 'me' || !!it.lacedSeen);
// 掺料的手法：钻研识破的掺料货、或打听到偏门门道才学得会；学会了手脚更干净
const laceSkill = kind => !!(S.laceKnown && S.laceKnown[kind]);

function laceWith(target, add) {
  target.laced = ITEMS[add.id].additive;
  target.lacedBy = 'me';
  if (target.laced === 'tonic') target.laceQ = add.q;
  // 成蛊比幼蛊难察觉，进化过的更难
  if (add.id === 'gu') target.laceTox = add.tox + [0, 40, 55, 70][guStage(add)];
  destroyItem(add);
  tally('cruel');
  log(`你在${itemName(target)}里${LACE[target.laced].verb}。`, 'warn');
}

function laceDetectChance(p, it) {
  const L = LACE[it.laced];
  if (!L || !L.detect) return 0;
  const tox = it.laced === 'control' ? 1 - Math.min(0.7, (it.laceTox || 0) / 200) : 1;
  // 你亲手掺的：学过手法的干净，生手的粗糙
  const hand = it.lacedBy === 'me' ? (laceSkill(it.laced) ? 0.6 : 1.4) : 1;
  return clamp(L.detect * (0.4 + (p ? p.savvy : 0.4)) * tox * hand * (1 - clamp(p ? p.aff : 0, 0, 80) / 160), 0.02, 0.9);
}

// 货到了对方手里（买去或收礼）之后的效果；返回 { caught }
function applyLace(p, it, via) {
  if (!p) return {};
  const name = itemName(it);
  if (it.id === 'wangyou') return hook(p, name);
  if (!it.laced) return {};
  // 明知掺了料还卖、还送，才算你作的恶；不知情的，只是替别人背了锅
  const knew = lacedKnown(it);
  if (Math.random() < laceDetectChance(p, it)) {
    remember(p, `发现你${via === 'gift' ? '送' : '卖'}的${name}里${LACE[it.laced].verb}。`, -45, 'poisoned');
    adjustRep(p.faction, -6); addHeat(8);
    startScandal(p, 'laced', { item: name, lace: it.laced });
    return { caught: true };
  }
  if (LACE[it.laced].apply) return LACE[it.laced].apply(p, it, name, knew) || {};
  switch (it.laced) {
    case 'addict': return hook(p, name, knew);
    case 'control':
      p.controlled = { day: S.day };
      remember(p, `你借${name}在他身上种下了噬心蛊。`, 0);
      if (knew) commitSin('harm', { p, w: 2, what: `给${p.name}种噬心蛊`, virtue: 6 });
      return {};
    case 'tonic':
      // 补多少看那株血灵芝的品质
      p.health = Math.min(130, (p.health || 100) + Math.round(25 * potency({ id: 'herb_blood', q: it.laceQ != null ? it.laceQ : 60 })));
      p.boost = { id: 'pill_qi', fake: false, q: it.laceQ != null ? clamp(it.laceQ + 20, 5, 100) : 80, day: S.day };
      remember(p, `你在${name}里添了血灵芝，他气血大补。`, 10, 'pillHelped');
      return {};
    case 'poison':
      p.health = (p.health || 100) - 85;
      p.poisonedDay = S.day;
      remember(p, `你在${name}里下了尸毒。`, 0);
      if (knew) commitSin('harm', { p, w: 3, what: `给${p.name}下尸毒`, virtue: 9 });
      return {};
  }
  return {};
}

function hook(p, name, knew = true) {
  // 学过手法的，下得更重
  p.addict = Math.min(5, (p.addict || 0) + (knew && laceSkill('addict') ? 2 : 1));
  p.health = (p.health || 100) - 6;
  p.lastFix = S.day;
  if (knew) commitSin('harm', { p, w: 1, what: `让${p.name}吃上忘忧散`, virtue: 3 });
  remember(p, `吃了你的${name}，飘飘欲仙。`, 6, 'hooked');
  return {};
}

// ───────────── 送礼 ─────────────

// 这件东西对他值多少：所求、喜好、瘾
function giftValue(p, it) {
  const wants = BUY_WANTS[p.faction] || {}, maxW = Math.max(...Object.values(wants), 1);
  let v = knownValue(it) * priceMul(it.id) * (0.6 + 0.8 * (wants[ITEMS[it.id].cat] || 0) / maxW);
  if (p.wish === it.id) v *= 2.5;
  if (p.addict && isAddictive(it)) v *= 3;
  return Math.round(v);
}

function giftAff(p, value) {
  return clamp(Math.round(value / (15 + 35 * p.budgetMul) * (0.6 + p.greed)), 1, 35);
}

const canGift = p => p.status === 'alive' && p.giftedDay !== S.day && (p.visits || p.mem.length);

function giveGift(p, it) {
  const name = itemName(it), v = giftValue(p, it);
  let gain = giftAff(p, v);
  const wish = p.wish === it.id;
  if (wish) { gain += 10; p.wish = null; }
  p.giftedDay = S.day;
  remember(p, `你送了他${name}${wish ? '——正是他想要的' : ''}。`, gain, wish ? 'helped' : null);
  if (['pill_qi', 'pill_blood', 'pill_found'].includes(it.id)) p.boost = { id: it.id, fake: !!it.fake, q: it.q, day: S.day };
  npcCure(p, it);
  if (p.addict && it.id === 'wangyou') p.lastFix = S.day;
  const res = applyLace(p, it, 'gift');
  destroyItem(it);
  storyGiftHook(p, it, res);
  return { gain, ...res };
}

function giveStones(p, n) {
  spend(n, `送给${p.name} ${n} 灵石。`);
  p.giftedDay = S.day;
  const gain = clamp(Math.round(n / (10 + 40 * p.budgetMul) * (0.4 + p.greed)), 1, 40);
  remember(p, `你送了他 ${n} 灵石。`, gain, 'bribed');
  return gain;
}

// 送礼对故事人物的额外影响
function storyGiftHook(p, it, res) {
  castEvent(p, 'gift', it, res);
  if (res.caught) return;
  if (p.pid === 'thug' && S.story.thug && !S.story.thug.done && p.aff >= 40 && !S.story.thug.flags.ally) {
    S.story.thug.node = 'ally'; S.story.thug.due = S.day + 1;
  }
}

// ───────────── 控心：让人听话的几种法子 ─────────────

// 灵石之外，药瘾、利益、修为、魂魄都能拴住一个人；拴得越死，越听话，代价各不相同
// odds：差遣成算；pay：差遣前付出的代价（返回错误则不能用）；cut：上贡时他交几成；fail：不听话的后果
const LEVERS = {
  soul: { name: '噬心蛊', has: p => !!p.controlled, odds: () => 1, cut: 1, note: p => `每次约 ${Math.round(exposureChance(p) * 100)}% 被逼出` },
  bond: { name: '魂印', has: p => !!p.soulBound, odds: () => 0.95, cut: 1, note: () => '识海里的印记，难违',
    fail: p => { p.soulBound = null; remember(p, '魂印松动，他清醒了片刻，记起了一切。', -50, 'controlled'); return `${p.name}抱着头惨叫一声，魂印碎了。`; } },
  drug: { name: '药瘾', has: p => (p.addict || 0) >= 2, odds: p => clamp(0.45 + 0.1 * p.addict, 0, 0.95), cut: 0.7, note: () => '拿一份忘忧散吊着他',
    pay: p => { const d = ownItem(isAddictive); if (!d) return '手头没有忘忧散（或掺了它的货）'; hook(p, itemName(d)); destroyItem(d); return null; },
    fail: p => `${p.name}抢过药一口吞了，翻着白眼瘫在地上，什么也没办成。` },
  dao: { name: '修为威压', has: p => killable(p) && cultGap(p) >= 1, odds: p => clamp(0.35 + 0.2 * cultGap(p), 0, 0.92), cut: 0.9, note: () => '耗精神，伤好感',
    pay: p => { const err = exert('command', 2); if (err) return err; remember(p, '被你以修为压着办事。', -6); return null; },
    fail: p => { grievance(p, 40, '被你仗着修为欺压'); return `${p.name}咬着牙顶住了你的威压：“你等着。”`; } },
  gain: { name: '利益', has: p => p.aff >= 40 || !!p.owes, odds: p => clamp(0.4 + p.aff / 200 + (p.owes ? 0.2 : 0), 0, 0.9), cut: 0.5, note: p => `分他好处，约 ${gainCost(p)} 灵石`,
    pay: p => { const n = gainCost(p); if (S.stones < n) return '灵石不够分他好处'; spend(n, `分给${p.name} ${n} 灵石好处。`); return null; },
    fail: p => { remember(p, '你要他办的事，他不想沾。', -3); return `${p.name}收了好处，却摇摇头：“这事我办不了。”`; } },
  dirt: { name: '把柄', has: p => !!(p.secret && p.secret.known), odds: p => clamp(overpowerOdds(p) + 0.15, 0, 0.9), cut: 0.8, note: () => '伤他好感，逼急了会反咬',
    pay: p => { remember(p, `你拿他${p.secret.type}的身份逼他办事。`, -10, 'blackmailed'); return null; },
    fail: p => `${p.name}冷冷看着你：“你去告啊。”——${retaliate(p, 50)}` },
};

const gainCost = p => Math.round((30 + npcPower(p) * 1.5) / 5) * 5;

const COMMANDS = {
  tribute: { label: '上贡', cd: 5, run: (p, L) => {
    const n = Math.round(rint(40, 80) * p.budgetMul * (p.faction === 'xian' ? 2 : p.faction === 'mo' ? 1.4 : 1) * L.cut);
    earn(n, `${p.name}送来 ${n} 灵石“孝敬”。`);
    return `${p.name}把 ${n} 灵石放在你柜上。`;
  } },
  spy: { label: '盯执法堂', cd: 7, run: p => {
    S.flags.spyUntil = S.day + 7; S.flags.spyBy = p.pid;
    addHeat(-5);
    return `${p.name}替你在执法堂安下了眼线：往后七日，巡查前夜必有风声。`;
  } },
  scout: { label: '打探消息', cd: 4, run: p => {
    const target = pick(Object.values(S.people).filter(t => t !== p && t.status === 'alive' && t.secret && !t.secret.known));
    const kind = weighted([['market', 4], ['clique', p.faction === 'mo' ? 3 : 1], ['secret', target ? 3 : 0], ['treasure', 2]]);
    if (kind === 'secret') target.secret.known = true;
    const it = makeIntel(kind, { p: target });
    return it ? `${p.name}打听回来一份${itemName(it)}。` : `${p.name}打听到了些什么，可你库房里连张纸都放不下了。`;
  } },
  special: { label: null, cd: 999, run: p => SPECIAL_COMMANDS[p.pid].run(p) },
};

const SPECIAL_COMMANDS = {
  qian: { label: '令他免你一期租金', run: () => { S.flags.rentWaive = true; return '钱执事在账册上划了一笔：“这一期……不收了。”'; } },
  sun: { label: '令她放松对你的巡查', run: () => { S.flags.inspectMul *= 0.6; return '孙管事把你的铺子从巡查名册上划去了一半。'; } },
  enforcer: { label: '令他往后对你的铺子放行', run: () => { S.flags.enforcerOwned = true; return '厉寒点了点头：“你的铺子，往后我亲自来查。”'; } },
  collector: { label: '令她不再征调你的货', run: () => { S.flags.noRequisition = true; return '司徒红绡把你的名字从征调簿上抹掉了。'; } },
  thug: { label: '令他替你守夜', run: () => { S.flags.guard = true; return '刘癞子的弟兄们夜里开始在你铺子门口打盹。'; } },
  fox: { label: '令她替你招揽妖族', run: () => { S.flags.foxBlessing = true; return '妖族的客人渐渐多了起来。'; } },
  amu: { label: '令他压下巡查', run: () => { S.flags.inspectMul *= 0.7; return '阿木在执法堂里替你说了几句话。'; } },
};

const leversOf = p => p.status === 'alive' ? Object.keys(LEVERS).filter(k => LEVERS[k].has(p)) : [];

// 只有蛊与魂印拴得住的人，才肯替你办那件“方便”
function commandList(p, lever) {
  const list = ['tribute', 'spy', 'scout'];
  if (SPECIAL_COMMANDS[p.pid] && ['soul', 'bond'].includes(lever)) list.push('special');
  return list.map(id => {
    const c = COMMANDS[id];
    const last = (p.ctrlUsed || {})[id];
    const ready = last == null || S.day - last >= c.cd;
    return { id, label: id === 'special' ? SPECIAL_COMMANDS[p.pid].label : c.label, ready, why: ready ? null : id === 'special' ? '已用过' : `${c.cd - (S.day - last)} 日后` };
  });
}

function exposureChance(p) { return clamp(0.05 + 0.03 * (p.ctrlUses || 0) + p.savvy * 0.06, 0.05, 0.6); }

function runCommand(p, id, lever = 'soul') {
  const L = LEVERS[lever];
  if (!L.has(p)) return { text: '拴不住他了。', exposed: true };
  const err = L.pay && L.pay(p);
  if (err) return { text: err, exposed: true };
  p.ctrlUsed = p.ctrlUsed || {};
  p.ctrlUsed[id] = S.day;
  p.ctrlUses = (p.ctrlUses || 0) + 1;
  if (lever === 'soul' && Math.random() < exposureChance(p)) { exposeControl(p); return { exposed: true, text: `${p.name}忽然浑身一颤，捂着心口惨叫——噬心蛊被他自己逼出来了！他死死盯着你。` }; }
  if (Math.random() >= L.odds(p)) return { exposed: true, text: L.fail(p) };
  return { text: COMMANDS[id].run(p, L) };
}

function exposeControl(p) {
  p.controlled = null;
  remember(p, '他身上的噬心蛊被逼出，他知道是你干的。', -80, 'controlled');
  adjustRep(p.faction, -12); addHeat(20);
  startScandal(p, 'control');
}

function releaseControl(p) { p.controlled = null; remember(p, '你悄悄解了他身上的噬心蛊。', 0); }

// ───────────── 每夜：瘾、毒、蛊 ─────────────

function intrigueTick() {
  const news = [];
  for (const p of Object.values(S.people)) {
    if (p.status !== 'alive') continue;
    initTraits(p);
    if (p.addict) {
      p.health -= 2 * p.addict;
      if (S.day - (p.lastFix || 0) > 3) {
        p.budgetMul = Math.max(0.2, p.budgetMul * 0.97);
        if (Math.random() < 0.04) {
          addHeat(10);
          news.push({ text: `${p.name}因吸食忘忧散被执法堂抓了，据说供出了货是从哪儿来的。`, cls: 'bad' });
          p.status = 'jailed'; lifeNote(p, '因吸食忘忧散被执法堂锁拿。');
          continue;
        }
      }
      // 断了货熬过十天，此后每五天退一重瘾
      const dry = S.day - (p.lastFix || 0);
      if (dry >= 10 && dry % 5 === 0) {
        p.addict--;
        lifeNote(p, p.addict ? '熬过一阵戒断，瘾头轻了些。' : '熬过了戒断，忘忧散的瘾断了。');
      }
    }
    if (p.health <= 0) {
      // 尸毒、忘忧散是你的货；毒入心脉另有来由（擂台前那碗汤当场已判过识破与否），不另起事端
      const poisoned = p.poisonedDay && S.day - p.poisonedDay <= 5, addicted = !poisoned && !condSev(p, 'poisoned') && p.addict > 0;
      die(p, poisoned ? `${p.name}忽然七窍流血，暴毙家中。` : addicted ? `${p.name}瘾入骨髓，形销骨立，咽了气。` : `${p.name}毒入心脉，没能熬过去。`);
      news.push({ text: p.life[p.life.length - 1].t, cls: 'bad' });
      if ((poisoned || addicted) && Math.random() < (poisoned ? 0.5 : 0.35)) startScandal(p, poisoned ? 'poison' : 'addictdeath');
      continue;
    }
    if (!p.addict && p.health < 100) p.health = Math.min(100, p.health + 2);
    if (p.controlled && Math.random() < 0.008 + p.savvy * 0.015) {
      exposeControl(p);
      news.push({ text: `${p.name}身上的噬心蛊被一位游方高人逼了出来。`, cls: 'bad' });
    }
    p.desperate = p.budgetMul < 0.55 || p.health < 40 || (!!p.addict && S.day - (p.lastFix || 0) > 3);
  }
  return news;
}

// 人死了：故事随之改变
function die(p, text) {
  p.status = 'dead';
  lifeNote(p, text);
  castEvent(p, 'death');
  const st = p.story && S.story[p.story];
  if (st && !st.done) { st.done = true; st.summary = `${p.name}死了。`; }
  if (p.pid === 'thug') S.flags.guard = false;
  if (p.pid === 'qian' && S.flags.landlord === 'qian') { S.flags.landlord = 'sun'; S.flags.rentMul = 0.9; S.flags.rentExtra = 0; ensureSun(); }
  if (p.pid === 'sun' && S.flags.landlord === 'sun') S.flags.landlord = S.people.qian && S.people.qian.status === 'alive' ? 'qian' : 'tu';
  if (p.pid === 'enforcer') S.flags.enforcerOwned = false;
}

function ensureSun() {
  if (!S.people.sun) newPerson('mo', { pid: 'sun', name: '孙管事', portrait: 'steward_sun', title: '杂役区副管事', savvy: 0.8, story: 'stewards',
    bio: '宗门派下来的副管事，发髻一丝不乱，账算得比谁都清。据说她最恨贪墨。' });
  if (!S.people.sun.tuned) Object.assign(S.people.sun, { greed: 0.15, integrity: 0.85, tuned: true });
}

// ───────────── 官差与打点 ─────────────

const OFFICIALS = {
  enforcer: { name: '厉寒', faction: 'mo', portrait: 'mo_enforcer', title: '执法堂巡查', greed: 0.55, integrity: 0.35, savvy: 0.6,
    bio: '执法堂的老巡查，铁面之下是一双算盘珠子似的眼睛。规矩他门儿清，规矩的价钱他也门儿清。' },
  collector: { name: '司徒红绡', faction: 'mo', portrait: 'mo_senior', title: '宗门征调使', greed: 0.7, integrity: 0.25, savvy: 0.65,
    bio: '内门出身的征调使，替宗门征收战备，也替自己征收好处。' },
};

function official(pid) {
  if (!S.people[pid]) {
    const o = OFFICIALS[pid];
    const p = newPerson(o.faction, Object.assign({ pid, story: 'official' }, o));
    Object.assign(p, { official: true, greed: o.greed, integrity: o.integrity });
  }
  return S.people[pid];
}

// 他心里的价码：规矩越硬、风险越大，价码越高；越贪、越熟、收得越惯，越好说话
function bribePrice(p, stake) {
  initTraits(p);
  const risk = warStage().inspect * (1 - playerPower() / 300);   // 你势大，他也得给几分面子
  const trust = 1 - clamp(p.aff, -60, 80) / 200;
  const habit = 1 - Math.min(0.3, (p.bribes || 0) * 0.05);
  return Math.max(10, Math.round((stake * (0.3 + p.integrity * 0.9) + 20 + 120 * p.integrity) * risk * trust * habit / (0.55 + p.greed) / 5) * 5);
}

function bribeOdds(p, stake, offer) {
  if (p.controlled) return 1;
  const price = bribePrice(p, stake);
  let o = 1 / (1 + Math.exp(-(offer / price - 1) * 4.5));
  if (p.integrity > 0.7 && offer < price * 1.8) o *= 0.6;   // 清官：要么给足，要么别碰
  return clamp(o, 0.02, 0.98);
}

function tryBribe(p, stake, offer, what = '') {
  const ok = Math.random() < bribeOdds(p, stake, offer);
  if (ok) {
    spend(offer, `打点${p.name} ${offer} 灵石${what ? `，${what}` : ''}。`);
    p.bribes = (p.bribes || 0) + 1;
    remember(p, `收了你 ${offer} 灵石的好处。`, Math.min(12, Math.round(offer / Math.max(20, stake) * 8) + 2), 'bribed');
  } else {
    remember(p, `你想拿 ${offer} 灵石收买他，被他拒了。`, -8, 'insulted');
    addHeat(6 + Math.round(p.integrity * 10));
  }
  return ok;
}

// 三档打点的选项
function bribeChoices(p, stake, onResult, what) {
  const price = bribePrice(p, stake);
  const tiers = [...new Set([0.6, 1, 1.6].map(k => Math.max(10, Math.round(price * k / 10) * 10)))];
  return tiers.map(n => ({
    label: `打点 ${n} 灵石`, hint: `成算 ${Math.round(bribeOdds(p, stake, n) * 100)}%；不成则执法堂关注上升`, req: needStones(n),
    run: (st, sp) => onResult(n, tryBribe(p, stake, n, what), st, sp),
  }));
}

// 巡查时他能抄到多少：被他看见的禁物、禁药、赃物
function inspectionStake() {
  let s = 30 + S.heat;
  for (const it of Object.values(S.items)) {
    if (!HELD(it) || it.pos.g === 'hidden') continue;
    const shown = it.pos.g === 'display';
    const d = ITEMS[it.id];
    if (d.contra || d.illicit) s += claimedValue(it) * (shown ? 0.5 : 0.25);
    else if (it.stolen > 0) s += claimedValue(it) * (shown ? 0.16 : 0.07);
  }
  return Math.round(s);
}

function startOfficial(kind, delay) {
  if (kind === 'requisition' && S.flags.noRequisition) return;
  startStory(`off_${kind}_${S.day}`, 'official', kind, delay);
}

// 征调目标：看得见的战备物资，按价值取前三
function requisitionTargets() {
  return Object.values(S.items).filter(it => HELD(it) && it.pos.g !== 'hidden' && (ITEMS[it.id].war || 0) >= 0.5)
    .sort((a, b) => claimedValue(b) * priceMul(b.id) - claimedValue(a) * priceMul(a.id)).slice(0, 3);
}

function landlordPerson() {
  if (S.flags.landlord === 'sun') { ensureSun(); return S.people.sun; }
  if (S.flags.landlord === 'tu') {
    if (!S.people.tu) {
      newPerson('mo', { pid: 'tu', name: '屠管事', portrait: 'mo_disciple', title: '杂役区管事', story: 'official',
        bio: '前任管事死后，宗门派来的新管事。贪，而且不加掩饰。' });
      Object.assign(S.people.tu, { official: true, greed: 0.85, integrity: 0.15 });
    }
    return S.people.tu;
  }
  const q = S.people.qian;
  if (q && !q.tuned) Object.assign(q, { greed: 0.9, integrity: 0.1, tuned: true });
  return q;
}

// ───────────── 官差与事发：故事模板 ─────────────

Object.assign(STORIES, {
  official: {
    nodes: {
      requisition: {
        when: 'day',
        who: () => { const p = official('collector'); return { name: p.name, portrait: p.portrait, title: p.title, faction: 'mo', pid: p.pid }; },
        text: () => {
          const t = requisitionTargets();
          return t.length
            ? `一个红衣女修带着两名执法弟子跨进门，展开一卷黄绢：“宗门征调战备。”\n她的目光在你的货架上扫过：“${t.map(itemName).join('、')}——这几样，宗门要了。”\n“当然，”她慢条斯理地卷起黄绢，“规矩是死的，人是活的。”`
            : '一个红衣女修带着两名执法弟子跨进门，四下扫了一眼，撇撇嘴：“穷铺子，没什么油水。”\n“不过嘛，我们姐妹跑这一趟，辛苦费总是要的。三十灵石。”';
        },
        choices: () => {
          const p = official('collector'), t = requisitionTargets();
          if (!t.length) return [
            { label: '给三十灵石', hint: costHint(30), req: needStones(30), run: () => { spend(30, '给征调使辛苦费。'); remember(p, '给了辛苦费。', 3); return { text: '“懂事。”她收了灵石，走了。', end: true }; } },
            { label: '不给', hint: '她会记着', run: () => { remember(p, '连三十灵石的辛苦费都不给。', -10); addHeat(3); return { text: '她冷笑一声：“好，我记下了。”', end: true }; } },
          ];
          const stake = Math.round(t.reduce((s, it) => s + claimedValue(it) * priceMul(it.id), 0) * 0.7);
          const seize = (why) => { const names = t.map(itemName); t.forEach(takeItem); return names.join('、') + why; };
          return [
            { label: '如数上缴', hint: '失去这些货；魔宗声望 +4', run: () => {
              const names = seize(''); adjustRep('mo', 4); remember(p, '如数上缴了战备。', 5);
              return { text: `执法弟子把${names}装上了车。“宗门记你一功。”`, end: true };
            } },
            ...bribeChoices(p, stake, (n, ok) => ok
              ? { text: '她掂了掂灵石，在黄绢上划了几笔：“这间铺子，查无可征。”', end: true }
              : { text: `她把灵石推了回来：“你当宗门的军需是什么？”执法弟子搬走了${seize('')}。`, end: true }, '免于征调'),
            { label: '谎称早已卖空', hint: '她未必信', run: () => {
              if (lieCaught(p.savvy)) {
                const names = seize(''); const fine = payUpTo(Math.round(stake * 0.3), '欺瞒征调使，罚银。'); addHeat(12);
                remember(p, '当着她的面撒谎。', -20, 'lied');
                return { text: `她一抬手，执法弟子从你货架上搬出了${names}。“欺瞒宗门征调，罚 ${fine} 灵石。”`, end: true };
              }
              remember(p, '说货早卖空了。', -3);
              return { text: '她狐疑地看了你一眼，又看了看身后排队的铺子，挥挥手走了。', end: true };
            } },
          ];
        },
      },
      levy: {
        when: 'day',
        who: () => { const p = official('collector'); return { name: p.name, portrait: p.portrait, title: '征捐使', faction: 'mo', pid: p.pid }; },
        text: () => `征捐使啪地把账册拍在柜上：“战时捐，本周 ${levyAmount()} 灵石${S.flags.levyDebt ? `，加上你欠的 ${S.flags.levyDebt}` : ''}。”\n她用笔杆敲了敲柜台，“交不上的，按通敌论处。”`,
        choices: () => {
          const p = official('collector'), due = levyAmount() + (S.flags.levyDebt || 0);
          return [
            { label: `照数缴纳（${due}）`, hint: costHint(due), req: needStones(due), run: () => {
              spend(due, `缴纳战时捐 ${due} 灵石。`); S.flags.levyDebt = 0; remember(p, '按时缴了战时捐。', 2);
              return { text: '她在账册上勾了一笔，走向下一家。', end: true };
            } },
            ...bribeChoices(p, due, (n, ok) => {
              if (ok) { S.flags.levyDebt = 0; return { text: '她把灵石塞进袖子，在账册上写了个“已缴”。', end: true }; }
              const paid = payUpTo(due, '打点不成，照缴战时捐。'); S.flags.levyDebt = due - paid;
              return { text: '“当我是什么人？”她冷着脸照数收了捐。', end: true };
            }, '战时捐一笔勾销'),
            { label: '拖欠', hint: '欠款加两成；执法堂关注 +10，魔宗声望 -3', run: () => {
              S.flags.levyDebt = Math.round(due * 1.2); addHeat(10); adjustRep('mo', -3);
              remember(p, '拖欠战时捐。', -8);
              return { text: '“好，下回连本带利。”她在你的名字旁画了个红圈。', end: true };
            } },
          ];
        },
      },
      tribute: {
        when: 'day',
        who: () => { const p = landlordPerson(); return { name: p.name, portrait: p.portrait, title: '收岁供', faction: 'mo', pid: p.pid }; },
        text: () => `${landlordName()}进门拱了拱手：“岁末了，宗门的岁供，杂役区每铺 ${tributeAmount()} 灵石。”`,
        choices: () => {
          const p = landlordPerson(), due = tributeAmount();
          return [
            { label: `照数缴纳（${due}）`, hint: costHint(due), req: needStones(due), run: () => { spend(due, `缴纳岁供 ${due} 灵石。`); return { text: '新的一年，又开始了。', end: true }; } },
            ...bribeChoices(p, due, (n, ok) => ok
              ? { text: '账册上，你的铺子写着“已缴”。', end: true }
              : (payUpTo(due, '打点不成，照缴岁供。'), { text: '对方面无表情地照数收了岁供。', end: true }), '岁供免缴'),
          ];
        },
      },
    },
  },

  // 坏事败露：苦主上门，赔钱、打点、抵赖或威吓
  scandal: {
    nodes: {
      demand: {
        when: 'day',
        who: st => {
          const p = S.people[st.flags.pid];
          if (p.status === 'alive') return { name: p.name, portrait: p.portrait, title: '上门讨说法', faction: p.faction, pid: p.pid };
          return { name: `${p.name}的亲友`, portrait: pick(PORTRAITS[p.faction])[0], title: '上门讨说法', faction: p.faction };
        },
        text: st => {
          const p = S.people[st.flags.pid], f = st.flags;
          const lead = {
            fakepill: `“${p.name}吃了你卖的筑基丹，${p.status === 'dead' ? '经脉寸断，死了' : '修为尽废，成了废人'}！那是假丹！”`,
            laced: `“你卖的${f.item}里${(LACE[f.lace] || {}).verb || '动了手脚'}！当我们是傻子？”`,
            addictdeath: `“${p.name}吃了你的忘忧散，瘦成一把骨头，昨夜咽了气。他屋里翻出来的药包，印着你铺子的记号！”`,
            poison: `“${p.name}喝了你那里出去的东西，七窍流血而死。仵作验过了，是尸毒！”`,
            control: `“${p.name}身上的${p.soulBound ? '魂印' : '噬心蛊'}，是你种的！”`,
            murder: `“${p.name}那天进了你的铺子，就再没出来过！有人看见你夜里往乱葬岗拖东西！”`,
          }[f.kind];
          return `${f.damage ? `（${f.damage}）\n` : ''}来人一掌拍在柜上：${lead}\n“今日你若不给个说法，我们就告到执法堂，再把你这黑店的名声传遍杂役区！”`;
        },
        choices: st => {
          const p = S.people[st.flags.pid], f = p.faction, sev = SEVERITY[st.flags.kind];
          const demand = Math.round(sev * (0.7 + (p.greed || 0.5)) / 10) * 10;
          const enf = official('enforcer');
          const list = [
            { label: `赔偿 ${demand} 灵石`, hint: costHint(demand), req: needStones(demand), run: () => {
              spend(demand, `为${p.name}的事赔偿 ${demand} 灵石。`); adjustRep(f, -1);
              if (p.status === 'alive') remember(p, `你赔了 ${demand} 灵石。`, 20);
              return { text: '来人数了数灵石，脸色缓和了些：“这事……就到这儿。”', end: true };
            } },
            ...bribeChoices(enf, sev, (n, ok) => {
              if (ok) { adjustRep(f, -3); if (p.status === 'alive') remember(p, '他告到执法堂，被你压了下来。', -10); return { text: `第二天，${enf.name}亲自把苦主轰出了执法堂：“诬告良善，再闹就把你关起来。”`, end: true }; }
              const fine = payUpTo(Math.round(sev * 0.4), '事发，执法堂罚银。'); adjustRep(f, -8); addHeat(12);
              return { text: `${enf.name}把你的灵石扔在地上，当着苦主的面罚了你 ${fine} 灵石。`, end: true };
            }, '把事压下'),
            { label: '抵赖', hint: '对方未必信', run: () => {
              if (lieCaught(0.55)) { adjustRep(f, -10); addHeat(15); return { text: '“证据在这儿！”来人把东西摔在柜上，扬长而去。第二天，整个杂役区都知道了。', end: true }; }
              adjustRep(f, -3);
              return { text: '来人将信将疑，骂了几句走了。', end: true };
            } },
          ];
          if (p.status === 'alive') list.push({ label: '以势压人', hint: `成算 ${Math.round(overpowerOdds(p) * 100)}%（你的势力 ${playerPower()}，他 ${npcPower(p)}）`, run: () => {
            if (Math.random() < overpowerOdds(p)) { remember(p, '你仗势压了下来。', -12, 'swallowed'); return { text: '你提了几个名字。来人脸色发白，再不敢多说一句。', end: true }; }
            adjustRep(f, -6); addHeat(10);
            return { text: '“你吓唬谁？”来人直奔执法堂。这事闹大了。', end: true };
          } });
          if (thugAlly()) list.push({ label: '让刘癞子去“劝劝”', hint: '多半能吓住，也可能闹大', run: () => {
            if (Math.random() < 0.7) { adjustRep('ren', -4); addHeat(3); return { text: '当晚，刘癞子的弟兄们去了苦主家一趟。第二天，再没人提这事。', end: true }; }
            adjustRep(f, -8); addHeat(20);
            return { text: '苦主被打断了腿，一瘸一拐地爬进了执法堂。事情闹大了。', end: true };
          } });
          if (ownWeapon()) list.push({ label: '亮家伙轰出去', hint: `${FACTIONS[f].name}声望 -8，执法堂关注 +5`, run: () => {
            adjustRep(f, -8); addHeat(5);
            return { text: '你亮出家伙，来人恨恨地退了出去。可这梁子，是结下了。', end: true };
          } });
          return list;
        },
      },
    },
  },
});

const SEVERITY = { fakepill: 300, laced: 160, addictdeath: 420, poison: 520, control: 450, murder: 600 };

// 苦主也见风使舵：你势大，他可能忍了；怨气大，他先报复再上门
function startScandal(p, kind, extra = {}) {
  const st = stance(p, SEVERITY[kind] / 5);
  if (st === 'swallow') {
    remember(p, '吃了你的亏，掂量了一下你的势力，忍了。', -10, 'swallowed');
    log(`${p.name}${p.status === 'alive' ? '' : '的亲友'}吃了暗亏，却没敢声张。`, 'warn');
    return;
  }
  if (st === 'retaliate') extra.damage = retaliate(p, SEVERITY[kind] / 5);
  startStory(`sc_${p.pid}_${S.day}_${kind}`, 'scandal', 'demand', rint(1, 2), Object.assign({ pid: p.pid, kind }, extra));
}
