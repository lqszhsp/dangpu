// 结局画像：按这一局的所作所为量出七样脾性，定个名号，再给下一局出主意
'use strict';

// 做得越多越高，越往上越难涨：做了 k 回约六成
const sat = (x, k) => 100 * (1 - Math.exp(-Math.max(0, x) / k));
// 两条路走通一条就算：好比两件事各有几成把握，至少成一件
const either = (a, b) => 100 - (100 - a) * (100 - b) / 100;

// 七样脾性，按蛛网图从正上方顺时针排；仁心与狠辣隔着半圈。
// 天天做的事按每日多少算，局长局短都能比；杀人这类一回就够分量的按总数算
function traitScores() {
  const st = S.stats, a = st.acts || {}, days = Math.max(1, S.day);
  const n = k => st[k] || 0, act = k => a[k] || 0;
  const eyed = Math.max(act('appraise'), st.appraisals) + act('inspect');
  const said = n('honest') + n('lies');
  const tech = Object.values(S.tech || {}).reduce((s, v) => s + v, 0);
  const heatMax = Math.max(n('heatMax'), S.heat), lens = Math.max(n('lensMax'), appraiseLevel());
  const list = [
    { id: 'trade', name: '商才', basis: `成交 ${st.sales} 笔 · 日均进账 ${Math.round(st.income / days)}`,
      v: 0.45 * sat(st.sales / days, 2) + 0.35 * sat(st.income / days, 150) + 0.2 * sat((act('haggle') + act('flatter') + act('talk')) / days, 1.5) },
    { id: 'kind', name: '仁心', basis: `善名 ${S.virtue}（${VIRTUE_NAME(S.virtue)}）· 实话 ${n('honest')}/${said}`,
      v: said ? 0.6 * S.virtue + 40 * n('honest') / said : S.virtue },
    { id: 'eye', name: '眼力', basis: `鉴定验货 ${eyed} 回 · ${LENS_NAMES[lens]}`,
      v: 0.6 * sat((eyed + act('probe') * 0.5) / days, 0.8) + 0.4 * lens / (LENS_NAMES.length - 1) * 100 },
    { id: 'craft', name: '匠心', basis: `设备 ${S.machines.length} 台 · 出货 ${n('made')} 件`,
      v: 0.55 * sat(n('made') / days, 1.5) + 0.25 * sat(S.machines.length, 4) + 0.2 * sat(tech, 5) },
    { id: 'cruel', name: '狠辣', basis: `人命 ${n('kills')} · 谎话 ${n('lies')} · 阴招 ${n('cruel') + act('soulmark')}`,
      v: either(sat(n('kills') * 4 + n('cruel') * 2 + act('soulmark') * 2, 8), sat((n('lies') + act('dispute') * 0.5 + act('command') * 0.5) / days, 0.6)) },
    { id: 'risk', name: '胆魄', basis: `翻找 ${act('dig')} 回 · 赃物禁物 ${n('hot')} 件 · 关注最高 ${heatMax}`,
      v: either(sat((act('dig') * 0.5 + act('market') * 1.5 + n('hot') * 0.6) / days, 1.2), heatMax * 0.8) },
    { id: 'power', name: '权势', basis: `${realmName()} · 势 ${playerPower()}${S.cliques.joined ? ` · 投在${CLIQUES[S.cliques.joined].head}门下` : ''}`,
      v: 0.45 * playerPower() + 0.45 * (S.cult.lv - 1) / (REALMS.length - 2) * 100 + (S.cliques.joined ? 10 : 0) },
  ];
  list.forEach(t => { t.v = Math.round(clamp(t.v, 0, 100)); });
  return list;
}

// 名号：最突出的一样；第二样也不弱、又挨得近，就看两样合起来像什么人
const ARCHETYPES = {
  trade: ['铁算盘', '一分一厘都记在账上，连自己这条命也算成了本钱。'],
  kind: ['活菩萨', '人人念你的好。可惜念好抵不了租子。'],
  eye: ['鉴宝痴', '照妖镜照遍了天下赝品，独独没照清这世道。'],
  craft: ['百工匠人', '工坊里的设备一夜没停过，当铺倒像是副业。'],
  cruel: ['黑心掌柜', '柜台底下压着的不是账本，是人命。'],
  risk: ['亡命徒', '乱葬岗比自家柜台还熟。'],
  power: ['地头蛇', '杂役区的风吹草动，都先过你的耳朵。'],
};
const PAIR_ARCHETYPES = {
  'cruel+trade': ['笑面奸商', '笑脸迎客，转身把赝品当真货卖了出去。街坊都说你厚道——说这话的人还没发现。'],
  'kind+trade': ['良心掌柜', '价钱公道，童叟无欺，赚的是辛苦钱。这世道不讲理，偏偏你讲。'],
  'eye+trade': ['金眼朝奉', '进门的货一眼估出几成水分，压价压得对方心服口服。'],
  'craft+trade': ['前店后坊', '夜里炉火不熄，白天柜台不闲，铺子成了一台吞灵石、吐灵石的机器。'],
  'risk+trade': ['投机客', '哪里有便宜就往哪里钻，赚得快，赔得也快。'],
  'power+trade': ['大掌柜', '生意做到这个份上，就不只是生意了。'],
  'cruel+kind': ['两面人', '白天施粥，夜里埋人。善名与人命都记在账上，各记各的。'],
  'cruel+risk': ['亡命魔修', '刀口舔血惯了，执法堂名册上你的名字越写越粗。'],
  'cruel+power': ['杂役区一霸', '没人敢欠你的账，也没人敢不还。'],
  'eye+risk': ['捡漏客', '乱葬岗里刨出宝贝，鬼市上一眼辨出真假，别人当废品的，到你手里成了宝。'],
  'eye+kind': ['老实鉴师', '真就是真，假就是假，说出口的话比照妖镜还准。可惜实话不值钱。'],
  'kind+power': ['一方善长', '杂役区的人遇事先来找你，你也真管——管到自己兜里一个子儿不剩。'],
  'craft+eye': ['巧手匠师', '自己炼的货自己验，赝品进不了你的门，也出不了你的炉。'],
  'craft+cruel': ['邪道炼师', '炉子里烧的是什么，最好别问。'],
};

