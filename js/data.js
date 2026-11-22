// 《魔门当铺·来路不明》静态数据：物品、设备、开局、难度、派系、顾客与事件表
'use strict';

// 格子边长：随排版变（见 ui.js fitStage）
let CELL = 40;

const FACTIONS = {
  ren:  { name: '人族', color: '#d9b36a', icon: 'ic_rep_ren',  desc: '凡人与散修。预算不高，买卖实在，常来典当家当。' },
  xian: { name: '仙门', color: '#8fd3ff', icon: 'ic_rep_xian', desc: '潜入魔宗的正道弟子。出手阔绰，但与之交易会引来执法堂注意。' },
  mo:   { name: '魔宗', color: '#e0524a', icon: 'ic_rep_mo',   desc: '血煞宗弟子与执事。声望高则巡查宽松、货源更多。' },
  yao:  { name: '妖族', color: '#e8902f', icon: 'ic_rep_yao',  desc: '化形妖修。爱灵果灵酒，最恨有人贩卖同族妖丹。' },
};

const CATS = {
  dan: '丹药', qi: '法器', cai: '灵材', yao: '妖材', yin: '灵饮',
  fu: '符箓', gu: '蛊虫', wan: '珍玩', ju: '阵具', ji: '秘籍', za: '杂物',
  hun: '魂魄', shi: '尸傀', zhi: '妖植', chong: '灵宠', xin: '消息',
};

// 各品类吸引的顾客派系权重
const CAT_FACTION = {
  dan: { mo: 4, ren: 3, xian: 1 },
  qi:  { mo: 5, xian: 2, ren: 1 },
  cai: { ren: 3, mo: 3, yao: 1 },
  yao: { mo: 5, ren: 1 },
  yin: { yao: 4, ren: 3, mo: 1 },
  fu:  { mo: 3, ren: 2, xian: 2 },
  gu:  { mo: 3, yao: 2 },
  wan: { xian: 3, mo: 2, ren: 2 },
  ju:  { mo: 3, ren: 2 },
  ji:  { mo: 3, ren: 2, xian: 1 },
  za:  { ren: 3 },
  hun: { mo: 5 },
  shi: { mo: 4, ren: 1 },
  zhi: { yao: 3, ren: 2, mo: 1 },
  chong: { yao: 3, ren: 2, mo: 1 },
  xin: { xian: 2, mo: 2, ren: 1, yao: 1 },
};

