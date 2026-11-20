// 门道：杂役区的人各自懂些攻略上的知识——丹师懂丹方，铁匠懂炉火，混混懂销赃，老人懂因果。
// 肯不肯告诉你，看世道（难度）、这条门道值多少（低 / 中 / 高，作恶的另算）、他对你的交情；
// 交情不够时，少数高级或作恶的门道肯卖，要价看他贪不贪、你们差多少交情；守规矩的人不卖害人的门道。
// 门道的内容由游戏数据现编：名字、配方、来路、规则都从代码里读，和攻略一样不会与程序对不上
'use strict';

const LORE_TIER = { low: '寻常', mid: '要紧', high: '压箱底' };
// 要多少交情才肯白说（好感），作恶的门道再加一截；难度越高人越嘴紧、要价越高
const LORE_NEED = { low: -9, mid: 25, high: 55 };
const LORE_EVIL_NEED = 20;
const LORE_PRICE = { low: 0, mid: 80, high: 220 };
const LORE_DIFF = { cozy: [-15, 0.7], normal: [0, 1], hard: [10, 1.3], doom: [20, 1.6] };

// 身份标签：从阵营、称谓、生平里认出这人是干哪行的
const LORE_TAGS = [
  ['medic', /医|郎中|药|丹|接生/], ['smith', /铁|铸|炼器|器|匠|锁/], ['talisman', /符|箓|纸|墨|阵/], ['necro', /尸|魂|葬|灯守|仵作|祭炼/],
  ['trader', /商|贩|账房|行商|货|米铺|米行|船|渡|脚夫|搬运/], ['shady', /骗|销赃|混混|癞|黑狗|鬼市|赌|乞丐|弃徒/],
  ['law', /执法|巡查|管事|执事|征|巡水|巡山|夜更/], ['cultivator', /弟子|剑|修|师兄|师姐|长老|护山|武修/],
  ['sage', /算|卦|僧|道士|老|祭|勘脉|传功|书生/], ['beast', /兽|驯|虫|灵契|羽使/], ['gu', /蛊/], ['farmer', /圃|植|采药|农|织|蚕|渔/],
  ['brew', /酒/],
];
function loreTags(p) {
  const t = new Set([p.faction]), text = `${p.title || ''}${p.bio || ''}`;
  for (const [k, re] of LORE_TAGS) if (re.test(text)) t.add(k);
  if (CAST[p.pid] && CAST[p.pid].healer) t.add('medic');
  if (p.official) t.add('law');
  return t;
}

// ───────────── 门道目录：由游戏数据现编 ─────────────

const loreN = id => ITEMS[id].name;
const loreList = ids => ids.map(loreN).join('、');
let LORE = null;