function archetype(sc) {
  const [a, b] = sc.slice().sort((x, y) => y.v - x.v), st = S.stats, act = st.acts || {};
  const busy = (st.sales + Math.max(act.appraise || 0, st.appraisals) + (act.dig || 0) + (st.made || 0)) / Math.max(1, S.day);
  if (a.v < 25 || busy < 0.5) return { name: '庸庸碌碌', text: '来过，开过门，交过租。杂役区没人记得你。', top: a };
  const pair = b.v >= 40 && a.v - b.v <= 15 && PAIR_ARCHETYPES[[a.id, b.id].sort().join('+')];
  const [name, text] = pair || ARCHETYPES[a.id];
  return { name, text, top: a, also: !pair && b.v >= 40 ? b : null };
}

// 下一局：先说这局栽在哪，再补最弱的两样（善恶是你自己选的，狠辣不算短板），最后荐一个没走过的出身
const CAUSE_TIPS = {
  rent: st => `租子七日一涨，每期涨近三成${st.late ? `，这局欠租 ${st.late} 回` : ''}。把对口的货摆上陈列柜引客，收货压价、出货抬价；手头紧时宁可早几天把压箱底的货卖给货郎，也别等宽限期加罚。`,
  heat: st => `执法堂关注一度到 ${Math.max(st.heatMax || 0, S.heat)}。禁物收进夹层暗格，别摆上陈列柜；少和仙门做买卖；巡查上门时塞点灵石，比被搜出来便宜。`,
  death: () => '伤毒要了你的命。带伤别出门拾荒，翻找越多越险；备几粒能治伤毒的丹药，或去「人物」页找人求医。',
  lovegu: () => '情蛊种下的那一刻，她的命就是你的命。护好她：别让她卷进打斗、别让她带伤中毒没人管——或者，下回别把这条命交给别人。',
  deed: () => S.diff === DIFFICULTIES[DIFFICULTIES.length - 1].id
    ? '魔劫世道都让你熬出了头——只是铺契到手那天，你和刚来时一样一贫如洗。换个出身，看看别的活法。'
    : `铺契是到手了，灵石和货也一并抵了进去。下回试试更难的世道（${DIFFICULTIES[DIFFICULTIES.findIndex(d => d.id === S.diff) + 1].name}）。`,
};
const TRAIT_TIPS = {
  trade: '陈列柜决定来什么客人：看「陈列」页的顾客群体，摆他们要的货；交易盘上一次多谈几样，滞销货也能顺带出手。',
  kind: '如实相告、公道买卖、接济上门求助的人都涨善名。帮过的人记着你，极少时候，那份回报能救你的命。',
  eye: '收货前先验货、鉴定；鉴宝台换上更好的照妖镜，库房里的旧货会重新露馅。',
  craft: '工坊里添一台设备，夜里入定时自己出货；研读秘籍，出品更精。',
  risk: '夜里出门一趟：拾荒能翻出好货，鬼市开张那夜进货还不惹执法堂。',
  power: '投靠一个派系、和熟客把交情做深、服炼丹药冲境界，都涨势力——势大了，吃了亏的人只敢忍气吞声。',
};
const TRAIT_STARTS = {
  trade: ['apprentice', 'water'], kind: ['water', 'apprentice'], eye: ['fence', 'digger'], craft: ['smith', 'alchemist', 'talisman'],
  cruel: ['fence', 'corpse'], risk: ['digger', 'fence'], power: ['corpse', 'nothing'],
};

function nextTips(sc) {
  const tips = [];
  const cause = S.over.cause || (S.over.win ? 'deed' : 'death');
  tips.push({ head: S.over.win ? '下一步' : '栽在哪', text: CAUSE_TIPS[cause](S.stats) });
  const weak = sc.slice().sort((x, y) => x.v - y.v).filter(t => t.v < 40 && t.id !== 'cruel').slice(0, 2);
  weak.forEach(t => tips.push({ head: `补${t.name}`, text: TRAIT_TIPS[t.id] }));
  const want = (weak[0] || sc.slice().sort((x, y) => x.v - y.v)[0]).id;
  const start = TRAIT_STARTS[want].map(id => STARTS.find(s => s.id === id)).find(s => s && s.id !== S.start);
  if (start) tips.push({ head: '换个出身', text: `「${start.name}」：${start.desc}` });
  return tips;
}

// 家底走势：每夜结算时的灵石，再补上收场那一刻
function wealthSeries() {
  const pts = S.stats.days.map(d => ({ day: d.day, v: d.stones }));
  if (pts.length && pts[pts.length - 1].day === S.day) pts.pop();
  pts.push({ day: S.day, v: S.stones });
  return pts;
}