// contra：仙门禁物；illicit：魔宗禁药；appraise：可鉴定种类；mod：可装入的设备模组槽
// war：战时涨价的权重（0–1）；lux：太平年间的奢侈品，战时跌价；additive：可加进别的货里的“料”
const ITEMS = {
  scrap_sword:    { name: '残剑废铁', cat: 'cai', w: 1, h: 2, base: 12,  desc: '断剑残刃，回炉可得玄铁。' },
  iron_ore:       { name: '玄铁矿',   cat: 'cai', w: 1, h: 1, base: 10,  desc: '炼器炉的基础原料，两块炼一锭。' },
  iron_ingot:     { name: '玄铁锭',   cat: 'cai', w: 1, h: 1, base: 46,  war: 0.5, desc: '炼器台打造飞剑所需。' },
  water:          { name: '灵泉水',   cat: 'yin', w: 1, h: 1, base: 0,   war: 0.3, desc: '价值取决于纯度。洗灵池可提纯，上限 99.01%。' },
  filter_sand:    { name: '滤灵砂',   cat: 'cai',  w: 1, h: 1, base: 5,   desc: '洗灵池耗材，每瓶水提纯一次耗一袋。' },
  herb_seed:      { name: '灵草种',   cat: 'cai', w: 1, h: 1, base: 4,   desc: '种入药圃，两夜后长成凝露草或血灵芝。' },
  herb_dew:       { name: '凝露草',   cat: 'cai', w: 1, h: 1, base: 18,  war: 0.3, desc: '回气丹主药。' },
  herb_blood:     { name: '血灵芝',   cat: 'cai', w: 1, h: 1, base: 40,  war: 0.4, additive: 'tonic', desc: '血煞丹、筑基丹主药。' },
  yao_core:       { name: '妖丹',     cat: 'yao', w: 1, h: 1, base: 70,  war: 0.4, desc: '妖修毕生修为所凝。陈列它会激怒妖族。' },
  beast_hide:     { name: '妖兽皮',   cat: 'yao', w: 2, h: 2, base: 55,  war: 0.3, desc: '上等皮料，魔修拿去缝甲护身。陈列它会激怒妖族。' },
  bones:          { name: '腐骨',     cat: 'za',  w: 1, h: 1, base: 2,   desc: '蛊虫、噬血藤、灵宠的饲料；画血纹护符也要掺一点骨粉。' },
  gu_egg:         { name: '蛊卵',     cat: 'gu',  w: 1, h: 1, base: 25,  desc: '放入蛊盅，一夜孵化。' },
  gu:             { name: '噬心蛊',   cat: 'gu',  w: 1, h: 1, base: 30,  additive: 'control', desc: '每夜食一块腐骨成长，成长满百化为金蚕蛊。毒性可遗传。封进蛊盅相食，吞满三只成万毒蛊、八只成蛊王，一级比一级值钱。养蛊人把它掺进吃食，谁吃下去谁中蛊；不懂蛊的人掺进去，只是一只死虫。' },
  gu_venom:       { name: '蛊毒',     cat: 'gu',  w: 1, h: 1, base: 40,  illicit: true, desc: '万毒蛊、蛊王吐出的毒涎，盛在小瓷瓶里，紫黑发亮。毒性越烈越值钱；鬼市照收，擂台前往对手碗里滴一滴也使得。' },
  spirit_fruit:   { name: '灵果',     cat: 'cai', w: 1, h: 1, base: 12,  lux: true, desc: '妖族最爱。两枚配一块酒曲可酿灵酒。' },
  yeast:          { name: '酒曲',     cat: 'cai', w: 1, h: 1, base: 6,   desc: '酿酒用。' },
  spirit_wine:    { name: '灵酒',     cat: 'yin', w: 1, h: 2, base: 110, lux: true, desc: '灵果酿成，香飘半条街。' },
  spirit_crystal: { name: '灵晶',     cat: 'ju',  w: 1, h: 1, base: 60,  war: 0.6, desc: '放入聚灵阵眼，储存多余灵力供夜间使用。', mod: 'array' },
  broken_bowl:    { name: '破法钵',   cat: 'za',  w: 1, h: 1, base: 6,   desc: '不知哪位和尚留下的缺口铜钵，法力早散了。噬金虫爱啃，能啃出一撮高纯灵砂。' },
  pill_qi:        { name: '回气丹',   cat: 'dan', w: 1, h: 1, base: 70,  war: 0.8, desc: '回气养神的常用丹药，服之精神一振。' },
  pill_blood:     { name: '血煞丹',   cat: 'dan', w: 1, h: 1, base: 180, war: 1, desc: '魔修速成之丹，戾气深重。' },
  pill_found:     { name: '筑基丹',   cat: 'dan', w: 1, h: 1, base: 900, war: 0.3, desc: '筑基圣药，市面赝品极多。', appraise: 'pill' },
  pill_recipe:    { name: '丹方·筑基', cat: 'ji', w: 1, h: 1, base: 400, desc: '放入丹炉模组槽，可炼筑基丹。', mod: 'danlu' },
  jade_slip:      { name: '器谱玉简', cat: 'ji',  w: 1, h: 1, base: 260, desc: '炼器台模组：三锭玄铁打一柄制式飞剑；炼器二重时，也是神兵胚料开锋铸魔剑的器谱。', mod: 'forge' },
  sword_std:      { name: '制式飞剑', cat: 'qi',  w: 1, h: 3, base: 220, war: 1, desc: '血煞宗外门弟子的标配飞剑。' },
  soul_banner:    { name: '噬魂幡',   cat: 'qi',  w: 2, h: 3, base: 950, war: 0.6, desc: '内门魔器，幡中锁着无数残魂。' },
  xian_sword:     { name: '青霄剑',   cat: 'qi',  w: 1, h: 3, base: 1400, war: 0.4, desc: '仙门名剑。在魔宗境内私藏即是重罪。', contra: true },
  xian_talisman:  { name: '太清符',   cat: 'fu',  w: 1, h: 1, base: 130, war: 0.5, desc: '仙门护身符，魔修碰之灼手。', contra: true },
  xian_robe:      { name: '仙门道袍', cat: 'wan', w: 2, h: 2, base: 300, lux: true, desc: '正道弟子的制式道袍。', contra: true },
  demon_charm:    { name: '血纹护符', cat: 'fu',  w: 1, h: 1, base: 55,  war: 0.6, desc: '魔宗弟子随身的护符。' },
  jade_pendant:   { name: '古玉佩',   cat: 'wan', w: 1, h: 1, base: 380, lux: true, desc: '前朝盘龙玉佩，仿品泛滥。', appraise: 'jade' },
  bronze_mirror:  { name: '青铜古镜', cat: 'wan', w: 2, h: 2, base: 600, lux: true, desc: '上古八瓣花镜，据说能照出妖形。', appraise: 'mirror' },
  scroll_manual:  { name: '残卷功法', cat: 'ji',  w: 1, h: 2, base: 150, lux: true, desc: '不知名功法的残页，凑不齐、练不成。散修当它是机缘，权贵拿来装点书房。' },
  fire_disk:      { name: '聚火阵盘', cat: 'ju',  w: 1, h: 1, base: 160, desc: '炼器炉模组：每夜炉次 2→4，但成锭品质下降。', mod: 'furnace' },
  dan_fire:       { name: '丹火阵盘', cat: 'ju',  w: 1, h: 1, base: 90,  desc: '刻着丹炉的红铜阵盘，镇住炉火、常驻不焚。丹炉模组：每夜多炼一炉，成丹品质 +20。', mod: 'danlu' },
  soul_bell:      { name: '摄魂铃',   cat: 'qi',  w: 1, h: 1, base: 240, war: 0.5, mod: 'soulfurnace', desc: '摇之令人心神恍惚。挂进炼魂炉的模组格，引魂入炉，每夜多炼一炉。' },
  soul_wisp:      { name: '游魂',     cat: 'hun', w: 1, h: 1, base: 28,  war: 0.5, desc: '乱葬岗飘荡的残魂。三缕可炼一颗魂珠。' },
  soul_grudge:    { name: '怨魂',     cat: 'hun', w: 1, h: 1, base: 75,  war: 0.7, desc: '横死之人的怨魂，戾气极重。一缕即可炼成上品魂珠。' },
  soul_pearl:     { name: '炼魂珠',   cat: 'hun', w: 1, h: 1, base: 230, war: 1, desc: '魂魄炼成的宝珠，驱动法器、铁尸与傀儡的魔道之源。' },
  corpse:         { name: '无名尸',   cat: 'shi', w: 1, h: 2, base: 22,  war: 0.3, desc: '草席裹着的尸身。会腐烂，夏日尤快，烂透了只剩腐骨。' },
  iron_corpse:    { name: '铁尸',     cat: 'shi', w: 1, h: 3, base: 640, war: 1, desc: '炼尸棺中炼成的铁尸，刀枪不入，听令而行。' },
  corpse_poison:  { name: '尸毒',     cat: 'shi', w: 1, h: 1, base: 45,  illicit: true, additive: 'poison', desc: '炼尸时滴下的尸毒。混进吃食里，神仙也难救。' },
  puppet_doll:    { name: '机关傀儡', cat: 'shi', w: 1, h: 3, base: 520, war: 1, desc: '玄铁为骨、魂珠为心的机关傀儡。' },
  puppet_scroll:  { name: '傀儡图谱', cat: 'ji',  w: 1, h: 1, base: 320, desc: '傀儡台模组：两锭玄铁、一颗魂珠造一具机关傀儡。', mod: 'puppetbench' },
  mihun_seed:     { name: '迷魂花种', cat: 'zhi', w: 1, h: 1, base: 8,   desc: '种进妖植盆，两夜开花。' },
  mihun_flower:   { name: '迷魂花',   cat: 'zhi', w: 1, h: 1, base: 32,  desc: '花香令人飘飘欲仙。两朵入丹炉，可炼忘忧散。' },
  wangyou:        { name: '忘忧散',   cat: 'dan', w: 1, h: 1, base: 95,  illicit: true, additive: 'addict', desc: '服之忘忧，再服离不得。魔宗明令禁售。' },
  vine_seed:      { name: '噬血藤种', cat: 'zhi', w: 1, h: 1, base: 12,  desc: '种进妖植盆，每夜要吃一块腐骨或一具尸身，三夜结果。' },
  vine_fruit:     { name: '血藤果',   cat: 'zhi', w: 1, h: 1, base: 65,  war: 0.8, desc: '以血肉为养的妖果，止血续骨的疗伤圣药。' },
  broken_relic:   { name: '残破法器', cat: 'qi',  w: 1, h: 2, base: 32,  war: 0.3, desc: '古战场与宗门废墟里挖出的残器。投入炼器台（器鼎）配一锭玄铁重新祭炼，可能炼出比原样更好的法宝。' },
  waste_pill:     { name: '废丹',     cat: 'dan', w: 1, h: 1, base: 9,   desc: '炸炉留下的废丹，药力未散尽。两颗投入丹炉重新祭炼，十有七八能成丹；寻宝鼠吃了会吐出丹引。' },
  spirit_sand:    { name: '高纯灵砂', cat: 'cai',  w: 1, h: 1, base: 48,  desc: '噬金虫吞铁所产。放进洗灵池代替滤灵砂，能把灵液洗过无根灵水，直到琼浆玉露。' },
  dan_guide:      { name: '丹引',     cat: 'ju',  w: 1, h: 1, base: 130, mod: 'danlu', desc: '放入丹炉模组格：当夜成丹品质 +25，用后即散。寻宝鼠吃废丹偶尔吐出。' },
  beast_feed:     { name: '灵兽饲料', cat: 'za',  w: 1, h: 1, base: 42,  war: 0.3, desc: '噬金虫消化腐骨后排出的饲料块。放进灵兽圈喂寻宝鼠，一份顶两份长；驭兽的散修、鬼市都收。' },
  treasure_rat:   { name: '寻宝鼠',   cat: 'chong', w: 1, h: 1, base: 85,  desc: '养在灵兽圈：每夜吃一份饲料（废丹、腐骨、灵果、灵兽饲料），钻出去替你叼回些东西；吃废丹偶尔吐出丹引，吃灵兽饲料长得快一倍。成年两只可能产仔。' },
  gold_bug:       { name: '噬金虫',   cat: 'chong', w: 1, h: 1, base: 120, desc: '养在兽栏里：每夜吞一块玄铁矿或一只破铜钵产出高纯灵砂，吞腐骨产出灵兽饲料。成年两只可能产卵。' },
  fu_paper:       { name: '符纸',     cat: 'cai',  w: 1, h: 1, base: 4,   desc: '画符用的黄纸。' },
  cinnabar:       { name: '朱砂',     cat: 'cai', w: 1, h: 1, base: 9,   desc: '画符的朱砂。' },
  fu_jingang:     { name: '金刚符',   cat: 'fu',  w: 1, h: 1, base: 70,  war: 1, desc: '一张可挡飞剑一击的护身符。战时人手一张。' },
  fu_shehun:      { name: '摄魂符',   cat: 'fu',  w: 1, h: 1, base: 140, war: 0.6, desc: '封了一缕游魂的攻伐符，魔修临阵必备。' },
  zhen_fu:        { name: '聚火阵符', cat: 'fu',  w: 1, h: 1, base: 75,  mod: ['furnace', 'dihuo', 'danlu', 'forge'], desc: '阵法增益符。放进炼器炉、炼器台、地火炉或丹炉的模组格，当夜出炉翻倍，用后即焚。' },
  seal_xian:      { name: '正派封印符', cat: 'fu', w: 1, h: 1, base: 90, desc: '名门正派的封印符箓。贴在来路干净的法器、珍玩、丹药、符箓上，冒充名门所出，身价大涨——前提是没人看穿。' },
  jade_bottle:    { name: '玉净瓶',   cat: 'za',  w: 1, h: 1, base: 10,  desc: '白玉细颈瓶。灵液装进玉净瓶，修士们才肯出高价。' },
  xuan_essence:   { name: '玄铁精',   cat: 'cai', w: 1, h: 1, base: 150, war: 0.6, desc: '六块玄铁矿（或三锭玄铁）在地火炉里熬出的一块精华。四块玄铁精配夜里闭关，可炼天阶神兵胚料。' },
  god_blank:      { name: '神兵胚料', cat: 'qi',  w: 1, h: 2, base: 1250, war: 0.8, desc: '天阶神兵的胚料，内门长老亲自上门求购。' },
  incense:        { name: '安神香',   cat: 'za',  w: 1, h: 1, base: 26,  desc: '一小炉安神香，点上之后精神 +40。' },
  lens1:          { name: '铜框照妖镜', cat: 'qi', w: 1, h: 1, base: 60,   tool: 1, desc: '鉴定术一重：放上鉴宝台，可看穿粗劣的作伪。' },
  lens2:          { name: '玉髓照妖镜', cat: 'qi', w: 1, h: 1, base: 380,  tool: 2, desc: '鉴定术二重：寻常的以次充好、仿古手法无所遁形。' },
  lens3:          { name: '照骨灵镜',   cat: 'qi', w: 1, h: 1, base: 950,  tool: 3, desc: '鉴定术三重：连精良的赝品也照得出骨相。' },
  lens4:          { name: '天目珠',     cat: 'qi', w: 1, h: 1, base: 2300, tool: 4, desc: '鉴定术四重：天衣无缝的作伪，在它面前也是破绽百出。' },
  bone_flute:     { name: '骨笛',     cat: 'qi',  w: 1, h: 2, base: 140, war: 0.4, desc: '以妖骨制成，可驭小鬼。' },
  // 杀人夺宝所得，与由此炼出的重宝
  cult_corpse:    { name: '修士遗蜕', cat: 'shi', w: 1, h: 2, base: 160, war: 0.4, desc: '有修为在身的人死后留下的肉身，灵气未散，不会腐烂。入炼尸棺配一块魂晶，可炼尸王。' },
  live_soul:      { name: '生魂',     cat: 'hun', w: 1, h: 1, base: 150, war: 0.6, desc: '活生生抽出的魂魄，灵智未泯。入炼魂炉配一颗炼魂珠炼成魂晶；直接服炼也能涨修为。' },
  blood_essence:  { name: '精血',     cat: 'cai', w: 1, h: 1, base: 80,  war: 0.4, desc: '修士的心头精血。两份配妖丹、血灵芝炼血婴丹（炼丹二重）；服炼也能涨修为。' },
  soul_crystal:   { name: '魂晶',     cat: 'hun', w: 1, h: 1, base: 650, war: 0.8, desc: '生魂与魂珠炼成的晶石。炼尸王、铸魔剑的魂核，也是冲击元婴的资粮。' },
  corpse_king:    { name: '尸王',     cat: 'shi', w: 1, h: 3, base: 2400, war: 1, desc: '修士遗蜕以魂晶为心炼成的尸王，力敌筑基。战堂与鬼市都出天价。' },
  blood_infant:   { name: '血婴丹',   cat: 'dan', w: 1, h: 1, base: 1500, war: 0.5, desc: '妖丹、精血、血灵芝炼成的魔丹。服之修为暴涨，是筑基修士结丹的钥匙。' },
  demon_blade:    { name: '噬魂魔剑', cat: 'qi',  w: 1, h: 3, base: 4200, war: 0.8, desc: '神兵胚料以魂晶开锋，剑中锁着生魂（炼器二重，器谱玉简为模）。内门长老亲自上门求购。' },
  intel:          { name: '密报',     cat: 'xin', w: 1, h: 1, base: 0,   desc: '一纸消息。值多少，看写的是什么、落到谁手里、过没过时。' },
};