function buildLore() {
  const L = [];
  const add = (id, topic, tier, who, text, evil = false) => L.push({ id, topic, tier, who, text, evil });
  const has = (...ids) => ids.every(id => ITEMS[id]);

  // 拾荒：哪儿能翻到什么、险不险
  for (const l of LOCATIONS) {
    const top = l.loot.slice().sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
    const rare = l.loot.filter(([id, w]) => w <= 1.5 && !top.includes(id)).map(x => x[0]);
    const risky = l.danger >= 0.1;
    add(`scav_${l.id}`, '拾荒的去处', risky ? 'mid' : 'low', risky ? ['cultivator', 'hunter', 'shady', 'mo'] : ['ren', 'trader', 'farmer', 'shady'],
      `${l.name}多是${loreList(top)}${rare.length ? `，运气好能翻到${loreList(rare)}` : ''}；${risky ? '那地方凶险，' : ''}${l.hazard.text.replace(/。$/, '')}——带伤别去。`);
  }
  // 买货：货郎、鬼市、批发处
  add('buy_supply', '哪儿买得到', 'low', ['ren', 'trader'], `货郎天天换货，${loreList(SUPPLY.filter(s => s[2] <= -100).slice(0, 6).map(s => s[0]))}都常备；魔宗声望高了，他还肯卖${loreList(SUPPLY.filter(s => s[2] > -100).map(s => s[0]).slice(0, 4))}。`);
  for (const [k, d] of Object.entries(DEALERS)) {
    const evil = d.sells.some(([id]) => ITEMS[id].illicit || ITEMS[id].contra || ['live_soul', 'cult_corpse', 'corpse_poison', 'wangyou'].includes(id));
    add(`deal_${k}`, '哪儿买得到', evil ? 'mid' : 'low', k === 'ghost' ? ['shady', 'mo', 'necro'] : k === 'sect' ? ['mo', 'law', 'cultivator'] : ['ren', 'trader'],
      `${d.name}卖${loreList(d.sells.map(x => x[0]))}；收${loreList(d.buys.slice(0, 6))}这些。${k === 'ghost' ? '赶上鬼市夜去，货多，执法堂也不管。' : ''}`, evil && k === 'ghost');
  }
  // 功勋兑换：高阶材料
  for (const [f, items] of Object.entries(MERIT_SHOP)) {
    const top = items.slice().sort((a, b) => b[1] - a[1]).slice(0, 3);
    add(`merit_${f}`, '功勋换的东西', top[0][1] >= 6 ? 'high' : 'mid', [f, 'law', 'cultivator'],
      `替${FACTIONS[f].name}办事攒下功勋，能换${top.map(([id, c]) => `${loreN(id)}（${c} 点）`).join('、')}——这些东西外头有钱也买不着。`, ['live_soul', 'cult_corpse'].some(id => items.some(x => x[0] === id)));
  }
  // 配方：只写游戏里真有的（设备、材料都在）
  const R = (id, machine, use, out, tier, who, extra = '', evil = false) => {
    if (!MACHINES[machine] || !use.every(([x]) => ITEMS[x]) || !ITEMS[out]) return;
    add(`rx_${id}`, `${MACHINES[machine].name}的配方`, tier, who, `${MACHINES[machine].name}里放${use.map(([x, n]) => `${loreN(x)}${n > 1 ? `×${n}` : ''}`).join('、')}，${extra}能出${loreN(out)}。`, evil);
  };
  R('ingot', 'furnace', [['iron_ore', 2]], 'iron_ingot', 'low', ['smith', 'ren']);
  R('sword', 'forge', [['iron_ingot', 3]], 'sword_std', 'mid', ['smith', 'cultivator'], `模块槽插一枚${loreN('jade_slip')}，`);
  R('essence', 'dihuo', [['iron_ore', 6]], 'xuan_essence', 'mid', ['smith']);
  R('god_blank', 'dihuo', [['xuan_essence', 4]], 'god_blank', 'high', ['smith', 'sage'], '你闭关坐镇的那一夜，');
  R('demon_blade', 'forge', [['god_blank', 1], ['soul_crystal', 1]], 'demon_blade', 'high', ['smith', 'necro', 'mo'], `炼器到二重、插着${loreN('jade_slip')}，`, true);
  R('pill_qi', 'danlu', [['herb_dew', 2]], 'pill_qi', 'low', ['medic', 'farmer']);
  R('pill_blood', 'danlu', [['herb_blood', 1], ['yao_core', 1]], 'pill_blood', 'mid', ['medic', 'cultivator']);
  R('pill_found', 'danlu', [['herb_blood', 2], ['yao_core', 1], ['herb_dew', 1]], 'pill_found', 'high', ['medic', 'sage'], `模块槽插${loreN('pill_recipe')}，`);
  R('blood_infant', 'danlu', [['yao_core', 1], ['blood_essence', 2], ['herb_blood', 1]], 'blood_infant', 'high', ['medic', 'necro', 'mo'], '炼丹到二重，', true);
  R('wangyou', 'danlu', [['mihun_flower', 2]], 'wangyou', 'mid', ['shady', 'medic', 'yao'], '', true);
  R('pearl', 'soulfurnace', [['soul_wisp', 3]], 'soul_pearl', 'mid', ['necro', 'mo']);
  R('soul_crystal', 'soulfurnace', [['live_soul', 1], ['soul_pearl', 1]], 'soul_crystal', 'high', ['necro', 'sage'], '', true);
  R('iron_corpse', 'coffin', [['corpse', 1], ['soul_pearl', 1]], 'iron_corpse', 'mid', ['necro'], '封棺两夜，', true);
  R('corpse_king', 'coffin', [['cult_corpse', 1], ['soul_crystal', 1]], 'corpse_king', 'high', ['necro', 'mo'], '', true);
  R('puppet', 'puppetbench', [['iron_ingot', 2], ['soul_pearl', 1]], 'puppet_doll', 'mid', ['smith', 'necro'], `插着${loreN('puppet_scroll')}，`);
  R('fu', 'fudesk', [['fu_paper', 1], ['cinnabar', 1]], 'fu_jingang', 'low', ['talisman']);
  R('seal_xian', 'fudesk', [['fu_paper', 1], ['cinnabar', 1], ['xian_talisman', 1]], 'seal_xian', 'high', ['talisman', 'xian'], '符箓到三重，');
  R('wine', 'winejar', [['spirit_fruit', 2], ['yeast', 1]], 'spirit_wine', 'low', ['brew', 'farmer', 'trader'], '封坛两夜，');
  R('vine', 'yaopot', [['vine_seed', 1], ['bones', 3]], 'vine_fruit', 'mid', ['farmer', 'medic', 'yao'], '一夜喂一块，');
  if (has('water', 'filter_sand', 'spirit_sand')) add('rx_water', `${MACHINES.pool.name}的配方`, 'mid', ['trader', 'farmer', 'ren'],
    `${loreN('filter_sand')}洗灵水最多洗到九成九，要洗成琼浆玉露得用${loreN('spirit_sand')}——噬金虫吞玄铁矿、破铜钵就吐这个。`);
  // 治伤解毒
  add('cure', '伤毒怎么治', 'low', ['medic', 'ren', 'farmer'], Object.values(CONDS).map(c => `${c.name}用${loreList(c.cure)}`).join('；') + '。');
  const docs = Object.values(CAST).filter(d => d.healer);
  if (docs.length) add('healers', '伤毒怎么治', 'low', ['medic', 'ren', 'yao'], `${docs.map(d => d.name).join('、')}懂医术，见过一面就能上门求诊；交情越好诊金越少，得罪了就求不动。`);
  // 修为
  add('realm', '修为', 'mid', ['cultivator', 'sage', 'mo'], REALMS.filter(r => r.key).map(r => `${r.name}冲关要${loreN(r.key)}`).join('，') + '；闭关时冲关成算高，带伤中毒就低。');
  // 执法堂
  add('law_heat', '执法堂', 'mid', ['law', 'shady', 'mo'], `执法堂的关注涨满就锁人。禁物别摆陈列柜，${UPGRADES.find(u => u.id === 'hidden').name}和柜台巡查不搜；巡查来了什么也没查到，关注大降。`);
  add('law_bribe', '执法堂', 'high', ['law', 'shady'], '巡查能打点：清官要价高、收惯了的越来越好说话；给少了反倒觉得受辱。替执法堂盯着通缉犯，举报能领赏、关注也降。', true);
  // 作恶的门道
  add('evil_fake', '偏门生意', 'high', ['shady', 'smith', 'mo'], `做旧的手法是这样的……作伪台配上手艺能以次充好，读到${loreList(BOOKS.filter(b => b[1] === 'forgery' && b[6]).map(b => b[6][0]))}的仿法还能照样仿造；做工越精越少人看得穿。`, true);
  add('evil_lace', '偏门生意', 'high', ['shady', 'medic', 'gu'], `${loreList(Object.keys(ITEMS).filter(id => ITEMS[id].additive && ITEMS[id].additive !== 'tonic'))}都能掺进${loreList(['pill_qi', 'spirit_wine', 'water', 'zhuyan_dan'])}这类能吃能喝的货里，外表看不出；手法是这样的……学会了掺得干净，别人掺过的你一验就知道。对方越精、越不信你越容易识破。`, true);
  add('evil_erase', '偏门生意', 'mid', ['shady', 'mo'], '赃物上有原主的神识烙印，照妖镜够好才看得见，抹印术够重才抹得掉；抹不干净，原主会循迹找上门。', true);
  add('evil_seal', '偏门生意', 'mid', ['shady', 'talisman', 'xian'], `给货贴一道${loreN('seal_xian')}，看着像名门所出，身价翻倍。`, true);
  // 因果
  add('fate', '因果', 'mid', ['sage', 'law', 'yao'], `坏事是一场赌：每桩都有一半会败露，作得越多赌注越大，迟早赔不起。隔 ${FATE_FADE} 天不作恶、或多行善，旧账会淡。`);
  // 时令行情
  add('season', '行情', 'low', ['trader', 'farmer', 'ren'], SEASONS.map(s => `${s.name}季${s.text.replace(/。$/, '')}`).join('；') + '。');
  add('war', '行情', 'low', ['trader', 'cultivator', 'mo'], '仗打得越凶，丹药、法器、符箓、魂魄、尸傀越值钱，珍玩越不值钱；巡查也越勤。');
  return L;
}
const loreAll = () => LORE || (LORE = buildLore());

