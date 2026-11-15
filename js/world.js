// 天下大势：历法周期（周 / 季 / 年）、四方关系与战事、世事与行情
'use strict';

// ───────────── 历法 ─────────────
// 一周七日，一季十二周，一年四季（三百三十六日）

const WEEK_LEN = 7, SEASON_LEN = 84, YEAR_LEN = 336;

const WEEKDAYS = [
  { name: '发饷日', text: '宗门今日发饷，外门弟子腰包鼓了。', budget: { mo: 1.3 } },
  { name: '坊市日', text: '杂役区坊市开张，凡人进城赶集。', traffic: { ren: 1.5 }, cats: { cai: -0.1, yin: 0.05 } },
  { name: '炼器日', text: '炼器坊开炉，四处收购灵材。', cats: { cai: 0.15, qi: 0.05 } },
  { name: '点卯日', text: '执法堂例行点卯，巡查格外勤快。', inspect: 1.4 },
  { name: '出丹日', text: '丹房出丹，丹药略跌。', cats: { dan: -0.1 } },
  { name: '擂台日', text: '外门擂台开打，伤药与法器好卖。', cats: { dan: 0.1, qi: 0.1, zhi: 0.1 } },
  { name: '鬼市夜', text: '今夜鬼市开张，奇货可居，执法堂也懒得管。', cats: { wan: 0.2, hun: 0.15, gu: 0.1 }, traffic: { xian: 1.4, yao: 1.3 }, inspect: 0.7 },
];

const SEASONS = [
  { name: '春', growth: 1.4, rot: 1, cats: { cai: -0.12, zhi: -0.1, yin: 0.05 }, text: '春暖花开，灵草疯长，灵材价贱。' },
  { name: '夏', growth: 1.1, rot: 1.8, cats: { yin: 0.3, shi: -0.15, wan: -0.05 }, text: '酷暑难当，灵饮紧俏，尸身易腐。' },
  { name: '秋', growth: 0.9, rot: 1, cats: { yao: -0.2, yin: 0.1, hun: 0.2, gu: 0.1 }, text: '秋高妖肥，妖材泛滥；阴气渐重，魂魄走俏。' },
  { name: '冬', growth: 0.5, rot: 0.4, cats: { dan: 0.2, ju: 0.2, cai: 0.15, zhi: 0.3, yin: -0.1 }, text: '天寒地冻，丹药灵晶紧缺，妖族蛰伏。', traffic: { yao: 0.5 } },
];

// 年度节令：按一年中的第几日
const ANNUAL = [
  { from: 1, to: 7, name: '开山祭', text: '新年开山祭，宗门赏赐丰厚，人人手头宽裕。', budget: { mo: 1.2, ren: 1.1 }, cats: { fu: 0.2 } },
  { from: 211, to: 217, name: '血月祭', text: '一年一度血月祭，魂魄、尸身价格翻番。', cats: { hun: 0.6, shi: 0.3 } },
  { from: 330, to: 336, name: '宗门大比', text: '年终宗门大比，法器丹药被抢购一空。', cats: { qi: 0.45, dan: 0.25, fu: 0.2 } },
];

const NUMS = '一二三四五六七八九十';

// 1–99 的中文数字
function cn(n) {
  if (n <= 10) return n === 10 ? '十' : NUMS[n - 1];
  const t = Math.floor(n / 10), u = n % 10;
  return `${t > 1 ? NUMS[t - 1] : ''}十${u ? NUMS[u - 1] : ''}`;
}

function calendar(day = S.day) {
  const i = day - 1;
  const year = Math.floor(i / YEAR_LEN) + 1, doy = i % YEAR_LEN + 1;
  const season = Math.floor((doy - 1) / SEASON_LEN), week = Math.floor(((doy - 1) % SEASON_LEN) / WEEK_LEN);
  return {
    year, doy, season, week, weekday: i % WEEK_LEN,
    text: `${SEASONS[season].name} · 第${cn(week + 1)}周 · ${WEEKDAYS[i % WEEK_LEN].name}`,
    yearText: `血煞历三百${cn(year)}年`,
  };
}

