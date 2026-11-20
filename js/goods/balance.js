// 货品册：补薄的品类。灵饮、蛊虫、灵宠原先各只有两样，妖族最爱的灵饮只有水和酒；仙门客人能买的珍玩也少。
// 这里补上：两样喝的（茶、猴儿酒）和一样酿的（醉仙酿）、两只现成的蛊、两种新灵宠（灵雀叼消息、灵猫卖给权贵）、两件雅玩、一张保命的符
'use strict';

// ───────────── 灵饮 ─────────────

// 云雾灵茶：最便宜的灵饮，凡人、散修、仙门弟子天天喝；货郎常备，仙门客人也常拿来换钱
defineItem({
  id: 'tea_cloud', name: '云雾灵茶', cat: 'yin', w: 1, h: 1, base: 36,
  art: "a small round unglazed clay tea caddy with its lid set aside, filled with curled emerald-green spirit tea leaves, a faint wisp of white mist drifting up from the leaves, a few loose leaves beside it",
  desc: '仙山云雾里采的灵茶，冲一壶清香满室，喝了耳聪目明（精神 +12）。不值什么钱，凡人、散修、仙门弟子却天天要。',
  from: {
    supply: [40, -100], bulk: true,
    sell: { xian: 2, ren: 1 },
    gift: ['xian'],
  },
  to: {
    wish: ['游方剑客'],
    dealer: ['league'],
    restore: [0, 12],
  },
});

// 猴儿酒：万魔窟里猿猴把野果藏进树洞自己发酵的酒——拾荒偶得，妖族客人也会拿来卖；虎妖最好这一口
defineItem({
  id: 'monkey_wine', name: '猴儿酒', cat: 'yin', w: 1, h: 2, base: 150, lux: true,
  art: "a rough dried bottle gourd used as a wine vessel, its mouth plugged with a wad of green leaves, crushed wild berries and fruit pulp crusted around the opening, a drip of amber wine running down its side, rustic and wild",
  desc: '万魔窟里的灵猿把百样野果藏进树洞，自己酿成的酒，拿葫芦一装就是一壶。酒烈果香，喝了浑身发热（体力 +20、精神 +10）。虎妖最好这一口。',
  from: {
    loot: { beastcave: 1.5 },
    sell: { yao: 1 },
  },
  to: {
    wish: ['虎妖', '落魄散修'],
    restore: [20, 10],
  },
});

// 醉仙酿：灵酒里泡一朵迷魂花，一夜即成——喝了飘飘欲仙一整夜，却不似忘忧散那样离不得；权贵和狐妖抢着要
defineItem({
  id: 'drunk_immortal', name: '醉仙酿', cat: 'yin', w: 1, h: 2, base: 320, lux: true,
  art: "a slender pale celadon porcelain wine flask with a red silk tassel tied at its neck, a faint violet floral haze curling out of the open mouth, a few purple flower petals scattered at its base",
  desc: '一坛灵酒里泡进一朵迷魂花，封一夜便成。入口是花香，喝下去飘飘欲仙一整夜（体力 +10、精神 +30），醒来却不上瘾。少宗主的雅集上少不了它，狐妖闻着味就来。',
  to: {
    wish: ['狐妖', '内门公子'],
    order: ['heir'],
    restore: [10, 30],
  },
});

// 灵酒坛：灵酒一坛＋迷魂花一朵→醉仙酿（酿酒一重）。花香浸酒，一夜即成，不用另封两夜
defineRecipe({
  machine: 'winejar', in: [['spirit_wine', 1], ['mihun_flower', 1]], out: 'drunk_immortal', tech: ['brew', 1], first: true,
  desc: '灵酒一坛＋迷魂花一朵→醉仙酿（酿酒一重，一夜即成）',
});
MACHINES.winejar.desc += '通酿酒一重后，灵酒一坛泡一朵迷魂花，一夜便成醉仙酿。';

// ───────────── 蛊虫 ─────────────

