// 多物品行为的对账目录：合成配方、加料、装瓶、封印、抹印、种魂印、破境。在游戏的上下文里执行（play.mjs behaviors 注入）。
// 每条行为三级漏斗：材料是否都出现过（不必同时）→ 是否有过机会（设备、材料、手艺、模块同时在手）→ 实际做了几次。
// 机会每夜开炉前判一次；实际次数从真实产出数：开炉前后各格子多了什么、少了什么（材料跨夜的，如封坛、封棺，记账到出货那夜）。
// 只读游戏状态，不改行为、不多掷随机数。
// 字段：machine 设备；alt 几种做法（任一）——use 要消耗的 [[id, n]]、has 只需在场的、mod 模块、tech [功法, 重]、retreat 闭关；
//      made 产物 id（'~purify' 提纯、'~gold_gu' 长成金蚕、'~wandu_gu' 相食成万毒蛊、'~dress' 以次充好、'~fake' 仿造的假货 为原地变化）；act 非设备行为；
//      seal 封着盅（蛊盅封盅斗蛊）
'use strict';

const BEHAVIORS = [
  // 炼器
  { id: 'ingot', name: '炼玄铁锭', machine: 'furnace', alt: [{ use: [['iron_ore', 2]] }, { use: [['scrap_sword', 1]] }, { use: [['broken_relic', 1]] }], made: ['iron_ingot', 'spirit_crystal'] },
  { id: 'sword', name: '炼制式飞剑', machine: 'forge', alt: [{ use: [['iron_ingot', 3]], mod: 'jade_slip' }], made: ['sword_std'] },
  { id: 'salvage', name: '残器重炼', machine: 'forge', alt: [{ use: [['broken_relic', 1], ['iron_ingot', 1]] }, { use: [['broken_relic', 1], ['scrap_sword', 1]] }, { use: [['broken_relic', 1], ['iron_ore', 2]] }], made: ['soul_bell', 'bone_flute', 'demon_charm', 'soul_banner', 'sword_std', 'xuan_essence'] },
  { id: 'demon_blade', name: '炼噬魂魔剑', machine: 'forge', alt: [{ use: [['god_blank', 1], ['soul_crystal', 1]], mod: 'jade_slip', tech: ['refine', 2] }], made: ['demon_blade'] },
  { id: 'essence', name: '熬玄铁精', machine: 'dihuo', alt: [{ use: [['iron_ore', 6]] }, { use: [['iron_ingot', 3]] }], made: ['xuan_essence'] },
  { id: 'god_blank', name: '闭关炼神兵胚料', machine: 'dihuo', alt: [{ use: [['xuan_essence', 4]], retreat: true }], made: ['god_blank'] },
  // 炼丹
  { id: 'pill_qi', name: '炼回气丹', machine: 'danlu', alt: [{ use: [['herb_dew', 2]] }], made: ['pill_qi'] },
  { id: 'pill_blood', name: '炼血煞丹', machine: 'danlu', alt: [{ use: [['herb_blood', 1], ['yao_core', 1]] }], made: ['pill_blood'] },
  { id: 'pill_found', name: '炼筑基丹', machine: 'danlu', alt: [{ use: [['herb_blood', 2], ['yao_core', 1], ['herb_dew', 1]], mod: 'pill_recipe' }], made: ['pill_found'] },
  { id: 'zhuyan', name: '炼驻颜丹', machine: 'danlu', alt: [{ use: [['spirit_fruit', 2], ['herb_blood', 1]], tech: ['alchemy', 1] }], made: ['zhuyan_dan'] },
  { id: 'zhuyan_dew', name: '添水仙花露炼驻颜丹（一炉两颗）', machine: 'danlu', alt: [{ use: [['narcissus_dew', 1], ['spirit_fruit', 2], ['herb_blood', 1]], tech: ['alchemy', 1] }], made: ['zhuyan_dan'] },
  { id: 'blood_infant', name: '炼血婴丹', machine: 'danlu', alt: [{ use: [['yao_core', 1], ['blood_essence', 2], ['herb_blood', 1]], tech: ['alchemy', 2] }], made: ['blood_infant'] },
  { id: 'wangyou', name: '炼忘忧散', machine: 'danlu', alt: [{ use: [['mihun_flower', 2]] }], made: ['wangyou'] },
  { id: 'waste', name: '废丹回炉', machine: 'danlu', alt: [{ use: [['waste_pill', 2]] }], made: ['pill_qi', 'pill_blood', 'pill_found'] },
  // 灵泉、酿酒、种植
  { id: 'spring', name: '聚灵泉涌水', machine: 'spring', alt: [{}], made: ['water'] },
  { id: 'purify', name: '滤灵砂洗水', machine: 'pool', alt: [{ use: [['filter_sand', 1]], has: [['water', 1]] }], made: ['~purify'] },
  { id: 'purify_hi', name: '高纯灵砂洗琼浆', machine: 'pool', alt: [{ use: [['spirit_sand', 1]], has: [['water', 1]] }], made: ['~purify'] },
  { id: 'wine', name: '酿灵酒', machine: 'winejar', alt: [{ use: [['spirit_fruit', 2], ['yeast', 1]] }], made: ['spirit_wine'] },
  { id: 'drunk_immortal', name: '灵酒泡迷魂花成醉仙酿', machine: 'winejar', alt: [{ use: [['spirit_wine', 1], ['mihun_flower', 1]], tech: ['brew', 1] }], made: ['drunk_immortal'] },
  { id: 'herb', name: '药圃种灵草', machine: 'herbbed', alt: [{ use: [['herb_seed', 1]] }], made: ['herb_blood', 'herb_dew'] },
  { id: 'mihun', name: '种迷魂花', machine: 'yaopot', alt: [{ use: [['mihun_seed', 1]] }], made: ['mihun_flower'] },
  { id: 'datura', name: '种曼陀罗收花粉', machine: 'yaopot', alt: [{ use: [['datura_seed', 1]] }], made: ['datura_pollen'] },
  { id: 'vine', name: '养噬血藤结血藤果', machine: 'yaopot', alt: [{ use: [['vine_seed', 1], ['bones', 3]] }, { use: [['vine_seed', 1], ['corpse', 1]] }], made: ['vine_fruit'] },   // 一块腐骨喂一夜，三夜结果；一具尸身顶三夜
  { id: 'silk', name: '养蚕抽丝', machine: 'silkrack', alt: [{ use: [['silk_seed', 1], ['spirit_fruit', 2]] }], made: ['silk'] },
  { id: 'robe', name: '织云锦道袍', machine: 'silkrack', alt: [{ use: [['silk', 6]], tech: ['plant', 1] }], made: ['cloud_robe'] },
  { id: 'robe_spider', name: '蛛丝配灵丝织云锦', machine: 'silkrack', alt: [{ use: [['spider_silk', 3], ['silk', 3]], tech: ['plant', 1] }], made: ['cloud_robe'] },
  // 魂、尸、傀儡
  { id: 'pearl', name: '炼魂珠', machine: 'soulfurnace', alt: [{ use: [['soul_wisp', 3]] }, { use: [['soul_wisp', 2]], tech: ['soul', 2] }, { use: [['soul_grudge', 1]] }], made: ['soul_pearl'] },
  { id: 'soul_crystal', name: '炼魂晶', machine: 'soulfurnace', alt: [{ use: [['live_soul', 1], ['soul_pearl', 1]] }], made: ['soul_crystal'] },
  { id: 'iron_corpse', name: '炼铁尸', machine: 'coffin', alt: [{ use: [['corpse', 1], ['soul_pearl', 1]] }], made: ['iron_corpse', 'corpse_poison'] },
  { id: 'corpse_king', name: '炼尸王', machine: 'coffin', alt: [{ use: [['cult_corpse', 1], ['soul_crystal', 1]] }], made: ['corpse_king'] },
  { id: 'puppet', name: '造机关傀儡', machine: 'puppetbench', alt: [{ use: [['iron_ingot', 2], ['soul_pearl', 1]], mod: 'puppet_scroll' }], made: ['puppet_doll'] },
  // 符箓
  { id: 'fu_jingang', name: '画金刚符', machine: 'fudesk', alt: [{ use: [['fu_paper', 1], ['cinnabar', 1]] }], made: ['fu_jingang'] },
  { id: 'fu_shehun', name: '画摄魂符', machine: 'fudesk', alt: [{ use: [['fu_paper', 1], ['cinnabar', 1], ['soul_wisp', 1]] }], made: ['fu_shehun'] },
  { id: 'fu_charm', name: '画血纹护符', machine: 'fudesk', alt: [{ use: [['fu_paper', 1], ['cinnabar', 1], ['bones', 1]] }], made: ['demon_charm'] },
  { id: 'zhen_fu', name: '画聚火阵符', machine: 'fudesk', alt: [{ use: [['fu_paper', 1], ['cinnabar', 1], ['spirit_crystal', 1]], tech: ['talisman', 2] }], made: ['zhen_fu'] },
  { id: 'seal_xian', name: '画正派封印符', machine: 'fudesk', alt: [{ use: [['fu_paper', 1], ['cinnabar', 1], ['xian_talisman', 1]], tech: ['talisman', 3] }], made: ['seal_xian'] },
  { id: 'fu_dundi', name: '画遁地符', machine: 'fudesk', alt: [{ use: [['fu_paper', 1], ['cinnabar', 1], ['iron_ore', 1]], tech: ['talisman', 1] }], made: ['fu_dundi'] },
  // 蛊、灵宠
  { id: 'gold_gu', name: '养出金蚕蛊', machine: 'gupot', alt: [{ has: [['gu', 1]], use: [['bones', 1]] }], made: ['~gold_gu'] },
  { id: 'gu_egg', name: '成蛊产卵', machine: 'gupot', alt: [{ has: [['gu', 2]], use: [['bones', 2]] }], made: ['gu_egg'] },
  { id: 'gu_devour', name: '封盅斗蛊养出万毒蛊', machine: 'gupot', alt: [{ has: [['gu', 4]], seal: true }], made: ['~wandu_gu', 'gu_venom'] },
  { id: 'rat_loot', name: '寻宝鼠叼货', machine: 'pen', alt: RAT_FOOD.map(f => ({ has: [['treasure_rat', 1]], use: [[f, 1]] })), made: ['*'] },
  { id: 'dan_guide', name: '寻宝鼠吃废丹吐丹引', machine: 'pen', alt: [{ has: [['treasure_rat', 1]], use: [['waste_pill', 1]] }], made: ['dan_guide'] },
  { id: 'bug_sand', name: '噬金虫吞玄铁矿、破铜钵吐高纯灵砂', machine: 'pen', alt: BUG_FOOD.filter(f => f !== 'bones').map(f => ({ has: [['gold_bug', 1]], use: [[f, 1]] })), made: ['spirit_sand'] },
  { id: 'bug_feed', name: '噬金虫化腐骨为饲料', machine: 'pen', alt: [{ has: [['gold_bug', 1]], use: [['bones', 1]] }], made: ['beast_feed'] },
  // 作伪
  { id: 'dress', name: '作伪台以次充好', machine: 'forgery', alt: [{ tech: ['forgery', 1], dressable: true }], made: ['~dress'] },
  { id: 'fake', name: '作伪台照样仿造', machine: 'forgery', alt: Object.entries(COUNTERFEITS).map(([id, r]) => ({ use: r.use, modAny: id, known: id })), made: ['~fake'] },
  // 加料（各种药各一条）、装瓶、封印、抹印、种魂印、破境
  ...Object.keys(LACE).map(k => ({ id: `lace_${k}`, name: `加料：${LACE[k].name}`, act: 'lace', kind: k })),
  { id: 'bottle', name: '玉净瓶装灵水', act: 'bottle' },
  { id: 'seal', name: '贴正派封印', act: 'seal' },
  { id: 'erase', name: '抹去原主烙印', act: 'erase' },
  { id: 'soulmark', name: '种魂印', act: 'soulmark' },
  { id: 'plantgu', name: '下蛊（养蛊人）', act: 'plantgu' },
  { id: 'lovegu', name: '炼情蛊', machine: 'gupot', alt: [{ has: [['gu', 1]], use: [['bones', 2], ['mihun_flower', 1]], tech: ['gumaster', 3] }], made: ['~love_gu'] },
  { id: 'break', name: '持破境之物冲关', act: 'break' },
];

