// 状态与判定：受伤、中毒、走火入魔、力竭……人身上的状态改变事件的走向。
// 你（'me'）与每个人物都有状态；judge() 把双方的境界、兵器、状态折算成一次比斗的胜负与缘由，
// fightRoll / lieCaught / hideRoll / 杀人 / 拾荒 / 破境 / 人物命数都会读它
'use strict';

// combat：比斗每重的折损；regen：你夜里少恢复多少；heal：几天好一重；cure：服下即愈的东西
// lethal：到了第三重，每夜咽气的机会；第三重上再添一重，当场毙命
const CONDS = {
  injured:   { name: '受伤', combat: 14, regen: 15, heal: 3, lethal: 0.05, cure: ['vine_fruit', 'pill_blood'], grade: ['轻伤', '重伤', '垂危'],
               desc: '比斗、动手、翻找都吃亏；夜里恢复得少。血藤果、血煞丹可治，或静养数日。垂危时随时可能咽气，再添一处伤必死。' },
  poisoned:  { name: '中毒', combat: 10, drain: 5, heal: 0, worsen: 4, lethal: 0.05, cure: ['herb_blood', 'pill_qi'], grade: ['微毒', '毒发', '毒入心脉'],
               desc: '每夜耗体力精神；微毒熬几天能自己退，毒发以上不治会越来越重，毒入心脉随时可能毒发身亡。血灵芝、回气丹可解。' },
  deviation: { name: '走火入魔', combat: 8, heal: 5, cure: ['water'], grade: ['气乱', '走火', '入魔'],
               desc: '修为涨不动、冲关必败、心神不宁说谎易露馅。无根灵水以上可镇，闭关一夜好得快。' },
};
// 不必记账、看当下就知道的状态
const DERIVED = {
  exhausted: { name: '力竭', combat: 10 },   // 你：体力或精神见底
  sickly:    { name: '病弱', combat: 12 },   // 人物：体魄不足四十
  addicted:  { name: '药瘾', combat: 5 },    // 人物：每重瘾
  dazed:     { name: '受控', combat: 6 },    // 人物：蛊或魂印在身，出手迟滞
};

function initConditions() { S.conds = S.conds || {}; }

const condBox = who => who === 'me' ? S.conds : (who.conds = who.conds || {});
const whoName = who => who === 'me' ? '你' : who.name;

// 添一重状态（同类叠加，最多三重）
function addCond(who, kind, sev = 1, why = '') {
  const box = condBox(who), c = box[kind] || { sev: 0, day: S.day }, was = c.sev;
  c.sev = clamp(c.sev + sev, 1, 3); c.day = S.day;
  box[kind] = c;
  const C = CONDS[kind];
  if (who === 'me') {
    log(`${why}${why ? '，' : ''}你${C.grade[c.sev - 1]}（${C.name}）。${C.lethal && c.sev === 3 ? '再不医治，随时会丢了性命。' : ''}`, 'loss');
    if (C.lethal && was === 3) dieMe(kind, why);
  } else { if (kind === 'injured') guHold(who); lifeNote(who, `${why}${why ? '，' : ''}${C.grade[c.sev - 1]}。`); }
  return c;
}

// 你死了：结局文字按死因；手里有护身符，就有人把你从鬼门关拽回来
const DEATHS = {
  injured: why => ({ title: '伤重不治', text: `${why ? `${why}，伤上加伤，你没能再站起来` : '伤口在夜里崩开，你没能熬到天亮'}。第二天一早，街坊看见当铺门口挂起了白灯笼；柜上的灯油烧干了，账本还摊在那一页。` }),
  poisoned: why => ({ title: '毒发身亡', text: `${why ? `${why}，毒上加毒，一口黑血涌上来` : '毒走到心口那一夜，你连喊人的力气都没有了'}。天亮时当铺门口挂起了白灯笼，柜上那盏药只剩半口。` }),
};
// 选项提示用：第二重再添就到了鬼门关前；第三重再添就没命了
function deathWarn(kind) {
  const C = CONDS[kind], sev = condSev('me', kind), hurt = kind === 'injured' ? '受伤' : '中毒';
  if (!C.lethal || sev < 2) return '';
  return sev === 3 ? `；你已${C.grade[2]}，再${hurt}必死` : `；你已${C.grade[1]}，再${hurt}就${C.grade[2]}了`;
}