const QUALITY_TIERS = [[85, '极品'], [65, '上品'], [35, '中品'], [0, '下品']];

// 作伪的做工：鉴定术重数不低于做工，才看得穿
const GRADE_NAMES = ['', '粗劣', '寻常', '精良', '天衣无缝'];
const LENS_NAMES = ['肉眼', '铜框照妖镜', '玉髓照妖镜', '照骨灵镜', '天目珠'];

// 技艺：逐重提升，各到四重——一二重读货郎卖的秘籍；三四重鬼市不卖，拿功勋换，或等机遇：行家登门传艺（TEACHERS）、拾荒偶得（LOCATIONS 的 scrolls）、好人好报。machines 为受其加持的设备
const TECHS = {
  refine:  { name: '炼器', icon: 'book_refine',  machines: ['furnace', 'forge'],     max: 4, desc: '炼器炉、炼器台出品每重品质 +8；三重时炼器炉每夜多一炉。' },
  alchemy: { name: '炼丹', icon: 'book_alchemy', machines: ['danlu'],                max: 4, desc: '丹炉出品每重品质 +8；三重时每夜多一炉。' },
  soul:    { name: '炼魂', icon: 'book_soul',    machines: ['soulfurnace'],          max: 4, desc: '魂珠每重品质 +8；二重时两缕游魂即可成珠。' },
  corpse:  { name: '炼尸', icon: 'book_corpse',  machines: ['coffin'],               max: 4, desc: '铁尸每重品质 +8；二重时一夜即可开棺。' },
  puppet:  { name: '傀儡', icon: 'book_puppet',  machines: ['puppetbench'],          max: 4, desc: '机关傀儡每重品质 +10。' },
  plant:   { name: '栽培', icon: 'book_plant',   machines: ['herbbed', 'yaopot'],    max: 4, desc: '灵草、妖植每重长得快两成五，出品品质 +6。' },
  brew:    { name: '酿酒', icon: 'book_brew',    machines: ['winejar'],              max: 4, desc: '灵酒每重品质 +10；二重时一夜即成。' },
  water:   { name: '洗灵', icon: 'book_water',   machines: ['pool'],                 max: 4, desc: '每重提纯更快。' },
  forgery: { name: '作伪', icon: 'book_forgery', machines: ['forgery'],              max: 4, desc: '每重提高以次充好与仿造的做工；做工越高，越少有人看得穿。' },
  erase:   { name: '抹印', icon: 'book_erase',   machines: [],                       max: 4, desc: '抹去赃物上原主的神识烙印。烙印几重，就要几重抹印术；重宝的原主留得深，可达四重。抹净的赃物再无人能循迹追来。' },
  talisman:{ name: '符箓', icon: 'book_talisman', machines: ['fudesk'],              max: 4, desc: '每重多画一张、品质 +8；二重会画聚火阵符；三重会画正派封印符。' },
  // 养蛊人独门，没有秘籍、没人教、功勋也换不到：养蛊攒经验自动升重（见 js/gu.js）
  gumaster:{ name: '蛊虫精通', icon: 'gu_gold', machines: ['gupot'], max: 4, exclusive: true,
             desc: '养蛊人独门手艺，别处学不来：孵卵、喂养、长成、产卵、吐毒、相食都攒经验，攒够自动升重。每重蛊长得快、产卵勤、子代更毒；会下蛊——几重驾驭几阶蛊，下给修为不高于你的人（四重可下到高你一境的人）；三重能以迷魂花饲金蚕，炼成情蛊。' },
  beast:   { name: '御兽', icon: 'book_beast',   machines: ['pen'],                  max: 4, desc: '每重让灵宠每夜多吃一份、多产一份，长得更快、产出品质 +10；寻宝鼠叼回的东西更值钱。' },
};