// 手上（库房、陈列、地上、暗格、设备格、交易盘、灵力格）有几件
const BHV_held = () => Object.values(S.items).filter(it => HELD(it));
const BHV_count = (list, id) => list.filter(it => it.id === id).length;

// 某种做法此刻还缺什么：设备、功法、材料、模块（闭关算选择，不算条件）；缺的为空就是有机会
function bhvMissing(b, a, held) {
  const miss = [];
  if (b.machine && !S.machines.some(m => m.type === b.machine)) miss.push(`设备·${MACHINES[b.machine].name}`);
  if (a.tech && techLv(a.tech[0]) < a.tech[1]) miss.push(`功法·${TECHS[a.tech[0]].name}${a.tech[1]}重`);
  for (const [id, n] of [...(a.use || []), ...(a.has || [])]) if (BHV_count(held, id) < n) miss.push(`材料·${ITEMS[id].name}${n > 1 ? `×${n}` : ''}`);
  if (a.mod && !BHV_count(held, a.mod)) miss.push(`模块·${ITEMS[a.mod].name}`);
  if (a.modAny && !BHV_count(held, a.modAny)) miss.push(`样品·${ITEMS[a.modAny].name}`);
  if (a.known && !(S.forgeKnown && S.forgeKnown[a.known])) miss.push(`仿法·${ITEMS[a.known].name}`);
  if (a.dressable && !held.some(it => dressable(it) && it.q < 80)) miss.push('材料·能做旧的货');
  return miss;
}
const bhvAltReady = (b, a, held) => !bhvMissing(b, a, held).length;

