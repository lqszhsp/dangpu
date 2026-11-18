// 货品册：花妖与蛛精的东西。曼陀罗、蛛毒是两种新的“料”，蛛丝、水仙花露进老设备的配方。
// 来路：曼殊、朱七娘、凌波这三位角色会给；平时鬼市、散修联盟偶有一批，万魔窟外围翻得到，曼陀罗也能自己在妖植盆里种
'use strict';

// ───────────── 曼陀罗：种出来的迷梦花粉 ─────────────

// 曼陀罗种：鬼市偷偷卖的妖花种子，种进妖植盆三夜开花，收一罐花粉
defineItem({
  id: 'datura_seed', name: '曼陀罗种', cat: 'zhi', w: 1, h: 1, base: 15,
  art: "a small handful of dark spiky datura seed pods, one split open showing black seeds, on a dark wooden tray",
  desc: '乱葬岗边曼陀罗结的刺果，剖开是一把黑籽。种进妖植盆，三夜开出喇叭似的紫白大花，花心里收得一罐花粉。',
  from: {
    dealer: { ghost: 2 },
    sell: { yao: 0.4 },
  },
  to: {},
});
YAO_SEEDS.datura_seed = ['datura_pollen', 34];
MACHINES.yaopot.inputs.push('datura_seed');
MACHINES.yaopot.desc += '曼陀罗种三夜开花，收一罐花粉。';

// 曼陀罗花粉：魔宗禁药里最阴的一味——不伤人，叫人在梦里把心事说出来
defineItem({
  id: 'datura_pollen', name: '曼陀罗花粉', cat: 'zhi', w: 1, h: 1, base: 120, illicit: true, additive: 'dream',
  art: "a small sealed dark purple clay jar with its lid tilted open, fine shimmering pale gold pollen spilling over the rim, a single white-and-violet trumpet-shaped datura flower beside it",
  desc: '曼陀罗花心里收的金粉，甜得发腻。掺进酒里、丹里、果子里，服者当夜昏睡，梦里有问必答——藏着的身份、心里的买卖，都说给你听；醒来只当做了场怪梦。魔宗禁药。',
  from: {
    dealer: { ghost: 1 },
    sell: { yao: 0.3 },
  },
  to: {
    wish: ['蛇妖'],
    dealer: ['ghost'],
  },
});

defineLace('dream', {
  name: '曼陀罗花粉', verb: '掺了曼陀罗花粉', detect: 0.3,
  desc: '服者当夜昏睡，梦里有问必答：身上藏着的身份你都听得到；没什么可藏的，也会念叨几句买卖上的消息。醒来只当做了场怪梦。',
  apply: (p, it, name, knew) => {
    p.health = (p.health || 100) - 5;
    if (knew) commitSin('harm', { p, w: 1, what: `用曼陀罗套${p.name}的话`, virtue: 2 });
    if (p.secret && !p.secret.known) {
      p.secret.known = true;
      log(`${p.name}吃了你的${name}，当夜昏睡，梦里说出自己是${p.secret.type}。`, 'gold');
    } else {
      makeIntel('market');
      log(`${p.name}吃了你的${name}，梦里念叨了几句买卖上的事，你记成了一份密报。`, 'gold');
    }
    remember(p, `吃了你的${name}，做了一夜的怪梦。`, 0);
    return {};
  },
  onMe: it => { drain(10, 40); log(`${itemName(it)}里掺了曼陀罗花粉，你昏睡了大半天，醒来头疼欲裂，体力 -10、精神 -40。`, 'loss'); },
});

// ───────────── 蛛精：丝与毒 ─────────────

