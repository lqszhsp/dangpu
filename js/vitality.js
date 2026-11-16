// 体力与精神：一切行动都有消耗，入定歇息后恢复；丹药、灵酒、安神香等可以补回来
'use strict';

const VIT_MAX = 100;

// [体力, 精神]
const MACHINE_COST = {
  furnace: [8, 2], forge: [10, 4], danlu: [4, 10], pool: [3, 2], spring: [1, 0], herbbed: [2, 1], gupot: [2, 1], winejar: [2, 0],
  puppet: [0, 0], soulfurnace: [4, 8], coffin: [6, 6], puppetbench: [10, 6], yaopot: [2, 1], forgery: [4, 10],
  dihuo: [15, 3], pen: [3, 1], fudesk: [2, 16],
};
const ACTION_COST = {
  appraise: [0, 4], inspect: [0, 2], probe: [0, 8], haggle: [0, 2], dispute: [0, 3], dig: [6, 2], market: [10, 2],
  talk: [0, 6], erase: [3, 12], seal: [1, 5], bottle: [1, 0], retreat: [30, 10],
  cultivate: [0, 4], breakthrough: [20, 30], kill: [25, 10], soulmark: [5, 20], flatter: [0, 6], command: [0, 5],
};
const ACTION_NAME = { appraise: '鉴定', inspect: '验货', probe: '神识探查', haggle: '议价', dispute: '挑毛病', dig: '翻找', market: '去鬼市',
  talk: '话术', erase: '抹印', seal: '贴封印', bottle: '装瓶', retreat: '闭关',
  cultivate: '服炼', breakthrough: '破境', kill: '动手', soulmark: '种魂印', flatter: '吹捧', command: '差遣' };

// 服用后恢复的 [体力, 精神]
const RESTORE = {
  pill_qi: [0, 30], pill_blood: [25, 10], vine_fruit: [40, 0], spirit_wine: [15, 15], herb_dew: [0, 8], spirit_fruit: [10, 0],
  incense: [0, 40],
};
function restoreOf(it) {
  if (it.id === 'water') return it.purity >= 99.9 ? [25, 25] : it.purity >= 99 ? [0, 15] : null;
  return RESTORE[it.id] && (RESTORE[it.id][0] || RESTORE[it.id][1]) ? RESTORE[it.id] : null;
}

function initVitality() { S.vit = S.vit || { st: VIT_MAX, sp: VIT_MAX }; }

function vitShort(st, sp) {
  if (S.vit.st < st) return '体力不支';
  if (S.vit.sp < sp) return '精神不济';
  return null;
}

function drain(st, sp) {
  S.vit.st = clamp(Math.round(S.vit.st - st), 0, VIT_MAX);
  S.vit.sp = clamp(Math.round(S.vit.sp - sp), 0, VIT_MAX);
}

// 行动：够就扣，不够返回原因
function exert(key, mult = 1) {
  const [st, sp] = ACTION_COST[key].map(v => Math.round(v * mult));
  const why = vitShort(st, sp);
  if (why) return `${why}，${ACTION_NAME[key]}不动了（需体力 ${st}、精神 ${sp}）`;
  drain(st, sp);
  const acts = S.stats.acts = S.stats.acts || {};
  acts[key] = (acts[key] || 0) + 1;
  return null;
}

function costText(key, mult = 1) {
  const [st, sp] = ACTION_COST[key].map(v => Math.round(v * mult));
  return [st ? `体${st}` : '', sp ? `精${sp}` : ''].filter(Boolean).join(' ');
}

// 服用
function consume(it) {
  const cure = cureBy(it);
  if (cure) { cureCond('me', cure); log(`服下${itemName(it)}，${CONDS[cure].name}好了。`, 'gain'); }
  const r = restoreOf(it);
  if (!r) { if (cure) { destroyItem(it); return null; } return '这东西补不了气力。'; }
  const before = { ...S.vit };
  S.vit.st = Math.min(VIT_MAX, S.vit.st + r[0]);
  S.vit.sp = Math.min(VIT_MAX, S.vit.sp + r[1]);
  log(`服下${itemName(it)}，体力 +${S.vit.st - before.st}，精神 +${S.vit.sp - before.sp}。`, 'gain');
  destroyItem(it);
  return null;
}

// 入定歇息：闭关的夜里恢复得少
function restNight() {
  const q = S.upgrades.quiet ? 20 : 0, r = S.retreat ? -25 : 0, d = 5 * (S.cult.lv - 1);
  const hurt = condRegenPenalty();
  const st = 50 + q + r + d - hurt, sp = 45 + q + r + d - hurt;
  // 垂危还闭关，一夜下来只会更虚——但不至于虚到零以下
  S.vit.st = clamp(S.vit.st + st, 0, VIT_MAX);
  S.vit.sp = clamp(S.vit.sp + sp, 0, VIT_MAX);
  const xp = retreatXp();
  return { icon: 'ic_stamina', title: '歇息', text: `${S.retreat ? `闭关一夜，修为 +${xp}，` : hurt ? '伤口疼得睡不安稳，' : '一夜好眠，'}体力恢复到 ${S.vit.st}，精神恢复到 ${S.vit.sp}` };
}

// 闭关：当夜亲自坐镇炉火，地火炉可炼神兵胚料，诸炉出品更精
function toggleRetreat() {
  if (S.retreat) { S.retreat = false; drain(-ACTION_COST.retreat[0], -ACTION_COST.retreat[1]); return null; }
  const err = exert('retreat');
  if (err) return err;
  S.retreat = true;
  return null;
}