function dieMe(kind, why = '') {
  if (S.over) return;
  if (savedByBenefactor('death')) { const c = S.conds[kind]; c.sev = 2; c.day = S.day; return; }
  S.over = { win: false, cause: 'death', scene: kind === 'poisoned' ? 'end_death_poison' : 'end_death', ...DEATHS[kind](why) };
}

function cureCond(who, kind) { const box = condBox(who); if (!box[kind]) return false; delete box[kind]; return true; }
// 减轻几重，减到零就好了；返回剩下几重
function easeCond(who, kind, n) {
  const c = condBox(who)[kind];
  if (!c) return 0;
  c.sev -= n; c.day = S.day;
  if (c.sev <= 0) { delete condBox(who)[kind]; return 0; }
  return c.sev;
}
const condSev = (who, kind) => (condBox(who)[kind] || {}).sev || 0;
const hasCond = (who, kind) => condSev(who, kind) > 0 || condList(who).some(c => c.kind === kind);

// 当下所有状态：[{ kind, name, sev, label, combat }]
function condList(who) {
  const out = [];
  for (const [k, c] of Object.entries(condBox(who))) {
    const C = CONDS[k];
    if (C) out.push({ kind: k, name: C.name, sev: c.sev, label: C.grade[c.sev - 1], combat: C.combat * c.sev });
  }
  if (who === 'me') {
    if (S.vit.st < 25 || S.vit.sp < 20) out.push({ kind: 'exhausted', name: '力竭', sev: 1, label: '力竭', combat: DERIVED.exhausted.combat });
  } else {
    if (who.poisonedDay && S.day - who.poisonedDay <= 5 && who.health < 60 && !condBox(who).poisoned)
      out.push({ kind: 'poisoned', name: '中毒', sev: 2, label: '身中尸毒', combat: 20 });
    if (who.health != null && who.health < 40) out.push({ kind: 'sickly', name: '病弱', sev: 1, label: '病弱', combat: DERIVED.sickly.combat });
    if ((who.addict || 0) >= 2) out.push({ kind: 'addicted', name: '药瘾', sev: who.addict, label: `药瘾${who.addict}重`, combat: DERIVED.addicted.combat * who.addict });
    if (who.controlled || who.soulBound) out.push({ kind: 'dazed', name: '受控', sev: 1, label: '神志受控', combat: DERIVED.dazed.combat });
  }
  return out;
}

// 状态让比斗吃多少亏（正数）
const condPenalty = who => condList(who).reduce((s, c) => s + c.combat, 0);

// 一句话描述，写进事件文字里
function condText(who) {
  const l = condList(who);
  if (!l.length) return '';
  return who === 'me' ? `你身上${l.map(c => c.label).join('、')}。` : `${who.name}${l.map(c => c.label).join('、')}。`;
}

// ───────────── 判定 ─────────────

const WEAPON_POWER = { demon_blade: 20, xian_sword: 16, soul_banner: 16, god_blank: 8, sword_std: 8, bone_flute: 5, soul_bell: 5 };

// 一方的实力与构成：境界、兵器/护卫（你）、势力（人物）、状态
function strengthOf(who) {
  const parts = [];
  if (who === 'me') {
    parts.push([`境界·${realmName()}`, S.cult.lv * 18]);
    const w = ownWeapon();
    if (w) parts.push([`兵器·${itemName(w)}`, WEAPON_POWER[w.id] || 5]);
    const g = Object.values(S.items).filter(it => HELD(it) && ['iron_corpse', 'corpse_king', 'puppet_doll'].includes(it.id)).length;
    if (g) parts.push(['护卫', Math.min(15, g * 6)]);
  } else {
    const lv = Math.max(0, npcLevel(who) - guDrop(who));   // 中了你的蛊，跟你动手跌一境
    parts.push([`境界·${realmName(lv)}${guDrop(who) ? '（中蛊）' : ''}`, lv * 18]);
    parts.push(['身手', Math.round(npcBasePower(who) / 5)]);
  }
  for (const c of condList(who)) parts.push([c.label, -c.combat]);
  return { total: parts.reduce((s, p) => s + p[1], 10), parts };
}