// 蛛丝：比灵蚕丝韧十倍、亮十倍；三卷配三束灵丝就能织一件上好的云锦
defineItem({
  id: 'spider_silk', name: '蛛丝', cat: 'cai', w: 1, h: 1, base: 85,
  art: "a neat coiled skein of glittering fine silver spider silk thread, almost translucent and shining like moonlight, wound on a small dark wooden spindle",
  desc: '蜘蛛精吐的丝，一缕能吊起一口铁锅，月光下亮得晃眼。三卷蛛丝配三束灵丝，在灵蚕架上就能织出一件上好的云锦法衣。',
  from: {
    loot: { beastcave: 2 },
    dealer: { ghost: 2 },
    sell: { yao: 0.4 },
  },
  to: {
    dealer: ['league'],
    order: ['heir'],
  },
});

// 灵蚕架：蛛丝三卷、灵丝三束 → 云锦法衣，比纯灵丝的出品更精（排在纯灵丝那条前头）
defineRecipe({
  machine: 'silkrack', in: [['spider_silk', 3], ['silk', 3]], out: 'cloud_robe', tech: ['plant', 1], q: 15, first: true,
  desc: '蛛丝三卷＋灵丝三束→云锦法衣（栽培一重，品相 +15）',
});

// 蛛毒：不要命，叫人手脚发麻——截杀、上擂台之前下一点，事半功倍
defineItem({
  id: 'spider_venom', name: '蛛毒', cat: 'yao', w: 1, h: 1, base: 70, illicit: true, additive: 'numb',
  art: "a small stoppered glass vial of thick dark crimson venom with a faint green sheen, beside a curved black spider fang, on a dark cloth",
  desc: '蛛精毒囊里挤出的毒液。掺进吃食里，服者浑身发麻、手脚无力，几天之内比斗动手都要吃大亏；只是微毒，过几天自己就退。魔宗禁药。',
  from: {
    loot: { beastcave: 2 },
    dealer: { ghost: 1 },
  },
  to: {
    dealer: ['ghost'],
  },
});

defineLace('numb', {
  name: '蛛毒', verb: '下了蛛毒', detect: 0.35,
  desc: '服者浑身发麻、手脚无力，几天内比斗、动手都要吃亏（微毒，几天自己就退，不致命）。截杀、擂台之前下一点，事半功倍。',
  apply: (p, it, name, knew) => {
    // 只叫人发麻、不叫人送命：已经中着毒的不再加重
    if (!condSev(p, 'poisoned')) addCond(p, 'poisoned', 1, `吃了掺蛛毒的${name}`);
    if (knew) commitSin('harm', { p, w: 1, what: `给${p.name}下蛛毒`, virtue: 3 });
    remember(p, `吃了你的${name}，浑身发麻了好几天。`, 0);
    return {};
  },
  onMe: it => { if (!condSev('me', 'poisoned')) addCond('me', 'poisoned', 1, `${itemName(it)}里掺了蛛毒`); },
});

// ───────────── 水仙：花露 ─────────────

// 水仙花露：驻颜丹的好引子，也能镇走火入魔
defineItem({
  id: 'narcissus_dew', name: '水仙花露', cat: 'cai', w: 1, h: 1, base: 90,
  art: "a slender white jade bottle of clear glistening flower dew, a few white narcissus blossoms with golden cups resting beside it, tiny droplets of water on the petals",
  desc: '水仙花妖清晨在花瓣上凝的露，清得照得见人影。添一瓶进丹炉，驻颜丹一炉出两颗；服下清心，可镇走火入魔。',
  from: {
    dealer: { league: 1 },
    sell: { yao: 0.3 },
  },
  to: {
    wish: ['内门师姐', '世家小姐'],
    dealer: ['league'],
    cure: ['deviation'],
  },
});

// 丹炉：花露一瓶、灵果两枚、血灵芝一株 → 驻颜丹两颗（排在普通驻颜丹那条前头）
defineRecipe({
  machine: 'danlu', in: [['narcissus_dew', 1], ['spirit_fruit', 2], ['herb_blood', 1]], out: 'zhuyan_dan', qty: 2, tech: ['alchemy', 1], first: true,
  desc: '水仙花露一瓶＋灵果两枚＋血灵芝一株→驻颜丹两颗（炼丹一重）',
});