const seasonOf = (day = S.day) => SEASONS[calendar(day).season];
const weekdayOf = (day = S.day) => WEEKDAYS[calendar(day).weekday];
const annualOf = (day = S.day) => { const d = calendar(day).doy; return ANNUAL.find(a => d >= a.from && d <= a.to) || null; };

// ───────────── 四方关系与战事 ─────────────

const RELATIONS = {
  xm: { name: '仙魔', w: 0.5, drift: 0.9, desc: '正魔之争，战事的根源' },
  my: { name: '魔妖', w: 0.2, drift: 0.55, desc: '魔宗猎妖取丹，妖族积怨' },
  xy: { name: '仙妖', w: 0.1, drift: 0.35, desc: '仙门以除妖为名扩张' },
  rm: { name: '人魔', w: 0.2, drift: 0.5, desc: '魔宗盘剥人族，民怨沸腾' },
};

const WAR_STAGES = [
  { at: 0,  name: '对峙', econ: 1,    supply: 1,    war: 0,    lux: 0,     inspect: 1,   levy: 0,   traffic: {},
    text: '四方暗流涌动，杂役区尚算太平。' },
  { at: 22, name: '摩擦', econ: 0.93, supply: 1.08, war: 0.25, lux: -0.08, inspect: 1.1, levy: 0,   traffic: { xian: 0.85 },
    text: '边境冲突不断，宗门开始囤积丹药法器。' },
  { at: 42, name: '开战', econ: 0.83, supply: 1.22, war: 0.7,  lux: -0.2,  inspect: 1.3, levy: 60,  traffic: { xian: 0.7, mo: 1.2, ren: 0.9 },
    text: '仙魔正式开战。战时捐每周一征，战备物资价格飞涨。' },
  { at: 62, name: '大战', econ: 0.72, supply: 1.4,  war: 1.3,  lux: -0.35, inspect: 1.5, levy: 120, traffic: { xian: 0.55, mo: 1.3, ren: 0.75 },
    text: '战火燎原，妖族卷入，人族被强征上阵。百业凋敝，唯有战争买卖兴旺。' },
  { at: 80, name: '浩劫', econ: 0.6,  supply: 1.65, war: 2.2,  lux: -0.5,  inspect: 1.8, levy: 200, traffic: { xian: 0.45, mo: 1.4, ren: 0.6, yao: 1.2 },
    text: '仙门大军压境，血煞宗危在旦夕。灵石不如一颗魂珠，太平年景的宝贝一文不值。' },
];

const STAGE_TEXT = [
  null,
  '仙门弟子在边境截杀了一支血煞宗商队，双方各有死伤。宗门开始囤积战备。',
  '血煞宗宗主当众斩杀仙门使者——仙魔正式开战！杂役区贴出告示：每周征收战时捐。',
  '前线战火蔓延，妖族趁乱袭扰，宗门强征人族上阵。坊市里的人一天比一天少。',
  '仙门大军兵临山门，护山大阵日夜轰鸣。杂役区人心惶惶，什么都在涨价，除了人命。',
];

function initWorld() {
  S.world = S.world || { rel: { xm: 16, my: 10, xy: 8, rm: 12 }, stage: 0, shocks: [], fuel: 0, news: [] };
}

function tension() {
  return Math.round(Object.entries(RELATIONS).reduce((s, [k, r]) => s + S.world.rel[k] * r.w, 0));
}

function stageOf(t = tension()) {
  let st = 0;
  WAR_STAGES.forEach((s, i) => { if (t >= s.at) st = i; });
  return st;
}

const warStage = () => WAR_STAGES[S.world.stage];
const DIFF_DRIFT = { cozy: 0.75, normal: 1, hard: 1.15, doom: 1.3 };

function worldNews(text, cls = '') {
  S.world.news.push({ d: S.day, t: text, cls });
  if (S.world.news.length > 30) S.world.news.shift();
}

function addShock(cats, days, text) { S.world.shocks.push({ cats, until: S.day + days, text }); }

function nudge(rel) { for (const k in rel) S.world.rel[k] = clamp(S.world.rel[k] + rel[k], 0, 100); }

// 战备买卖为战火添柴：卖给魔宗的战备物资会推高仙魔对立
function fuelWar(it, price) {
  const w = ITEMS[it.id].war || 0;
  if (w) S.world.fuel += w * price / 400;
}