// 情蛊：现成炼好的一对蛊，不必自己养——鬼市有一批，妖族客人偶尔拿来卖；世家小姐、长老亲眷暗地里求
defineItem({
  id: 'love_gu', name: '情蛊', cat: 'gu', w: 1, h: 1, base: 280, lux: true,
  art: "a pair of tiny crimson and rose-pink gu insects entwined together inside a small open red lacquer box lined with silk, a faint rosy glow around them",
  desc: '一雌一雄同心而生的小蛊。雄蛊种进谁身上，谁的心就系在持雌蛊的人那儿——一生只认一名成年女子，她死，持雌蛊的人也活不成。养蛊人蛊虫精通三重才种得下，也是三重时以迷魂花饲金蚕炼成的。世家小姐、长老亲眷暗地里出高价求，鬼市照收不误。',
  from: {
    dealer: { ghost: 1 },
    sell: { yao: 0.4 },
  },
  to: {
    wish: ['世家小姐', '长老亲眷'],
    dealer: ['ghost'],
  },
});

// 子母传音蛊：母蛊听得见子蛊身边的话——暗桩、细作最要的东西；鬼市出货也收货
defineItem({
  id: 'echo_gu', name: '子母传音蛊', cat: 'gu', w: 1, h: 1, base: 200,
  art: "two small matching black glazed porcelain jars, one large and one small, lids off, each holding a slender jade-green gu insect with long antennae, the two insects turned toward each other",
  desc: '一大一小两只蛊，子蛊藏在谁身边，母蛊就把那里的话一字不落地传回来，隔着十里也听得见。细作、暗桩最要这东西。',
  from: {
    dealer: { ghost: 1 },
    sell: { mo: 0.4 },
  },
  to: {
    wish: ['蒙面女修', '内门师姐'],
    dealer: ['ghost'],
  },
});

// ───────────── 灵宠 ─────────────

// 传讯灵雀：吃灵草种、灵果；长到一半后夜里飞出去，偶尔叼回一张写着行情的纸条（每夜至多一张）
defineItem({
  id: 'spirit_sparrow', name: '传讯灵雀', cat: 'chong', w: 1, h: 1, base: 110,
  art: "a small sparrow-like spirit bird with jade-green and white plumage and bright black eyes, a tiny rolled paper message tied to one leg with red thread, perched alert",
  desc: '养在灵兽圈：每夜啄一份灵草种或灵果。长到一半后，夜里飞出去听墙角，偶尔叼回一张写着行情的纸条（一份密报，每夜至多一张）。成年两只可能孵出雏鸟。',
  from: {
    supply: [125, 0],
    sell: { xian: 0.5, ren: 0.5 },
  },
  to: {
    wish: ['凡人行商'],
  },
});

// 玉面灵猫：吃灵兽饲料、腐骨；不产东西，只管长、配种——小猫卖给权贵，太平年景最值钱
defineItem({
  id: 'jade_cat', name: '玉面灵猫', cat: 'chong', w: 1, h: 1, base: 200, lux: true,
  art: "an elegant white spirit cat sitting gracefully with its tail curled around its paws, a jade-green mask-like marking across its face, luminous jade-green eyes",
  desc: '养在灵兽圈：每夜吃一份灵兽饲料或腐骨，什么也不产，只是好看。成年两只偶尔生一窝小猫——世家小姐、内门公子都想抱一只回去。太平年景最值钱。',
  from: {
    sell: { yao: 0.4, ren: 0.3 },
  },
  to: {
    wish: ['世家小姐', '内门公子', '长老亲眷'],
    order: ['heir'],
  },
});