// 秘籍：[id, 技艺, 第几重, 价钱, 魔宗声望要求, 名字, 附带的仿造之法]
// 货郎只卖到第 BOOK_SHOP_MAX 重；再往上的价钱只定书的身价，换法见 market.js 的 MERIT_SHOP 与下面的 TEACHERS
const BOOK_SHOP_MAX = 2;
const BOOKS = [
  ['bk_refine1', 'refine', 1, 180, -100, '炼器要诀'], ['bk_refine2', 'refine', 2, 420, 0, '炼器秘要'], ['bk_refine3', 'refine', 3, 900, 15, '百炼真解'], ['bk_refine4', 'refine', 4, 1500, 25, '器道通玄'],
  ['bk_alchemy1', 'alchemy', 1, 200, -100, '丹道入门'], ['bk_alchemy2', 'alchemy', 2, 480, 0, '丹经'], ['bk_alchemy3', 'alchemy', 3, 1000, 15, '九转丹书'], ['bk_alchemy4', 'alchemy', 4, 1600, 25, '太上丹诀'],
  ['bk_soul1', 'soul', 1, 220, 5, '炼魂诀·上'], ['bk_soul2', 'soul', 2, 520, 15, '炼魂诀·下'], ['bk_soul3', 'soul', 3, 1100, 25, '摄魂真经'], ['bk_soul4', 'soul', 4, 1700, 35, '万魂归宗'],
  ['bk_corpse1', 'corpse', 1, 240, 5, '养尸经'], ['bk_corpse2', 'corpse', 2, 560, 15, '炼尸大法'], ['bk_corpse3', 'corpse', 3, 1150, 25, '尸解秘录'], ['bk_corpse4', 'corpse', 4, 1800, 35, '不化骨经'],
  ['bk_puppet1', 'puppet', 1, 260, 0, '机关术'], ['bk_puppet2', 'puppet', 2, 600, 15, '偃师秘录'], ['bk_puppet3', 'puppet', 3, 1250, 25, '千机变'], ['bk_puppet4', 'puppet', 4, 1900, 35, '天工傀儡谱'],
  ['bk_plant1', 'plant', 1, 150, -100, '百草经'], ['bk_plant2', 'plant', 2, 380, 0, '妖植志'], ['bk_plant3', 'plant', 3, 800, 15, '神农遗篇'], ['bk_plant4', 'plant', 4, 1300, 25, '草木通灵录'],
  ['bk_brew1', 'brew', 1, 120, -100, '酒谱'], ['bk_brew2', 'brew', 2, 320, 0, '仙酿秘方'], ['bk_brew3', 'brew', 3, 680, 15, '百花酿经'], ['bk_brew4', 'brew', 4, 1100, 25, '杜康遗方'],
  ['bk_water1', 'water', 1, 140, -100, '洗灵法'], ['bk_water2', 'water', 2, 340, 0, '净水真诀'], ['bk_water3', 'water', 3, 720, 15, '玉露真解'], ['bk_water4', 'water', 4, 1150, 25, '上善若水篇'],
  ['bk_forgery1', 'forgery', 1, 200, -100, '以次充好篇'], ['bk_forgery2', 'forgery', 2, 450, 10, '仿古秘录', ['jade_pendant', 'bronze_mirror']],
  ['bk_forgery3', 'forgery', 3, 800, 20, '丹形易容术', ['pill_found']], ['bk_forgery4', 'forgery', 4, 1400, 35, '天衣无缝'],
  ['bk_erase1', 'erase', 1, 260, 0, '洗印诀·初'], ['bk_erase2', 'erase', 2, 600, 10, '洗印诀·中'], ['bk_erase3', 'erase', 3, 1100, 25, '洗印诀·上'], ['bk_erase4', 'erase', 4, 1700, 35, '无痕诀'],
  ['bk_talisman1', 'talisman', 1, 160, -100, '符箓入门'], ['bk_talisman2', 'talisman', 2, 420, 0, '阵符要略'], ['bk_talisman3', 'talisman', 3, 900, 10, '正一符经'], ['bk_talisman4', 'talisman', 4, 1450, 25, '天书符箓'],
  ['bk_beast1', 'beast', 1, 180, -100, '驯兽经'], ['bk_beast2', 'beast', 2, 450, 0, '万虫谱'], ['bk_beast3', 'beast', 3, 950, 15, '御灵真经'], ['bk_beast4', 'beast', 4, 1500, 25, '万兽朝宗'],
];
BOOKS.forEach(([id, tech, lv, price, , name, teach]) => {
  ITEMS[id] = { name: `《${name}》`, cat: 'ji', w: 1, h: 1, base: Math.round(price * 0.7), icon: TECHS[tech].icon, book: { tech, lv, teach },
    desc: `${TECHS[tech].name}第${'一二三四'[lv - 1]}重秘籍。研读后${TECHS[tech].name}技艺升至第${'一二三四'[lv - 1]}重（须先通前一重）。${teach ? `附仿造${teach.map(t => ITEMS[t].name).join('、')}之法。` : ''}${lv > BOOK_SHOP_MAX ? '鬼市不卖：拿功勋换，或等机遇——行家传艺、拾荒偶得、好人好报。' : ''}` };
});