// ───────────── 行情 ─────────────

function catShift(cat, day = S.day) {
  const parts = [S.market.cats[cat] || 0, weekdayOf(day).cats && weekdayOf(day).cats[cat] || 0,
    seasonOf(day).cats[cat] || 0, (annualOf(day) || { cats: {} }).cats[cat] || 0];
  S.world.shocks.forEach(sh => { if (sh.until >= day) parts.push(sh.cats[cat] || 0); });
  return parts.reduce((a, b) => a + b, 0);
}

function marketMul(cat) { return Math.max(0.2, 1 + catShift(cat)); }

// 单件货物的行情倍率：周期、世事、战争与奢侈
function priceMul(id) {
  const d = ITEMS[id], st = warStage();
  return Math.max(0.15, (1 + catShift(d.cat)) * (1 + st.war * (d.war || 0)) * (1 + (d.lux ? st.lux : 0)));
}

// 行情构成，供界面展示
function priceBreakdown(id) {
  const d = ITEMS[id], st = warStage(), rows = [];
  const add = (name, v) => { if (Math.abs(v) >= 0.005) rows.push([name, v]); };
  add('今日市况', S.market.cats[d.cat] || 0);
  add(weekdayOf().name, weekdayOf().cats && weekdayOf().cats[d.cat] || 0);
  add(`${seasonOf().name}季`, seasonOf().cats[d.cat] || 0);
  if (annualOf()) add(annualOf().name, annualOf().cats[d.cat] || 0);
  S.world.shocks.filter(sh => sh.until >= S.day && sh.cats[d.cat]).forEach(sh => add('世事', sh.cats[d.cat]));
  add(`战事·${st.name}`, st.war * (d.war || 0));
  if (d.lux) add('世道萧条', st.lux);
  return rows;
}

// 客流：周期与战事改变各族来客
function trafficMul(f) {
  return ((weekdayOf().traffic || {})[f] || 1) * ((seasonOf().traffic || {})[f] || 1) * (warStage().traffic[f] || 1)
    * (S.flags.foxBlessing && f === 'yao' ? 1.4 : 1);
}

// 预算：发饷、节令与战时经济
function budgetMul(f) {
  return ((weekdayOf().budget || {})[f] || 1) * (((annualOf() || {}).budget || {})[f] || 1) * warStage().econ;
}

// ───────────── 世事 ─────────────

const WORLD_EVENTS = [
  { min: 0, w: 3, rel: { xm: 3 }, shock: [{ cai: 0.2 }, 4], text: '仙门弟子在边境截杀了一支商队，灵材运不进来。' },
  { min: 0, w: 2, rel: { my: 4 }, shock: [{ yao: -0.2, zhi: 0.15 }, 5], text: '万魔窟妖兽暴动，猎妖队拖回成车的妖尸。' },
  { min: 0, w: 2, rel: { rm: 3 }, heat: 4, text: '矿上逃了一批人族苦役，执法堂挨家挨户搜捕。' },
  { min: 1, w: 2, rel: { xm: 4 }, shock: [{ fu: 0.25 }, 4], heat: 5, text: '执法堂擒获三名仙门细作，当众剥皮示众。人人自危。' },
  { min: 1, w: 2, requisition: true, text: '宗门下令征调杂役区战备物资，征调使明日挨家上门。' },
  { min: 1, w: 1.5, rel: { my: 3, xy: 2 }, shock: [{ gu: 0.3, yao: 0.15 }, 5], text: '南疆蛊师北上，说是要卖给魔宗一批战蛊。' },
  { min: 2, w: 2, rel: { xm: 5 }, shock: [{ dan: 0.3, zhi: 0.3 }, 5], text: '血煞宗大军出征，丹房日夜开炉也赶不上用。' },
  { min: 2, w: 2, rel: { xm: 6, rm: 3 }, shock: [{ dan: 0.4, zhi: 0.5, hun: 0.3 }, 4], text: '前线大败，伤兵一车车抬回山门。血藤果、回气丹一药难求。' },
  { min: 2, w: 1.5, rel: { my: 8, xy: -5 }, shock: [{ yao: 0.3 }, 6], text: '一支妖族倒向仙门，魔宗悬赏妖丹。' },
  { min: 2, w: 1, rel: { xm: -8 }, shock: [{ qi: -0.15, dan: -0.15 }, 5], text: '仙魔双方短暂停战交换俘虏。可谁都知道，这只是喘口气。' },
  { min: 2, w: 1.5, requisition: true, text: '前线吃紧，征调使又来了。' },
  { min: 2, w: 1.5, heat: 8, shock: [{ dan: 0.1 }, 4], text: '宗门颁下战时禁令：私售忘忧散者，斩。执法堂巡查翻了一倍。' },
  { min: 3, w: 2, rel: { rm: 8 }, shock: [{ cai: 0.3 }, 5], heat: 10, text: '人族苦役暴动，烧了半座矿场。执法堂杀红了眼。' },
  { min: 3, w: 1.5, rel: { rm: 5, xm: 4 }, shock: [{ hun: 0.6, shi: 0.4 }, 5], text: '血煞宗屠了一座投靠仙门的人族城池。乱葬岗堆满了新尸。' },
  { min: 3, w: 1.5, shock: [{ ju: 0.5, yin: 0.4 }, 6], text: '仙门截断了一条灵脉，灵晶、灵泉价格飞涨。' },
  { min: 4, w: 2, rel: { xm: 6 }, shock: [{ qi: 0.5, shi: 0.5, hun: 0.3 }, 5], text: '仙门大军压境，宗门不计代价收购铁尸、傀儡与法器。' },
  { min: 4, w: 1.5, requisition: true, text: '护山大阵告急，宗门强征一切战备物资！' },
];

