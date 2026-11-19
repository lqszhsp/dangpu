// 外观：选哪张图——写实图（webp）优先，没有就退回旧的矢量图；人物的面孔与神态、物品的品相与状态、来客站在哪儿
'use strict';

// ART：已生成的写实图清单（assets/art.js 由 tools/art/postprocess.py 生成）；没有时为空，全部退回 svg
const ART_SET = new Set(typeof ART_LIST !== 'undefined' ? ART_LIST : []);
// 图片缓存一天：网址带上内容摘要，重画过的图浏览器会重新取
const ART_V = typeof ART_REV !== 'undefined' ? ART_REV : {};
const webp = key => `assets/${key}.webp${ART_V[key] ? `?v=${ART_V[key]}` : ''}`;

// name 可带变体：'base~variant'。依次试 base_variant.webp、base.webp、base.svg
function asset(dir, name) {
  const [base, variant] = String(name).split('~');
  if (variant && ART_SET.has(`${dir}/${base}_${variant}`)) return webp(`${dir}/${base}_${variant}`);
  if (ART_SET.has(`${dir}/${base}`)) return webp(`${dir}/${base}`);
  return `assets/${dir}/${base.replace(/_f\d$/, '')}.svg`;
}

// ───────────── 物品 ─────────────

const TIER_OF = q => q >= 85 ? 'top' : q >= 65 ? 'high' : q >= 35 ? 'mid' : 'low';

// 看得见的状态优先；否则按“看上去”的品相——以次充好的货和真货长得一样，这正是它的用处
function itemVariant(it) {
  if (ITEMS[it.id].book || ITEMS[it.id].tool) return null;
  if (it.fake && knownFlaw(it)) return 'revealed';
  if (it.sealed) return 'sealed';
  if (it.mark && markVisible(it)) return 'marked';
  if (it.id === 'corpse' && it.fresh <= 2) return 'rotting';
  if (it.id === 'spirit_crystal') return (it.charge || 0) >= 8 ? 'charged' : (it.charge || 0) <= 2 ? 'dim' : null;
  if (it.id === 'intel') return intelExpired(it) ? 'expired' : null;
  if (isSeed(it) && it.growth >= 50) return 'sprout';
  if (PET_FOOD[it.id]) return (it.growth || 0) < 100 ? 'young' : null;
  return hasQuality(it) ? TIER_OF(shownQ(it)) : null;
}

// ───────────── 人物 ─────────────

// 神态：受控 > 形销骨立 > 当下的情绪 > 来意 > 最近在你这儿的遭遇 > 交情 > 老辣的人藏着心思。只管画面，不改数值
const FEAR_MEM = ['swallowed', 'controlled', 'blackmailed', 'poisoned'];   // 吃了亏不敢声张的
const RECENT_DAYS = 5;

function moodOf(c, p) {
  if (p && (p.controlled || p.soulBound)) return 'thrall';
  if (p && ((p.addict || 0) >= 2 || (p.health != null && p.health < 40))) return 'wasted';
  if (c && c.mood) return c.mood;
  if (c && (c.refuse || c.offended)) return 'angry';
  if (c && (c.kind === 'plea' || c.wanted)) return 'afraid';
  if (c && (c.noble || c.wantFake)) return 'sly';
  if (!p) return 'neutral';
  // 五日内最近一件分量够的事（照价收货这类寻常好意不算）：好事高兴，坏事恼火，被你压下去的发怵
  const m = [...(p.mem || [])].reverse().find(x => Math.abs(x.a) >= 6);
  if (m && S.day - m.d <= RECENT_DAYS) return m.a > 0 ? 'pleased' : FEAR_MEM.includes(m.k) ? 'afraid' : 'angry';
  if (p.aff >= 45) return 'pleased';
  if (p.aff <= -25) return 'angry';
  return c && c.savvy >= 0.65 ? 'sly' : 'neutral';
}

function portraitOf(c) {
  const p = personOf(c);
  const face = p && c.portrait === p.portrait ? faceOf(p) : c.portrait;
  return `${face}~${moodOf(c, p)}`;
}

const personFace = p => `${faceOf(p)}~${moodOf(null, p)}`;

// 站位：在柜台前、在门口、还是门外。求助的、讲故事的都走到柜台前，和做买卖的一样；
// 只有不肯进门的（拒绝交易、拂袖而去）站在门口，故事里写明站在门口的由 who 返回 at: 'door'
function stageOf(c) {
  if (!c) return null;
  if (S.phase === 'night') return 'outside';
  if (c.leaving || c.refuse || c.offended) return 'door';
  return c.at || 'counter';
}