// 传艺：三四重的机遇之一。肯教的行家（谁先与你亲厚、自己那桩事也了了，谁来）与他压着手抄时说的话（三重、四重各一句）
const TEACH_AFF = [55, 80];   // 三重、四重各要多少好感
const TEACHERS = {
  refine:   { who: ['duan_yinghuo', 'li_duangang', 'lu_tiechui'], lines: ['炉火这门手艺，教会一个就少一口饭。可你待我不薄——看完烧了，别说是我给的。',
    '宗门的神兵都是这一手打的，打成了记在长老名下。你学会了，往后打的东西，好歹记在你自己名下。'] },
  alchemy:  { who: ['ye_danping', 'mu_qingdan', 'lu_pinxiang'], lines: ['丹房里这卷只给嫡传看，嫡传拿它炼驻颜丹，卖给长老夫人。你学去，好歹炼点正经东西。',
    '九转之后还有一转，丹房说那是长老的独门——其实是我替他炼了三十年。'] },
  soul:     { who: ['gui_dengpo', 'dugu_que'], lines: ['魂这东西，炼的时候别听它说话。听多了，你就舍不得炼了——那可就做不成买卖了。',
    '最后这一重，是把许多魂炼成一个。宗门管这叫“归宗”，我管这叫灭口。'] },
  corpse:   { who: ['yan_fengjiu'], lines: ['尸身也有脾气，顺着它的筋络走，它就肯替你干活。比活人听话多了。',
    '炼到这一重，死人连亲娘都认不出是谁——所以执法堂才这么爱用。'] },
  puppet:   { who: ['hui_qiaosuo', 'wan_xiaomu'], lines: ['关节要装得比人还活，客人才肯掏钱。至于它伤了谁，那是装错的人的事。',
    '傀儡做到这一步，连它自己都以为自己是人。别让它知道。'] },
  plant:    { who: ['tao_yunhe', 'he_baizhi'], lines: ['草木不挑主人，你浇水它就长。比铺子里的熟客有良心。',
    '这一重的口诀是从祖辈的种匣里抄来的——宗门征了药圃，可没征走记在心里的东西。'] },
  brew:     { who: ['yue_chan', 'zhu_shanye'], lines: ['酒要窖得久，话要等人醉了再听——这铺子里，两样你都用得上。',
    '这一坛的方子，喝过的都说是仙酿。其实只多放了一样东西：耐心。还有一点迷魂花。'] },
  water:    { who: ['ling_bo', 'ao_xunlan'], lines: ['水清不清，看的不是水，是滤它的人肯不肯下功夫。你这儿的水，还差一口气。',
    '上游截了水，下游才晓得一瓶干净水值多少钱。这门手艺，是让你把它卖得更贵的。'] },
  forgery:  { who: ['qian_shiqi'], lines: ['我验了一辈子的货，真假过眼就知——所以我也最清楚，假货要怎么做才验不出来。',
    '这最后一手我从没教过人。教了你，往后我验出来的假货，怕有一半是你做的。'] },
  erase:    { who: ['hui_qiaosuo', 'gui_dengpo'], lines: ['神识烙印也是一把锁，是锁就有钥匙。这手艺原是替失主开锁的，后来找上门的，多半不是失主。',
    '最深的烙印是重宝的原主留的。抹掉它，等于把一个人从这件东西的来历里抹掉。你确定要学？——好，你确定。'] },
  talisman: { who: ['fu_shoumo', 'mo_yanqing'], lines: ['名门正派的立身之本——说穿了，就是教人怎么把符画得像名门画的。你这铺子用得上。',
    '天书上的符，宗门说只有天人画得出。我画了一辈子，署的都是天人的名字。'] },
  beast:    { who: ['wen_lingqi', 'tu_baigu'], lines: ['畜生最懂人心：谁喂它，它就认谁。人也一样，只是忘得快些。',
    '灵兽阁的驯法，说白了就是饿着它，再救它。这一重教的，就是怎么救得恰到好处。'] },
};

// 仿造：放样品于作伪台模组格，按配方消耗原料，造出同款赝品
const COUNTERFEITS = {
  jade_pendant:  { use: [['bones', 1], ['water', 1]], text: '骨胎染色，压出龙纹' },
  bronze_mirror: { use: [['scrap_sword', 1], ['bones', 1]], text: '废铁回炉，翻铸花纹，做出铜锈' },
  pill_found:    { use: [['pill_qi', 1], ['herb_dew', 1]], text: '回气丹裹金，刻出丹纹' },
};