// 偏门门道听懂了就是手艺：加料的手法、以次充好的入门
const LORE_GRANTS = {
  evil_lace: () => { S.laceKnown = S.laceKnown || {}; Object.keys(LACE).filter(k => k !== 'tonic').forEach(k => { S.laceKnown[k] = 1; }); log('你学会了掺料的手法：往后掺得干净，别人掺过的货你也闻得出来。', 'gold'); },
  evil_fake: () => { if (!techLv('forgery')) { S.tech.forgery = 1; log('你学会了以次充好的入门手法（作伪一重）。', 'gold'); } },
};
const loreTip = id => loreAll().find(t => t.id === id);

// ───────────── 谁懂什么 ─────────────

// 第一次打听时定下来：身份对得上的门道里挑几条（真人多几条），之后不变
function loreKnown(p) {
  if (!p.lore) {
    const tags = loreTags(p), pool = loreAll().filter(t => t.who.some(w => tags.has(w)));
    const n = Math.min(pool.length, p.story || CAST[p.pid] ? 5 : 3);
    p.lore = pool.sort(() => Math.random() - 0.5).slice(0, n).map(t => t.id);
  }
  return p.lore.map(loreTip).filter(Boolean);
}
const loreLearned = id => !!(S.lore && S.lore[id]);