// 比斗：a 对 b（'me' 或人物）。bonus 给 a 加减；返回胜负、等第、双方构成——事件据 grade 分支
// grade：crush 大胜 / win 胜 / edge 险胜 / lose 败 / rout 惨败
function judge(a, b, { bonus = 0, luck = 12 } = {}) {
  const A = strengthOf(a), B = strengthOf(b);
  const margin = A.total + bonus - B.total + rnd(-luck, luck);
  const grade = margin > 22 ? 'crush' : margin > 8 ? 'win' : margin > 0 ? 'edge' : margin > -18 ? 'lose' : 'rout';
  return { win: margin > 0, grade, margin: Math.round(margin), a: A, b: B };
}
const GRADE_NAME = { crush: '大胜', win: '胜', edge: '险胜', lose: '败', rout: '惨败' };
const partsText = s => s.parts.map(([k, v]) => `${k}${v >= 0 ? '+' : ''}${v}`).join('，');

// 对固定难度的判定（翻山、逃命、硬撑）：dc 越高越难
function trial(who, dc, { luck = 12 } = {}) {
  const S_ = strengthOf(who), margin = S_.total - dc + rnd(-luck, luck);
  return { ok: margin > 0, margin: Math.round(margin), s: S_ };
}

// 对固定难度的成算估计（给选项提示用）
function trialOdds(dc) { let w = 0; for (let i = 0; i < 200; i++) if (trial('me', dc).ok) w++; return w / 200; }

// 胜率估计（给选项提示用）：多算几次
function judgeOdds(a, b, opts = {}) {
  let w = 0;
  for (let i = 0; i < 200; i++) if (judge(a, b, opts).win) w++;
  return w / 200;
}

// ───────────── 每夜：恢复、恶化、毒发 ─────────────

function condTick() {
  const out = [];
  const step = (who, k, c) => {
    const C = CONDS[k], age = S.day - c.day;
    // 微毒熬得过去：四天自己退；毒发以上才会加重
    if (k === 'poisoned' && c.sev === 1 && age >= 4) { delete condBox(who)[k]; return 'gone'; }
    if (C.worsen && age >= C.worsen && c.sev < 3 && !(k === 'poisoned' && c.sev === 1)) { c.sev++; c.day = S.day; return 'worse'; }
    if (C.heal && age >= C.heal) { c.sev--; c.day = S.day; if (c.sev <= 0) { delete condBox(who)[k]; return 'gone'; } return 'better'; }
    return null;
  };
  for (const [k, c] of Object.entries(S.conds)) {
    if (k === 'deviation' && S.retreat) c.day -= 2;
    if (k === 'poisoned') drain(CONDS.poisoned.drain * c.sev, CONDS.poisoned.drain * c.sev);
    const r = step('me', k, c);
    if (r === 'gone') out.push({ icon: 'ic_stamina', title: CONDS[k].name, text: `你的${CONDS[k].name}好了。`, cls: 'ok' });
    else if (r === 'worse') out.push({ icon: 'ic_stamina', title: CONDS[k].name, text: `你的${CONDS[k].name}加重了：${CONDS[k].grade[c.sev - 1]}。${CONDS[k].desc}`, cls: 'bad' });
    else if (k === 'poisoned') out.push({ icon: 'ic_stamina', title: '中毒', text: `毒在经脉里游走，体力精神各 -${CONDS.poisoned.drain * c.sev}。`, cls: 'bad' });
    // 第三重熬一夜是一夜（刚加重的那夜不算）
    if (CONDS[k].lethal && c.sev === 3 && r !== 'worse') {
      if (Math.random() < CONDS[k].lethal) dieMe(k);
      else out.push({ icon: 'ic_stamina', title: CONDS[k].grade[2], text: `你${CONDS[k].grade[2]}，夜里几度昏死过去，总算又熬到天亮。再不医治，下一夜未必醒得过来。`, cls: 'bad' });
    }
  }
  for (const p of Object.values(S.people)) {
    if (p.status !== 'alive' || !p.conds) continue;
    for (const [k, c] of Object.entries(p.conds)) {
      if (k === 'poisoned') p.health = (p.health != null ? p.health : 100) - 4 * c.sev;
      step(p, k, c);
    }
    // 毒发以上熬不过去：手头宽裕的人会去寻郎中
    if (condSev(p, 'poisoned') >= 2 && p.health > 0 && Math.random() < 0.08 * Math.min(1, p.budgetMul)) {
      cureCond(p, 'poisoned'); lifeNote(p, '寻到郎中，解了身上的毒。');
    }
    // 垂危没人救，随时可能咽气
    guHold(p);
    if (condSev(p, 'injured') === 3 && Math.random() < CONDS.injured.lethal) {
      die(p, `${p.name}伤重不治，咽了气。`);
      out.push({ icon: 'ic_ledger', title: '坊间传闻', text: p.life[p.life.length - 1].t, cls: 'bad' });
    }
  }
  return out;
}