// 设备：in/out/mod 为格子尺寸；power 为每夜灵力消耗；inputs 为输入格可放的物品（null 表示不限）
// overflow：产出格满时溢出到地上，否则停产
const MACHINES = {
  furnace: { name: '炼器炉', icon: 'm_furnace', price: 450, power: 3, in: [2, 2], out: [2, 2], mod: [1, 1],
             inputs: ['iron_ore', 'scrap_sword', 'broken_relic'], overflow: true, feedStack: 10,
             desc: '两块玄铁矿或一柄残剑炼成一锭玄铁。每夜两炉。产出格满会溢到地上。料与产物同种叠放，一格至多十份。' },
  forge:   { name: '炼器台', icon: 'm_forge', price: 900, power: 3, in: [3, 2], out: [2, 3], mod: [1, 1],
             inputs: ['iron_ingot', 'broken_relic', 'god_blank', 'soul_crystal', 'scrap_sword', 'iron_ore'], overflow: true, feedStack: 10,
             desc: '模组槽放器谱玉简，三锭玄铁打一柄制式飞剑，每夜一柄；炼器二重时，神兵胚料配魂晶铸噬魂魔剑。也是器鼎：残破法器配一锭玄铁（或一柄残剑、两块玄铁矿）重新祭炼，每夜两件。料与产物同种叠放，一格至多十份。' },
  danlu:   { name: '炼丹炉', icon: 'm_danlu', price: 800, power: 4, in: [2, 2], out: [2, 2], mod: [2, 1], feedStack: 10,
             inputs: ['herb_dew', 'herb_blood', 'yao_core', 'mihun_flower', 'waste_pill', 'blood_essence'],
             desc: '两株凝露草→回气丹；血灵芝+妖丹→血煞丹；两朵迷魂花→忘忧散；模组槽有丹方时，二血灵芝+妖丹+凝露草→筑基丹；炼丹二重时，妖丹+两份精血+血灵芝→血婴丹。两颗废丹也能重炼（有丹引必成）。料与产物同种叠放，一格至多十份。' },
  pool:    { name: '洗灵池', icon: 'm_pool', price: 350, power: 2, in: [3, 2], out: [3, 1], feedStack: 10,
             inputs: ['water', 'filter_sand', 'spirit_sand'],
             desc: '每夜最多洗四瓶灵泉水，每瓶耗一袋滤灵砂（纯度向 99.01% 逼近）或一袋高纯灵砂（可洗过 99.9%，直到琼浆玉露）。料与产物同种叠放，一格至多十份。' },
  spring:  { name: '聚灵泉眼', icon: 'm_spring', price: 350, power: 2, out: [3, 1], overflow: true,
             desc: '每夜涌出三瓶浊灵水（有灵石矿脉契约时四瓶）。产出格满会溢到地上。' },
  herbbed: { name: '药圃', icon: 'm_herbbed', price: 300, power: 1, in: [3, 2], out: [3, 1],
             inputs: ['herb_seed'],
             desc: '灵草种每夜长一半，两夜成熟，移入产出格。' },
  gupot:   { name: '蛊盅', icon: 'm_gupot', price: 400, power: 1, in: [2, 2], pot: [3, 2], out: [3, 1], inLabel: '原料', potLabel: '蛊虫', outLabel: '产物',
             inputs: ['bones', 'mihun_flower'], habitat: ['gu', 'gu_egg'], feedStack: 10,
             desc: '原料格放腐骨（同种叠放，一格至多十份），蛊虫格养蛊，产物格收蛊卵与蛊毒。开盅喂养：幼蛊每夜食一骨，长满化为金蚕蛊；两只成蛊可能产卵，子代继承并可能强化毒性；万毒蛊、蛊王每夜食一骨，吐出蛊毒。封盅斗蛊：不喂食、不孵卵，每夜最凶的一只吞掉最弱的一只，夺其毒性与道行——吞满三只成万毒蛊，吞满八只成蛊王，每蜕变一回吐出一份蛊毒。蛊虫精通三重时，原料格放迷魂花，开盅那夜一只金蚕蛊吃了它，炼成一对情蛊落进产物格。' },
  winejar: { name: '灵酒坛', icon: 'm_winejar', price: 200, power: 0, in: [2, 2], out: [2, 2],
             inputs: ['spirit_fruit', 'yeast'],
             desc: '两枚灵果+一块酒曲，封坛两夜酿成灵酒。不耗灵力。' },
  soulfurnace: { name: '炼魂炉', icon: 'm_soulfurnace', price: 700, power: 3, in: [3, 1], out: [2, 1], mod: [1, 1], feedStack: 10,
             inputs: ['soul_wisp', 'soul_grudge', 'live_soul', 'soul_pearl'],
             desc: '三缕游魂或一缕怨魂炼成一颗魂珠；一缕生魂配一颗魂珠炼成魂晶。模组槽放摄魂铃，每夜多炼一炉。料与产物同种叠放，一格至多十份。' },
  coffin:  { name: '炼尸棺', icon: 'm_coffin', price: 800, power: 3, in: [2, 2], out: [2, 3],
             inputs: ['corpse', 'soul_pearl', 'cult_corpse', 'soul_crystal'],
             desc: '一具尸身加一颗魂珠，封棺两夜炼成铁尸，并滴出一瓶尸毒；修士遗蜕加一块魂晶，炼成尸王。' },
  puppetbench: { name: '傀儡台', icon: 'm_puppetbench', price: 900, power: 4, in: [3, 1], out: [1, 3], mod: [1, 1],
             inputs: ['iron_ingot', 'soul_pearl'], overflow: true, feedStack: 10,
             desc: '模组槽放傀儡图谱，两锭玄铁、一颗魂珠造一具机关傀儡。傀儡同种叠放，一格至多十具。' },
  yaopot:  { name: '妖植盆', icon: 'm_yaopot', price: 350, power: 1, in: [2, 2], out: [3, 1],
             inputs: ['mihun_seed', 'vine_seed', 'bones', 'corpse'],
             desc: '迷魂花种两夜开花；噬血藤每夜吃一块腐骨（或一具尸身顶三夜），三夜结出血藤果。' },
  dihuo:   { name: '地火炉', icon: 'm_dihuo', price: 1200, power: 5, in: [4, 3], out: [2, 2], mod: [1, 1], modLabel: '阵符',
             inputs: ['iron_ore', 'iron_ingot', 'xuan_essence'], overflow: true, feedStack: 10,
             desc: '六块玄铁矿（或三锭玄铁）熬一块玄铁精，每夜两炉（阵符翻倍）。当夜闭关时，四块玄铁精炼成一根天阶神兵胚料。料与产物同种叠放，一格至多十份。' },
  pen:     { name: '灵兽圈', icon: 'm_pen', price: 450, power: 1, out: [4, 2], outLabel: '产物',
             stalls: 1, stallMax: 4, stallSize: 4, stallPrice: 180, feedStack: 10,
             inputs: ['broken_bowl', 'iron_ore', 'bones', 'waste_pill', 'spirit_fruit', 'beast_feed'],
             desc: '每个兽栏一行：左边四格放饲料（同种叠放，一格至多十份），右边四格养灵宠，一栏只养一种，饲料对口才吃得上；要多养就加盖兽栏（至多四栏）。噬金虫吞玄铁矿、破铜钵产灵砂，吞腐骨产灵兽饲料；寻宝鼠吃废丹、腐骨、灵果、灵兽饲料，夜里外出叼回东西。吃出来的东西落进产物格。' },
  fudesk:  { name: '符案', icon: 'm_fudesk', price: 300, power: 0, in: [3, 2], out: [3, 2], feedStack: 10,
             inputs: ['fu_paper', 'cinnabar', 'soul_wisp', 'bones', 'spirit_crystal', 'xian_talisman'],
             desc: '符纸+朱砂→金刚符；再加游魂→摄魂符，加腐骨→血纹护符；符箓二重加灵晶→聚火阵符；符箓三重加太清符→两张正派封印符。每夜画 1 + 符箓重数 张。料与产物同种叠放，一格至多十份。' },
  forgery: { name: '作伪台', icon: 'm_forgery', price: 500, power: 2, in: [3, 3], out: [4, 3], mod: [2, 2], modLabel: '样品',
             inputs: null,
             desc: '没放样品时，把输入格里的货“以次充好”——做旧上色，看着品质高出一截。模组格放一件赝品或真品当样品，可按会的仿造之法造出同款赝品（须通作伪之术）。每夜两件。' },
  puppet:  { name: '傀儡货摊', icon: 'm_puppet', price: 600, power: 1, in: [4, 3], inLabel: '货架',
             inputs: null,
             desc: '闭铺后由傀儡夜卖，货款存入钱匣，需手动取出。' },
};

const ARRAY_BASE_POWER = 6;
const CRYSTAL_CAP = 12;

const DIFFICULTIES = [
  { id: 'cozy',   name: '闲散', rent: 0.7, deed: 9000,  markup: 0.0,  sell: 1.1,  inspect: 0.6, desc: '租金低廉，货郎不加价，巡查稀少。' },
  { id: 'normal', name: '寻常', rent: 1.0, deed: 12000, markup: 0.15, sell: 1.0,  inspect: 1.0, desc: '血煞宗杂役区的日常。' },
  { id: 'hard',   name: '艰险', rent: 1.3, deed: 15000, markup: 0.25, sell: 0.92, inspect: 1.3, desc: '租金高涨，顾客精明，执法堂勤快。' },
  { id: 'doom',   name: '魔劫', rent: 1.6, deed: 18000, markup: 0.35, sell: 0.85, inspect: 1.6, desc: '一步踏错便万劫不复。' },
];

