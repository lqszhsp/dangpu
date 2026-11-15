// 外观：选哪张图——写实图（webp）优先，没有就退回旧的矢量图；人物的面孔与神态、物品的品相与状态、来客站在哪儿
'use strict';

// ART：已生成的写实图清单（assets/art.js 由 tools/art/postprocess.py 生成）；没有时为空，全部退回 svg
const ART_SET = new Set(typeof ART_LIST !== 'undefined' ? ART_LIST : []);

// name 可带变体：'base~variant'。依次试 base_variant.webp、base.webp、base.svg
function asset(dir, name) {
  const [base, variant] = String(name).split('~');
  if (variant && ART_SET.has(`${dir}/${base}_${variant}`)) return `assets/${dir}/${base}_${variant}.webp`;
  if (ART_SET.has(`${dir}/${base}`)) return `assets/${dir}/${base}.webp`;
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
  if (['herb_seed', 'mihun_seed', 'vine_seed'].includes(it.id) && it.growth >= 50) return 'sprout';
  if (['treasure_rat', 'gold_bug'].includes(it.id)) return (it.growth || 0) < 100 ? 'young' : null;
  return hasQuality(it) ? TIER_OF(shownQ(it)) : null;
}

// ───────────── 人物 ─────────────

// 神态：受控 > 形销骨立 > 当下的情绪 > 交情
function moodOf(c, p) {
  if (p && (p.controlled || p.soulBound)) return 'thrall';
  if (p && ((p.addict || 0) >= 2 || (p.health != null && p.health < 40))) return 'wasted';
  if (c && c.mood) return c.mood;
  if (c && (c.refuse || c.offended)) return 'angry';
  if (c && c.noble) return 'sly';
  if (!p) return 'neutral';
  return p.aff <= -40 ? 'angry' : p.aff >= 55 ? 'pleased' : 'neutral';
}

function portraitOf(c) {
  const p = personOf(c);
  const face = p && c.portrait === p.portrait ? faceOf(p) : c.portrait;
  return `${face}~${moodOf(c, p)}`;
}

const personFace = p => `${faceOf(p)}~${moodOf(null, p)}`;

// 站位：在柜台前、在门口、还是门外
function stageOf(c) {
  if (!c) return null;
  if (S.phase === 'night') return 'outside';
  if (c.leaving) return 'door';
  if (c.kind === 'plea' || c.refuse || c.offended) return 'door';
  if (c.kind === 'story' && ['beggar'].includes(c.pid)) return 'door';
  return 'counter';
}