// 每夜推演天下大势，返回给夜间报告的条目
function worldTick() {
  const out = [];
  const k = DIFF_DRIFT[S.diff] || 1;
  for (const [key, r] of Object.entries(RELATIONS)) S.world.rel[key] = clamp(S.world.rel[key] + r.drift * k + rnd(-0.4, 0.6), 0, 100);
  if (S.world.fuel) { nudge({ xm: Math.min(3, S.world.fuel) }); S.world.fuel = 0; }
  S.world.shocks = S.world.shocks.filter(sh => sh.until >= S.day + 1);

  if (Math.random() < 0.16 + S.world.stage * 0.03) {
    const pool = WORLD_EVENTS.filter(e => S.world.stage >= e.min);
    const ev = weighted(pool.map(e => [e, e.w]));
    if (ev.rel) nudge(ev.rel);
    if (ev.shock) addShock(ev.shock[0], ev.shock[1], ev.text);
    if (ev.heat) addHeat(ev.heat);
    if (ev.requisition) startOfficial('requisition', 1);
    worldNews(ev.text);
    out.push({ icon: 'ic_war', title: '天下大势', text: ev.text, cls: 'warn' });
  }

  const next = stageOf();
  if (next > S.world.stage) {
    S.world.stage = next;
    const t = STAGE_TEXT[next];
    worldNews(t, 'bad');
    out.push({ icon: 'ic_war', title: `战事·${WAR_STAGES[next].name}`, text: t, cls: 'bad' });
    rerollWarWishes();
  }
  return out;
}

// 周期性征收：开战后每周发饷日征战时捐；年终岁供
function periodicTick() {
  const cal = calendar(S.day + 1);
  if (cal.weekday === 0 && warStage().levy) startOfficial('levy', 1);
  if (cal.doy === YEAR_LEN) startOfficial('tribute', 1);
  if ((cal.doy - 1) % SEASON_LEN === 0 && S.day > 0) worldNews(`入${SEASONS[cal.season].name}。${SEASONS[cal.season].text}`);
}

// 下一个节令还有几日
function nextAnnual() {
  const doy = calendar().doy;
  const list = ANNUAL.map(a => ({ a, d: (a.from - doy + YEAR_LEN) % YEAR_LEN })).sort((x, y) => x.d - y.d);
  return list[0];
}

function levyAmount() { return Math.round(warStage().levy * diff().rent / 10) * 10; }
function tributeAmount() { return Math.round((150 + 120 * S.world.stage) * diff().rent / 10) * 10; }

// 今日的周期性说明（晨间展示）
function todayText() {
  const parts = [weekdayOf().text];
  const an = annualOf();
  if (an) parts.push(an.text);
  return parts.join('');
}