// 开局：machines 为初始设备，items 为 [id, 数量, 额外属性]
const STARTS = [
  { id: 'apprentice', name: '杂役学徒', tag: '推荐', stones: 320,
    desc: '老掌柜失踪前留给你的铺子。一座炼器炉，几样杂货，什么都能试试。',
    machines: ['furnace'],
    items: [['iron_ore', 4], ['scrap_sword', 2], ['herb_dew', 2], ['pill_qi', 1], ['demon_charm', 1], ['water', 2, { purity: 58 }]] },
  { id: 'water', name: '灵泉贩子', stones: 220,
    desc: '后院有口泉眼和一方洗灵池。把浊水洗成无垢灵泉，是最稳当的营生。',
    machines: ['spring', 'pool'],
    items: [['filter_sand', 6], ['water', 3, { purity: 52 }]] },
  { id: 'fence', name: '销赃客', stones: 380,
    desc: '道上都知道你收“来路不明”的货。赃物风头过得快，会一手抹印的功夫，手里还有两张正派封印符。执法堂盯着你。',
    perks: { fence: true, hidden: true }, rep: { mo: 10 }, heat: 15, tech: { erase: 1 },
    items: [['soul_bell', 1, { stolen: 3 }], ['sword_std', 1, { stolen: 2 }], ['xian_talisman', 1], ['seal_xian', 2]] },
  { id: 'alchemist', name: '丹房药童', stones: 160,
    desc: '从丹房偷师了几手。一座旧丹炉，一方药圃，还有几粒种子。',
    machines: ['danlu', 'herbbed'],
    items: [['herb_seed', 4], ['herb_dew', 2], ['herb_blood', 1]] },
  { id: 'gu', name: '养蛊人', stones: 160,
    desc: '南疆来的养蛊人。蛊盅里两只噬心蛊，妖族对你颇有微词。独门的蛊虫精通别处学不来：养蛊长本事，本事够了就能把蛊掺进吃食给人下——吃下去的人或听话、或被蛊噬成重伤；练到三重，还炼得出一生只认一人的情蛊。',
    machines: ['gupot'], rep: { yao: -8 }, perks: { gumaster: true }, tech: { gumaster: 1 },
    items: [['gu', 2, { growth: 30 }], ['bones', 6]] },
  { id: 'corpse', name: '炼尸匠', stones: 140,
    desc: '湘西赶尸人家出身，赶着赶着改了行：如今不送尸还乡，把尸身炼成铁尸、把游魂炼成魂珠。一口炼尸棺、一座炼魂炉，魔宗视你为奇才，凡人见你绕道走。',
    machines: ['coffin', 'soulfurnace'], rep: { mo: 8, ren: -10 },
    items: [['corpse', 1, { fresh: 6 }], ['soul_wisp', 3], ['soul_pearl', 1]] },
  { id: 'digger', name: '拾荒客', stones: 120, perks: { digger: true },
    desc: '常年在古战场和宗门废墟里刨食，眼尖手快：每回拾荒多翻两次。一座旧器鼎（炼器台）、一口破丹炉，专门把挖来的残器废丹重新祭炼——残器拿翻到的残剑、玄铁矿补，用不着炼器炉。阵眼里多嵌一块灵晶。',
    machines: ['forge', 'danlu'], crystals: 1,   // 炼器台加炼丹炉要 6 点灵力，正好吃满聚灵阵；多一块充满的灵晶垫着
    items: [['broken_relic', 2], ['waste_pill', 4], ['iron_ingot', 3]] },
  { id: 'tamer', name: '育兽师', stones: 180,
    desc: '一座两栏的灵兽圈，一栏寻宝鼠、一栏噬金虫，是你全部的家当。喂废料、喂腐骨，把它们养大：寻宝鼠夜里叼货回来，噬金虫吞铁吐灵砂、化腐骨为灵兽饲料，成年的两只凑一对还会添丁。',
    machines: ['pen'], tech: { beast: 1 },
    items: [['bones', 4], ['broken_bowl', 2]],
    into: [['pen', 'b0', 'treasure_rat', 2, { growth: 60 }], ['pen', 'b1', 'gold_bug', 2, { growth: 60 }]] },
  { id: 'talisman', name: '画符先生', stones: 200,
    desc: '落魄的符师，一张符案，一手好字。符纸朱砂便宜，画出来的符却是暴利。',
    machines: ['fudesk'], tech: { talisman: 1 },
    items: [['fu_paper', 8], ['cinnabar', 8], ['incense', 2]] },
  { id: 'smith', name: '炼器匠', stones: 260,
    desc: '炼器坊出来的匠人，一炉一台，一块器谱玉简：炉里炼玄铁，台上打飞剑。玄铁在你手里，能翻好几番。',
    machines: ['furnace', 'forge'], tech: { refine: 1 },
    items: [['iron_ore', 6], ['iron_ingot', 2]],
    into: [['forge', 'mod', 'jade_slip', 1, {}]] },
  { id: 'nothing', name: '一无所有', stones: 30,
    desc: '只剩一间空铺子和一座老旧聚灵阵。挑战向开局。',
    items: [] },
];

// 货郎常备货品：[id, 基础单价, 需要的魔宗声望]
const SUPPLY = [
  ['iron_ore', 13, -100], ['filter_sand', 6, -100], ['herb_seed', 5, -100], ['bones', 2, -100],
  ['yeast', 7, -100], ['spirit_fruit', 14, -100], ['gu_egg', 30, -100], ['spirit_crystal', 70, -100],
  ['mihun_seed', 10, -100], ['corpse', 30, 0], ['soul_wisp', 38, 5], ['vine_seed', 16, 5],
  ['lens2', 420, 0], ['lens3', 1050, 15], ['lens4', 2500, 30],
  ['fu_paper', 5, -100], ['cinnabar', 11, -100], ['jade_bottle', 12, -100], ['incense', 30, -100],
  ['treasure_rat', 95, -100], ['gold_bug', 135, 0],
  ['dan_fire', 100, 0], ['fire_disk', 180, 0], ['jade_slip', 300, 10], ['pill_recipe', 450, 25], ['puppet_scroll', 360, 20],
];

const UPGRADES = [
  { id: 'store1',  name: '扩建库房',   price: 350,  desc: '储物架扩为 10×6。' },
  { id: 'store2',  name: '再扩库房',   price: 900,  desc: '储物架扩为 12×7。', need: 'store1' },
  { id: 'display', name: '紫檀陈列柜', price: 500,  desc: '陈列柜扩为 6×4，能摆更多货揽客。' },
  { id: 'hidden',  name: '夹层暗格',   price: 600,  desc: '一个 2×3 暗格，竖着三格的长条货也藏得下；执法堂巡查时搜不到。' },
  { id: 'sign',    name: '鎏金招牌',   price: 700,  desc: '每日多来一位顾客。' },
  { id: 'hijack',  name: '私接灵脉',   price: 400,  desc: '每夜灵力 +6；但每夜有一成机会被察觉，执法堂关注 +10。' },
  { id: 'master',  name: '鉴宝心得',   price: 650,  desc: '鉴定委托酬金翻倍；说起真伪来更让人信服。' },
  { id: 'vein',    name: '灵石矿脉契约', price: 1200, desc: '包下一段灵石矿脉：每夜灵力 +10，每日清晨送来四块玄铁矿，聚灵泉眼多出一瓶水。' },
  { id: 'quiet',   name: '静室',       price: 450,  desc: '后院辟一间静室：每夜多恢复 20 点体力与精神。' },
];

// 市况：cats 为品类价格修正
const MARKET_EVENTS = [
  { text: '杂役区风平浪静。', cats: {} },
  { text: '外门小比将至，弟子们争购法器。', cats: { qi: 0.3 } },
  { text: '丹会开市，丹药行情看涨。', cats: { dan: 0.25 } },
  { text: '妖潮退去，妖材泛滥。', cats: { yao: -0.25 } },
  { text: '灵泉枯竭的流言四起，灵饮紧俏。', cats: { yin: 0.35 } },
  { text: '仙门围剿在即，执法堂加紧巡查。', cats: { fu: 0.2 }, heat: 1.6 },
  { text: '炼器坊缺料，灵材收价上涨。', cats: { cai: 0.25 } },
  { text: '鬼市来了外乡客，珍玩走俏。', cats: { wan: 0.3 } },
  { text: '万蛊谷有人收蛊。', cats: { gu: 0.4 } },
];