PET_FOOD.spirit_sparrow = ['herb_seed', 'spirit_fruit'];
PET_FOOD.jade_cat = ['beast_feed', 'bones'];
// 灵雀：每夜所有灵雀合起来至多叼回一张纸条；御兽之术越高，叼回来的越勤
PET_YIELD.spirit_sparrow = () => {
  if (S.sparrowDay === S.day) return null;
  S.sparrowDay = S.day;
  if (Math.random() >= 0.15 + 0.05 * techLv('beast')) return null;
  return makeIntel('market') ? '灵雀叼回一张纸条（密报）' : null;
};
PET_YIELD.jade_cat = () => null;
// 灵猫一窝难得：添丁的机会只有寻宝鼠的四成
PET_BREED.jade_cat = 0.12;
MACHINES.pen.inputs.push('herb_seed');
MACHINES.pen.desc += '传讯灵雀啄灵草种、灵果，夜里偶尔叼回密报；玉面灵猫吃灵兽饲料、腐骨，只管长和配种。';

// ───────────── 珍玩 ─────────────

// 焦尾古琴：宗门废墟里偶尔挖得出，落难的仙门弟子也会拿来典当——权贵与仙门客人都认这种雅物
defineItem({
  id: 'jiaowei_qin', name: '焦尾古琴', cat: 'wan', w: 1, h: 3, base: 650, lux: true,
  art: "an antique seven-string guqin zither standing upright and seen straight on from the front, its whole flat soundboard face visible with all seven pale silk strings running down its full length and a row of small mother-of-pearl inlay dots beside them, gently waisted outline, dark lacquered paulownia wood with fine crackle patina, the bottom tail end charred black by old fire",
  desc: '琴尾一截焦黑，是当年从火里抢出来的老桐木。弦一拨，余音绕梁半日。世家小姐、游方剑客都认这种雅物，少宗主办雅集也要摆一张。',
  from: {
    loot: { ruins: 0.7 },
    sell: { xian: 0.8 },
  },
  to: {
    wish: ['世家小姐', '游方剑客'],
    order: ['heir'],
  },
});

// 鲛珠：鲛人泣泪所化——妖族客人手里才有，妖族线人也拿它换功勋；仙门女修、权贵都爱
defineItem({
  id: 'jiao_pearl', name: '鲛珠', cat: 'wan', w: 1, h: 1, base: 360, lux: true,
  art: "a single large luminous pearl with a soft blue-green inner glow resting in a small open seashell, a few drops of seawater beside it",
  desc: '南海鲛人泣泪成珠，夜里自己发光，摸着微凉。妖族拿它当信物，外头难得一见。蒙面女修、世家小姐都爱。',
  from: {
    sell: { yao: 0.6 },
    merit: { yao: 6 },
  },
  to: {
    wish: ['蒙面女修', '世家小姐'],
    order: ['heir'],
  },
});

// ───────────── 符箓 ─────────────

// 遁地符：拾荒遇险时自动燃尽、带你钻地脱身（库房里备着一张就算），省下伤病与罚钱；散修联盟有卖，符案也画得出
defineItem({
  id: 'fu_dundi', name: '遁地符', cat: 'fu', w: 1, h: 1, base: 85, war: 0.5,
  art: "a yellow paper talisman painted with earth-brown cinnabar runes in the shape of a mountain sigil, a few grains of dark soil and iron grit clinging to it, its lower edge sinking into a small mound of earth",
  desc: '以玄铁砂调朱砂画成的土遁符。库房里备着一张，出门拾荒时自会揣在身上：遇险时符一燃，人便钻进土里，再冒头已在三里外——伤不着、罚不着，这一趟却也到此为止。',
  from: {
    dealer: { league: 2 },
  },
  to: {
    wish: ['落魄散修'],
    dealer: ['league'],
  },
});

// 符案：符纸＋朱砂＋玄铁矿→遁地符（符箓一重），一夜两张
defineRecipe({
  machine: 'fudesk', in: [['fu_paper', 1], ['cinnabar', 1], ['iron_ore', 1]], out: 'fu_dundi', tech: ['talisman', 1], batches: 2,
  desc: '符纸＋朱砂＋玄铁矿→遁地符（符箓一重，每夜两张）',
});
MACHINES.fudesk.desc += '符箓一重时再加玄铁矿→遁地符。';
