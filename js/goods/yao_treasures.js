// 货品册：妖族的谢礼。妖族线人拿来换功勋的四样东西——都是妖族自己炼的、自己褪下的，不是从妖兽身上剥的（那种东西摆出来只会激怒妖族）。
// 外头几乎见不着，偶尔有妖族客人急用钱拿来卖；功勋价按一点约五六十灵石
'use strict';

// 千年蛇蜕：蛇族自愿褪下的蜕，入药拔毒——第三样解毒的药，比血灵芝、回气丹贵，但不靠拾荒与货郎
defineItem({
  id: 'snake_slough', name: '千年蛇蜕', cat: 'yao', w: 1, h: 2, base: 160,
  art: "a complete shed snakeskin from an ancient jade-green serpent spirit, translucent pale celadon scales with intact diamond pattern and a faint cyan shimmer, loosely coiled on a dark wooden tray",
  desc: '化形的老蛇妖褪下的整张蜕，鳞纹俱全，泛着青光。研末服下能拔毒，中毒即解；蛇族拿它当谢礼，从不卖给外人。',
  from: {
    sell: { yao: 0.3 },
    merit: { yao: 3 },
  },
  to: {
    wish: ['落魄散修'],
    dealer: ['league'],
    cure: ['poisoned'],
  },
});

// 狐火珠：狐族的信物，太平年景权贵拿来作灯——奢侈珍玩，少宗主一系办雅集要
defineItem({
  id: 'fox_fire', name: '狐火珠', cat: 'wan', w: 1, h: 1, base: 480, lux: true,
  art: "a small clear glass orb holding a softly flickering ghostly blue-violet foxfire flame inside, resting on a carved dark rosewood stand with a tiny red silk tassel",
  desc: '狐族以修为凝成的一团幽蓝狐火，封在琉璃珠里，夜里不灭也不烫手。权贵拿来作灯，内门师姐拿来压箱底——狐族说，送狐火是把你当自己人。',
  from: {
    sell: { yao: 0.3 },
    merit: { yao: 8 },
  },
  to: {
    wish: ['世家小姐', '内门师姐'],
    order: ['heir'],
  },
});

// 血藤软甲：妖族匠人用老噬血藤编的甲——战备法器，开战后战堂订单要、魔宗弟子抢
defineItem({
  id: 'vine_armor', name: '血藤软甲', cat: 'qi', w: 2, h: 2, base: 620, war: 0.7,
  art: "a supple vest of armor woven from dark crimson ancient blood-vine, tightly braided cords forming overlapping plates, faint red sap gleaming in the grooves, laid flat and slightly folded",
  desc: '万魔窟深处千年噬血藤的老藤，由妖族匠人揉软编成的软甲，刀剑难入，伤口沾上藤汁还能止血。打起仗来，魔宗弟子抢着要。',
  from: {
    sell: { yao: 0.2 },
    merit: { yao: 11 },
  },
  to: {
    wish: ['外门弟子'],
    order: ['war'],
  },
});

// 妖元丹：妖族长老给未化形的小妖固本的内丹——人族服炼也涨修为，仅次于筑基丹；丹房订单要，妖族客人心心念念
defineItem({
  id: 'yao_yuan_dan', name: '妖元丹', cat: 'dan', w: 1, h: 1, base: 820, war: 0.3,
  art: "a single round elixir pill of deep amber-gold with swirling silver moonlight veins and a faint wild green aura, resting on a broad green leaf beside a few drops of dew",
  desc: '妖族长老采月华、合百草炼成的内丹，给还没化形的小妖固本修行用。人族服下也能长修为，只是灵气里带股野性，夜里容易梦见自己在山里奔跑。',
  from: {
    sell: { yao: 0.2 },
    merit: { yao: 14 },
  },
  to: {
    wish: ['狐妖', '虎妖', '蛇妖'],
    order: ['dan'],
    cultivate: [80],
  },
});