// 顾客出售的货品池：[id, 权重, 额外属性生成器标记]
const SELL_POOLS = {
  ren:  [['scrap_sword', 4], ['iron_ore', 4], ['broken_bowl', 3], ['herb_dew', 3], ['spirit_fruit', 3], ['water', 3],
         ['jade_pendant', 2], ['scroll_manual', 2], ['bones', 2], ['yeast', 2], ['herb_seed', 2], ['corpse', 1]],
  mo:   [['demon_charm', 4], ['soul_bell', 2], ['bone_flute', 2], ['sword_std', 3], ['pill_blood', 2], ['yao_core', 3],
         ['beast_hide', 2], ['bronze_mirror', 1], ['soul_banner', 1], ['gu', 2], ['iron_ingot', 2],
         ['soul_wisp', 3], ['soul_grudge', 1], ['corpse', 2], ['soul_pearl', 1], ['wangyou', 1]],
  xian: [['xian_sword', 2], ['xian_talisman', 4], ['xian_robe', 2], ['pill_qi', 3], ['pill_found', 3], ['jade_pendant', 2]],
  yao:  [['herb_blood', 3], ['herb_dew', 3], ['spirit_fruit', 3], ['spirit_crystal', 2], ['gu_egg', 2], ['iron_ore', 2],
         ['bronze_mirror', 1], ['mihun_flower', 2], ['mihun_seed', 1], ['vine_seed', 1], ['vine_fruit', 1]],
};

// 顾客想买的品类权重
const BUY_WANTS = {
  ren:  { yin: 4, dan: 3, cai: 3, za: 1, wan: 1, zhi: 1, chong: 0.5, xin: 0.5, ji: 0.6, ju: 0.4 },
  mo:   { qi: 4, dan: 4, yao: 3, fu: 2, gu: 2, cai: 1, hun: 2, shi: 2, yin: 2, xin: 0.8, ji: 0.6, ju: 1 },
  xian: { wan: 3, dan: 3, qi: 2, fu: 1, zhi: 1, yin: 3, xin: 1.2 },
  yao:  { yin: 6, cai: 2, gu: 1, zhi: 2, chong: 1, xin: 0.4 },
};

// 顾客识破谎言的基础能力：凡人好骗，仙门弟子见多识广
const SAVVY = { ren: 0.2, yao: 0.3, mo: 0.4, xian: 0.55 };

const FACTION_BUDGET = { ren: [40, 260], mo: [80, 900], xian: [150, 1500], yao: [40, 400] };

const PORTRAITS = {
  ren:  [['ren_cultivator', '落魄散修'], ['ren_merchant', '凡人行商'], ['ren_kid', '杂役少年']],
  xian: [['xian_defector', '游方剑客'], ['xian_spy', '蒙面女修']],
  mo:   [['mo_disciple', '外门弟子'], ['mo_senior', '内门师姐']],
  yao:  [['yao_fox', '狐妖'], ['yao_tiger', '虎妖'], ['yao_snake', '蛇妖']],
};


// 拾荒地点：loot 为 [id, 权重]，danger 为每次翻找的基础遇险率
// scrolls：拾荒时偶尔翻出你正缺的那一重秘籍（三四重），每找到一件东西有 SCROLL_FIND 的机会是它
const SCROLL_FIND = 0.03;
const LOCATIONS = [
  { id: 'ruins', name: '宗门废墟', bg: 'loc_ruins', tries: 9, find: 0.7, danger: 0.08,
    desc: '被血煞宗灭门的古宗遗址。残器、废丹、丹方残页埋在瓦砾下，偶尔还有没散尽的护山禁制。',
    loot: [['broken_relic', 8], ['waste_pill', 7], ['iron_ore', 3], ['scroll_manual', 2], ['spirit_crystal', 1.2], ['jade_pendant', 1],
           ['jade_slip', 0.4], ['puppet_scroll', 0.3], ['pill_recipe', 0.2], ['bronze_mirror', 0.5]],
    scrolls: ['refine', 'alchemy', 'talisman', 'water', 'forgery'],
    hazard: { text: '你触动了残存的护山禁制，被一道剑气削去半截衣袖，养伤花了些灵石。', cost: 25, cond: ['injured', 1], end: true } },
  { id: 'battlefield', name: '古战场', bg: 'loc_battlefield', tries: 8, find: 0.72, danger: 0.12,
    desc: '上古仙魔大战的遗址，残器与废丹埋在焦土下。如今战火重燃，新尸、怨魂一天比一天多——巡逻的仙门剑修也是。',
    loot: [['broken_relic', 7], ['waste_pill', 5], ['scrap_sword', 4], ['soul_wisp', 3], ['demon_charm', 2], ['pill_qi', 0.8], ['soul_grudge', 0.6], ['blood_essence', 0.8], ['xian_talisman', 0.4]],
    warLoot: [['corpse', 6], ['soul_wisp', 3], ['soul_grudge', 2], ['sword_std', 1.2], ['xian_talisman', 1], ['xian_sword', 0.25]],
    scrolls: ['soul', 'refine', 'talisman'],
    hazard: { text: '一道剑光从天而降，你连滚带爬逃回杂役区，背上留了一道血口。', cost: 35, heat: 4, cond: ['injured', 2], end: true } },
  { id: 'scrapyard', name: '炼器坊废料场', bg: 'loc_scrapyard', tries: 6, find: 0.7, danger: 0.06,
    desc: '废剑残甲堆成山，炼坏了的法器也往这儿扔。被看守发现会引来执法堂注意。',
    loot: [['scrap_sword', 8], ['iron_ore', 6], ['broken_relic', 4], ['broken_bowl', 3], ['iron_ingot', 2], ['sword_std', 1], ['fire_disk', 0.4], ['puppet_scroll', 0.2]],
    scrolls: ['refine', 'puppet'],
    hazard: { text: '看守提灯巡来，你狼狈翻墙而逃。', heat: 8, end: true } },
  { id: 'graveyard', name: '乱葬岗', bg: 'loc_graveyard', tries: 6, find: 0.65, danger: 0.1,
    desc: '白骨与鬼火之间偶有陪葬的老物件。尸气伤身。',
    loot: [['bones', 10], ['broken_bowl', 3], ['demon_charm', 3], ['jade_pendant', 1.5], ['soul_bell', 1], ['bone_flute', 1], ['scroll_manual', 1],
           ['corpse', 4], ['soul_wisp', 4], ['soul_grudge', 0.6]],
    scrolls: ['corpse', 'soul', 'erase'],
    hazard: { text: '尸气侵体，你咳着血回到铺子，买药花了些灵石。', cost: 15, cond: ['poisoned', 1], end: true } },
  { id: 'beastcave', name: '万魔窟外围', bg: 'loc_beastcave', tries: 5, find: 0.6, danger: 0.14,
    desc: '妖兽出没之地，妖材与灵草丰富。取走妖丹会被妖族记恨。',
    loot: [['herb_blood', 4], ['herb_dew', 4], ['beast_hide', 2], ['yao_core', 1.5], ['gu_egg', 2], ['spirit_crystal', 1.5], ['spirit_fruit', 3],
           ['mihun_seed', 2], ['vine_seed', 1.5], ['mihun_flower', 1]],
    scrolls: ['beast', 'plant', 'brew'],
    hazard: { text: '洞中巨眼睁开，一爪掀翻了你。养伤花了不少灵石。', cost: 20, cond: ['injured', 2], end: true } },
];

// 战事开启后才能去的地方（暂无，古战场常开）
const WAR_LOCATIONS = [];

const BASKET = [4, 3];