// 非设备行为此刻还缺什么
function bhvActMissing(b, held) {
  switch (b.act) {
    case 'lace': return [...(held.some(it => ITEMS[it.id].additive === b.kind) ? [] : [`材料·${Object.keys(ITEMS).filter(id => ITEMS[id].additive === b.kind).map(id => ITEMS[id].name).join('或')}`]),
      ...(held.some(canLace) ? [] : ['材料·能掺料的货'])];
    case 'bottle': return held.some(canBottle) ? [] : [held.some(it => it.id === 'water' && !it.bottled) ? '材料·玉净瓶' : '材料·没装瓶的灵水'];
    case 'seal': return held.some(canSeal) ? [] : [owns('seal_xian') ? '材料·能贴封印的货' : '材料·正派封印符'];
    case 'erase': return held.some(canErase) ? [] : [held.some(it => it.mark) ? '功法·抹印（重数不够）' : '材料·带原主烙印的赃物'];
    case 'soulmark': return Object.values(S.people).some(p => p.status === 'alive' && !canSoulMark(p)) ? []
      : [!techLv('soul') ? '功法·炼魂1重' : !owns('soul_pearl') ? '材料·炼魂珠' : '对象·修为低于你的人'];
    case 'plantgu': return !guLv() ? ['开局·养蛊人'] : !plantableGu().length ? ['材料·蛊']
      : Object.values(S.people).some(p => plantableGu().some(it => !plantBlock(p, it))) ? [] : ['对象·修为不高于你、见过面的人'];
    case 'break': return !canBreak() && owns(realm().key) ? [] : [canBreak() || `材料·${realm().key ? ITEMS[realm().key].name : '破境之物'}`];
  }
  return ['？'];
}
const bhvActReady = (b, held) => !bhvActMissing(b, held).length;

// 这条行为用到的物品 id（看“材料都出现过没有”）
function bhvIds(b, a) {
  if (b.act === 'lace') return null;
  return [...(a.use || []), ...(a.has || [])].map(x => x[0]).concat(a.mod ? [a.mod] : [], a.modAny ? [a.modAny] : []);
}