// 夜里恢复少多少（受伤）
const condRegenPenalty = () => condSev('me', 'injured') * CONDS.injured.regen;

// 服下能治状态的东西
function cureBy(it, who = 'me') {
  for (const [k, C] of Object.entries(CONDS)) {
    if (!condSev(who, k) || !C.cure.includes(it.id)) continue;
    if (k === 'deviation' && it.id === 'water' && it.purity < 99) continue;
    return k;
  }
  return null;
}

// 药能治几重伤毒：看真实品质——下品减一重，中品减两重，上品以上除根；灵泉水只要纯度够就除根
const CURE_GRADES = [[65, 3], [35, 2], [0, 1]];
const cureGrades = it => hasQuality(it) ? CURE_GRADES.find(([q]) => it.q >= q)[1] : 3;
const CURE_TEXT = ['', '减一重', '减两重', '除根'];

// 人物服下你卖的、送的东西：真药治伤解毒（掺了血灵芝的照样管用）
function npcCure(p, it) {
  if (it.fake || (it.laced && it.laced !== 'tonic')) return null;
  const k = cureBy(it, p);
  if (k) { const left = easeCond(p, k, cureGrades(it)); lifeNote(p, `服下${itemName(it)}，${left ? `${CONDS[k].name}减轻到${CONDS[k].grade[left - 1]}` : `${CONDS[k].name}好了`}。`); }
  return k;
}

// ───────────── 求医 ─────────────

// 手上对症的药
const cureItems = () => Object.values(S.items).filter(it => HELD(it) && cureBy(it));

// 结识过的医者：人物定义里写了 healer、见过面、人还在
const isHealer = p => !!(CAST[p.pid] && CAST[p.pid].healer);
const healers = () => Object.values(S.people).filter(p => isHealer(p) && p.status === 'alive' && p.visits > 0);

// 他治得了你身上的哪几样
const healable = p => CAST[p.pid].healer.heals.filter(k => condSev('me', k));

// 诊金：伤毒越重越贵；交情越好越便宜，亲厚的只收个药钱；贪的人多要；仇视你的不肯治（null）
const HEAL_MOOD = { cold: 1.6, neutral: 1, warm: 0.6, close: 0.25 };
function healFee(p) {
  const m = mood(p.aff);
  if (m === 'hostile') return null;
  const sev = healable(p).reduce((s, k) => s + condSev('me', k), 0);
  return Math.max(10, Math.round(CAST[p.pid].healer.fee * sev * HEAL_MOOD[m] * (0.7 + 0.6 * (p.greed != null ? p.greed : 0.5)) / 10) * 10);
}

// 能不能找他看：能看返回 null，否则返回原因
function healBlock(p) {
  if (!p.visits) return `${ta(p)}还没上过你的门，结识了才好去求诊`;
  if (!Object.keys(S.conds).length) return '你身上没有伤毒';
  if (!healable(p).length) return `${ta(p)}治不了你身上的毛病`;
  const fee = healFee(p);
  if (fee == null) return `${ta(p)}恨你入骨，不肯给你看`;
  if (S.stones < fee) return `诊金 ${fee} 灵石，你不够`;
  return null;
}

const CURE_VERB = { injured: '正骨上药', poisoned: '施针逼毒', deviation: '推宫理气' };
function seekHealer(p) {
  const why = healBlock(p);
  if (why) return { err: why };
  const kinds = healable(p), fee = healFee(p);
  spend(fee, `请${p.name}看病，付诊金 ${fee} 灵石。`);
  kinds.forEach(k => cureCond('me', k));
  remember(p, `你上门求诊，付了 ${fee} 灵石。`, 2);
  return { text: `${p.name}收了 ${fee} 灵石，替你${kinds.map(k => CURE_VERB[k]).join('、')}。你的${kinds.map(k => CONDS[k].name).join('、')}好了。` };
}

// 人物受伤后的命数与需求：带伤的人会来买药
function healingWant(p) {
  if (condSev(p, 'injured')) return pick(['vine_fruit', 'pill_blood']);
  if (condSev(p, 'poisoned') || (p.poisonedDay && S.day - p.poisonedDay <= 5)) return 'herb_blood';
  return null;
}
