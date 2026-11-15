// 货品册：灵蚕与云锦。一条两段的生产链：灵蚕种吃灵果吐出灵丝（散修联盟收、可零卖），六束灵丝织成一件云锦法衣（权贵与少宗主一系的雅集抢着要）
'use strict';

// 灵蚕架：便宜、省力，但离不开灵果；御兽之术让蚕吐的丝更好
defineMachine({
  type: 'silkrack', name: '灵蚕架', price: 520, power: 2, in: [3, 2], out: [3, 2], cost: [3, 2], tech: 'beast', overflow: true,
  art: "a tall wooden silkworm rearing rack with several woven bamboo trays, pale glowing silkworms on mulberry leaves, white silk threads drifting, xianxia workshop",
  desc: '一枚灵蚕种配两枚灵果，吐出两束灵丝，每夜两架；通栽培之术后，六束灵丝可织一件云锦法衣。产出格满会溢到地上。',
});

defineItem({
  id: 'silk_seed', name: '灵蚕种', cat: 'cai', w: 1, h: 1, base: 14,
  art: "a small round bamboo tray holding a sheet of paper dotted with tiny pale luminous silkworm eggs, a few fresh mulberry leaves",
  desc: '一张纸上密密麻麻的灵蚕卵，泛着微光。放上灵蚕架，喂灵果，便吐灵丝。',
  from: {
    supply: [16, -100], bulk: true,            // 货郎常备、备货多
    sell: { ren: 2 },                          // 凡人农户拿来换钱
    gift: ['ren'],
  },
});

defineItem({
  id: 'silk', name: '灵丝', cat: 'cai', w: 1, h: 1, base: 40,
  art: "a neat skein of shimmering pale silver spirit silk thread wound around a small wooden spindle, faint moonlight sheen",
  desc: '灵蚕吐的丝，月光下泛着银辉，刀剑难断。散修拿去缝法衣，炼器坊拿去缠剑柄；六束能织一件云锦法衣。',
  from: { sell: { ren: 1 } },
  to: { dealer: ['league'] },
});

defineItem({
  id: 'cloud_robe', name: '云锦法衣', cat: 'wan', w: 2, h: 2, base: 700, lux: true,
  art: "an exquisitely folded xianxia robe of cloud-patterned brocade, iridescent pale blue and silver silk with woven auspicious clouds, faint protective light",
  desc: '灵丝织成的云锦法衣，云纹会随光流转，能挡寻常剑气。权贵穿去雅集撑场面，仙门女修也舍得下本。太平年景最值钱。',
  from: { sell: { xian: 0.3 } },               // 偶有落难的仙门弟子拿来典当
  to: {
    wish: ['蒙面女修', '内门师姐'],
    order: ['heir'],                           // 少宗主一系的订单
  },
});

// 第一段：蚕种吃灵果吐丝
defineRecipe({
  machine: 'silkrack', in: [['silk_seed', 1], ['spirit_fruit', 2]], out: 'silk', qty: 2, batches: 2,
  desc: '灵蚕种一枚＋灵果两枚→灵丝两束，每夜两架',
});

// 第二段：六束灵丝织云锦（要会栽培——养蚕缫丝本是农桑之事）
defineRecipe({
  machine: 'silkrack', in: [['silk', 6]], out: 'cloud_robe', tech: ['plant', 1], batches: 1,
  desc: '灵丝六束→云锦法衣（栽培一重）',
});
