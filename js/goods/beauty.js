// 货品册：驻颜丹。灵果与血灵芝在丹炉里炼出的养颜丹——不涨修为，女修、权贵、狐妖却抢着要；太平年景值钱，打起仗来没人顾得上脸
'use strict';

defineItem({
  id: 'zhuyan_dan', name: '驻颜丹', cat: 'dan', w: 1, h: 1, base: 260, lux: true,
  art: "a single pearl-pink elixir pill with a faint peach-blossom pattern, resting on a tiny white jade dish beside a few pink peach petals, soft rosy glow",
  desc: '粉珠似的丹丸，透着桃花香。服之容颜不老——内门的师姐、世家的小姐、爱美的狐妖都抢着要。不涨修为，打起仗来便不值钱了。',
  from: {
    sell: { xian: 1 },                         // 仙门女修偶尔把用不着的拿来换钱
    dealer: { league: 1 },                     // 散修联盟偶有一批
  },
  to: {
    wish: ['内门师姐', '蒙面女修', '狐妖', '世家小姐'],
    dealer: ['league'],
    order: ['heir'],                           // 少宗主一系办雅集要
    restore: [0, 20],
  },
});

// 灵果两枚、血灵芝一株：炼丹一重即可，比血煞丹好入门；丹火阵盘、丹引照样加持品相
defineRecipe({
  machine: 'danlu', in: [['spirit_fruit', 2], ['herb_blood', 1]], out: 'zhuyan_dan', tech: ['alchemy', 1], batches: 1,
  desc: '灵果两枚＋血灵芝一株→驻颜丹（炼丹一重）',
});