// ───────────── 肯不肯说 ─────────────

const loreShady = p => loreTags(p).has('shady');
// 要多少交情才肯白说
function loreNeed(p, t) { return LORE_NEED[t.tier] + (t.evil && !loreShady(p) ? LORE_EVIL_NEED : 0) + (LORE_DIFF[S.diff] || LORE_DIFF.normal)[0]; }

// 他的答复：tell 白说 / sell 要价 / refuse 不说（附原因）
function loreOffer(p, t) {
  if (loreLearned(t.id)) return { kind: 'known' };
  if (mood(p.aff) === 'hostile') return { kind: 'refuse', why: `${ta(p)}恨你，一个字也不肯说` };
  const need = loreNeed(p, t);
  if (p.aff >= need) return { kind: 'tell' };
  // 交情不够：只有压箱底的、作恶的门道才肯卖；守规矩的人不卖害人的门道
  if (!(t.tier === 'high' || t.evil)) return { kind: 'refuse', why: `交情不到（要${MOOD_NAME[mood(need)]}）` };
  if (t.evil && !loreShady(p) && (p.integrity || 0) > 0.6) return { kind: 'refuse', why: `${ta(p)}守规矩，这种事给钱也不说` };
  const gap = need - p.aff, mul = (LORE_DIFF[S.diff] || LORE_DIFF.normal)[1];
  const price = Math.round((LORE_PRICE[t.tier] || 60) * mul * (1 + gap / 100) * (0.7 + (p.greed != null ? p.greed : 0.5)) / 10) * 10;
  return { kind: 'sell', price: Math.max(20, price) };
}

// 打听：一人一天一回，费些精神
function askLore(p, id, pay = false) {
  const t = loreTip(id);
  if (!t || !loreKnown(p).includes(t)) return { err: `${ta(p)}不懂这个` };
  if (p.loreDay === S.day) return { err: `今天已经跟${ta(p)}打听过了` };
  const o = loreOffer(p, t);
  if (o.kind === 'known') return { err: '这个你已经知道了' };
  if (o.kind === 'refuse') return { err: o.why };
  if (o.kind === 'sell' && !pay) return { price: o.price };
  if (o.kind === 'sell' && S.stones < o.price) return { err: `${ta(p)}要 ${o.price} 灵石，你不够` };
  const err = exert('talk');
  if (err) return { err };
  p.loreDay = S.day;
  if (o.kind === 'sell') { spend(o.price, `向${p.name}买一条门道，付 ${o.price} 灵石。`); remember(p, '你出钱跟他买了一条门道。', 2); }
  else remember(p, '跟你说了些门道。', 1);
  S.lore = S.lore || {};
  S.lore[id] = { day: S.day, from: p.name };
  if (LORE_GRANTS[id]) LORE_GRANTS[id]();
  return { text: `${p.name}${o.kind === 'sell' ? `收了 ${o.price} 灵石，` : ''}压低声音说：“${t.text}”`, tip: t };
}
