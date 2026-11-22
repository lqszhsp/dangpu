// 游戏状态与规则：格子库存、顾客、议价、设备夜间结算、租金、巡查、拾荒
'use strict';

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// pairs: [[key, weight], ...] 或 {key: weight}
function weighted(pairs) {
  if (!Array.isArray(pairs)) pairs = Object.entries(pairs);
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [k, w] of pairs) { if ((r -= w) <= 0) return k; }
  return pairs[pairs.length - 1][0];
}

let S = null;
const SAVE_KEY = 'mmdp-save-v1';

function diff() { return DIFFICULTIES.find(d => d.id === S.diff); }
function log(text, cls = '') { S.log.push({ day: S.day, text, cls }); if (S.log.length > 80) S.log.shift(); }

// ───────────── 开局 ─────────────

function newGame(diffId, startId) {
  const start = STARTS.find(s => s.id === startId);
  S = {
    diff: diffId, start: startId, day: 1, phase: 'morning',
    stones: start.stones,
    rep: Object.assign({ ren: 0, xian: 0, mo: 5, yao: 0 }, start.rep),
    heat: start.heat || 0,
    perks: Object.assign({}, start.perks),
    upgrades: {},
    uid: 1, nextMid: 1,
    items: {}, grids: {}, machines: [],
    rentIndex: 0, rentDue: 7, grace: 0, rentOwed: 0,
    market: MARKET_EVENTS[0], supply: [],
    queue: [], customer: null, scavenged: false,
    stats: { sales: 0, income: 0, spent: 0, bestSale: null, bestFlip: null, appraisals: 0, inspections: 0, days: [] },
    today: { income: 0, expense: 0 },
    report: null, over: null,
    grudges: [],
    log: [],
  };
  initPeople();
  initWorld();
  S.grids.store = { w: 8, h: 5 };
  S.grids.display = { w: 5, h: 3 };
  S.grids.floor = { w: FLOOR_SIZE[0], h: FLOOR_SIZE[1] };
  S.grids.counter = { w: 3, h: 3 };
  S.grids.power = { w: 3, h: 1 };
  if (S.perks.hidden) { S.upgrades.hidden = true; S.grids.hidden = { w: HIDDEN_SIZE[0], h: HIDDEN_SIZE[1] }; }
  (start.machines || []).forEach(addMachine);
  start.items.forEach(([id, n, extra]) => {
    for (let i = 0; i < n; i++) autoPlace(makeItem(id, Object.assign({}, extra)));
  });
  // 开局就放进设备里的东西：[设备, 格子, 物品, 数量, 额外属性]
  (start.into || []).forEach(([type, slot, id, n, extra]) => {
    const m = S.machines.find(x => x.type === type);
    ensureStall(m, slot);
    for (let i = 0; i < n; i++) { const it = makeItem(id, Object.assign({}, extra)); if (!autoPlace(it, [gridOf(m, slot)])) autoPlace(it); }
  });
  autoPlace(makeItem('spirit_crystal', { charge: 6 }), ['power']);
  for (let i = 0; i < (start.crystals || 0); i++) autoPlace(makeItem('spirit_crystal', { charge: CRYSTAL_CAP }), ['power']);
  initForgery();
  initVitality();
  initMarket();
  initTrade();
  initDao();
  initPolitics();
  initKarma(); initFate();
  initConditions();
  Object.assign(S.tech, start.tech || {});
  rollMarket();
  initStories();
  log(`你接手了血煞宗杂役区的一间当铺。第一笔租金 ${rentAmount()} 灵石，七日后到期。`, 'gold');
  return S;
}

function save() { if (S && !S.over) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
function load() {
  S = JSON.parse(localStorage.getItem(SAVE_KEY));
  S.grudges = S.grudges || [];
  initPeople();
  initWorld();
  initForgery();
  initVitality();
  initMarket();
  initTrade();
  initDao();
  initPolitics();
  initKarma(); initFate();
  initConditions();
  pruneUnknownItems();
  S.machines.filter(m => MACHINES[m.type].stalls).forEach(migratePen);
  S.machines.filter(m => MACHINES[m.type].pot).forEach(migrateGupot);
  S.machines.forEach(growGrids);
  reshapeGrid('floor', FLOOR_SIZE); reshapeGrid('hidden', HIDDEN_SIZE);
  // 旧存档的养蛊人：补上独门的蛊虫精通
  if (S.start === 'gu' && !S.perks.gumaster) { S.perks.gumaster = true; S.tech.gumaster = Math.max(1, S.tech.gumaster || 0); }
  // 旧存档里掺了料的货都是你自己掺的（那时市面上还没有别人掺好的）
  Object.values(S.items).forEach(it => { if (it.laced && !it.lacedBy && !it.lacedSeen) it.lacedBy = 'me'; });
  // 旧存档里不懂蛊也能掺蛊、掺了就叫人受控：那不是蛊，作数的只有养蛊人亲手下的
  Object.values(S.people).forEach(p => { if (p.controlled && p.controlled.by !== 'gu') p.controlled = null; });
  if (!Object.keys(S.story).length) initStories();
  return S;
}
function clearSave() { localStorage.removeItem(SAVE_KEY); }

// ───────────── 物品 ─────────────

function makeItem(id, extra = {}) {
  const it = Object.assign({ uid: S.uid++, id, q: rint(25, 80), pos: null }, extra);
  if (id === 'water' && it.purity == null) it.purity = rint(40, 68);
  if (id === 'gu') {
    if (it.growth == null) it.growth = rint(0, 40);
    if (it.tox == null) it.tox = rint(10, 45);
  }
  if ((id === 'gu_egg' || id === 'gu_venom') && it.tox == null) it.tox = rint(10, 45);
  if (id === 'spirit_crystal' && it.charge == null) it.charge = rint(0, 5);
  if (id === 'corpse' && it.fresh == null) it.fresh = rint(3, 6);
  const kind = ITEMS[id].appraise;
  if (it.fake && !it.grade) it.grade = rollGrade();
  if (kind && !it.feats) Object.assign(it, rollFeats(kind, !!it.fake, it.grade || 1));
  S.items[it.uid] = it;
  return it;
}

function destroyItem(it) { delete S.items[it.uid]; }

// 蛊的道行：幼蛊长满化为金蚕蛊；封盅相食，吞满三只成万毒蛊、吞满八只成蛊王（吞的若也吞过，连它的一并算上）
const GU_STAGES = [
  { name: '噬心蛊', icon: 'gu_young', eat: 0 },
  { name: '金蚕蛊', icon: 'gu_gold', eat: 0 },
  { name: '万毒蛊', icon: 'gu_wandu', eat: 3 },
  { name: '蛊王', icon: 'gu_king', eat: 8 },
];
const guStage = it => it.growth < 100 ? 0 : (it.eat || 0) >= GU_STAGES[3].eat ? 3 : (it.eat || 0) >= GU_STAGES[2].eat ? 2 : 1;

function itemName(it) {
  if (it.id === 'intel') return it.info ? (intelExpired(it) ? `过时的${it.info.title}` : it.info.title) : '密报';
  if (it.id === 'water') return (it.bottled ? '瓶装' : '') + waterTier(it.purity);
  if (it.id === 'gu') return GU_STAGES[guStage(it)].name;
  return ITEMS[it.id].name;
}

function itemIcon(it) {
  if (it.id === 'water') return it.purity >= 99.9 ? 'water_jade' : it.purity >= 99 ? 'water_pure' : it.purity >= 80 ? 'water_clear' : 'water_murky';
  if (it.id === 'gu') return GU_STAGES[guStage(it)].icon;
  const base = ITEMS[it.id].icon || it.id, v = typeof itemVariant === 'function' ? itemVariant(it) : null;
  return v ? `${base}~${v}` : base;
}

function qualityName(q) { return QUALITY_TIERS.find(t => q >= t[0])[1]; }
// 没有品相之分的货（货品册里 noTier 的也加进来）
const NO_QUALITY = new Set(['water', 'gu', 'gu_egg', 'gu_venom', 'spirit_crystal', 'intel']);
function hasQuality(it) { return !NO_QUALITY.has(it.id); }


// 物品“看上去”的价值：赝品在识破前也按真品估
// 以次充好：sq 为做出来的表面品质，q 为真实品质
const shownQ = it => it.sq != null ? it.sq : it.q;
const isDressed = it => it.sq != null && it.sq > it.q;
const isFlawed = it => !!it.fake || isDressed(it) || !!it.sealed;

function rollGrade() { return +weighted([[1, 45], [2, 35], [3, 15], [4, 5]]); }

function dressUp(it, grade) {
  it.sq = Math.min(95, it.q + 12 + 8 * grade + rint(0, 8));
  it.grade = grade;
}

// 玩家是否知道这件货有问题
function knownFlaw(it) {
  if (it.forged) return true;
  if (it.fake) return !!(it.revealed || it.verdict === 'fake');
  return isDressed(it) && (it.seen || 0) >= it.grade;
}

// 赝品吃下去是什么：照样仿造的头一味料（假筑基丹里裹着的是回气丹）；真货、以次充好的就是它自己（药力看真实品质）
const bodyOf = it => it.fake && COUNTERFEITS[it.id] ? { id: COUNTERFEITS[it.id].use[0][0], q: it.q != null ? it.q : 50 } : it;
// 吃出来是假的：药力只有里头那味的份
function tasteFake(it) {
  if (it.fake && !knownFlaw(it) && bodyOf(it) !== it) log(`药力只有${ITEMS[bodyOf(it).id].name}那点——这${ITEMS[it.id].name}是假的。`, 'loss');
}

// 按某个品质估值
function valueAtQ(it, q) { return Math.round(ITEMS[it.id].base * (0.6 + q / 125)); }

// 贴了正派封印的，看着像名门所出
function claimedValue(it) { return Math.round(rawValue(it) * (it.sealed ? 2 : 1)); }

function rawValue(it) {
  const d = ITEMS[it.id];
  if (it.id === 'water') return Math.round(waterValue(it.purity) * bottleMul(it));
  if (it.id === 'gu') return Math.round([30 + it.growth * 1.2 + it.tox * 1.2, 260 + it.tox * 3, 560 + it.tox * 5, 1300 + it.tox * 9][guStage(it)]);
  if (it.id === 'gu_egg') return Math.round(d.base + it.tox * 0.4);
  if (it.id === 'gu_venom') return Math.round(d.base + it.tox);
  if (it.id === 'spirit_crystal') return d.base + (it.charge || 0) * 2;
  if (it.id === 'intel') return intelValue(it);
  return valueAtQ(it, shownQ(it));
}

function trueValue(it) { return it.fake ? fakeValue(it) : isDressed(it) ? valueAtQ(it, it.q) : rawValue(it); }

// 实话实说时的卖价：赝品有人买去转手骗人，以次充好按真品质
function honestValue(it) { return it.fake ? fakeValue(it) * 3 : Math.round(valueAtQ(it, it.q) * 1.1); }

// 买去送礼的高仿：做工越精，越肯出钱，但总比真货便宜得多
function giftFakeValue(it) { return Math.round(claimedValue(it) * (0.12 + 0.08 * (it.grade || 1))); }

// 玩家所知的估值：被识破或被玩家判为赝品的，按赝品价估
function fakeValue(it) { return Math.max(1, Math.round(ITEMS[it.id].base * 0.06)); }
function knownValue(it) {
  if (it.fake) return knownFlaw(it) ? fakeValue(it) : claimedValue(it);
  return knownFlaw(it) ? trueValue(it) : claimedValue(it);
}


// ───────────── 格子 ─────────────

function itemsIn(gid) { return Object.values(S.items).filter(it => it.pos && it.pos.g === gid); }

function machineOfGrid(gid) {
  const m = /^m(\d+):(\w+)$/.exec(gid);
  return m ? { m: S.machines.find(x => x.mid === +m[1]), slot: m[2] } : null;
}

// 返回 null 表示可放，否则返回原因
function rejectReason(gid, it) {
  if (gid === 'counter') return '柜台上是顾客的东西';
  if (gid === 'hand') return '手上只拿铺里放不下的货';
  if (gid === 'tray' && !tradeOpen()) return '有客人上门谈买卖时，才把货摆上货盘';
  if (gid === 'power') return it.id === 'spirit_crystal' ? null : '阵眼只能嵌入灵晶';
  if (gid === 'tool') return ITEMS[it.id].tool ? null : '鉴宝台只放鉴定的器物';
  const mg = machineOfGrid(gid);
  if (!mg) return null;
  const def = MACHINES[mg.m.type];
  if (mg.slot === 'mod') {
    if (mg.m.type === 'forgery') return COUNTERFEITS[it.id] ? null : '只有能仿造的东西才能当样品';
    return modAccepts(it, mg.m.type) ? null : '不是这台设备的模组';
  }
  if (/^[fb]\d+$/.test(mg.slot)) return stallReject(mg.m, mg.slot, it);
  if (mg.slot === 'in') return !def.inputs || def.inputs.includes(it.id) ? null : `${def.name}用不上这个`;
  if (mg.slot === 'pot') return def.habitat.includes(it.id) ? null : `${def.potLabel}格只养${def.habitat.map(id => ITEMS[id].name).join('、')}`;
  if (mg.slot === 'out') return '产出格只能取出';
  return null;
}

// 叠放格（兽栏的饲料、蛊盅的原料，炉台的料与产物）：同种的货叠在一处，一处至多 feedStack 份。
// 叠着的每一份仍是单独的一件货，品质、毒性各记各的——吃掉的是哪份、取出来的是哪份，都原样还原。
// 功法、模组让一夜多出几炉，料和产物却不多占格子：手机竖屏摆得下，一夜的料也喂得满
function stackCap(gid) {
  const mg = machineOfGrid(gid);
  return mg && MACHINES[mg.m.type].feedStack && /^(f\d+|in|out)$/.test(mg.slot) ? MACHINES[mg.m.type].feedStack : 0;
}
const stackOf = it => it.pos && stackCap(it.pos.g)
  ? itemsIn(it.pos.g).filter(o => o.id === it.id && o.pos.x === it.pos.x && o.pos.y === it.pos.y) : [it];

function fits(gid, it, x, y) {
  const g = S.grids[gid], d = ITEMS[it.id];
  if (!g || x < 0 || y < 0 || x + d.w > g.w || y + d.h > g.h) return false;
  const cap = stackCap(gid);
  let same = 0;
  return itemsIn(gid).every(o => {
    if (o.uid === it.uid) return true;
    const od = ITEMS[o.id];
    if (x >= o.pos.x + od.w || x + d.w <= o.pos.x || y >= o.pos.y + od.h || y + d.h <= o.pos.y) return true;
    return cap && o.id === it.id && o.pos.x === x && o.pos.y === y && ++same < cap;
  });
}

function findSpot(gid, it) {
  const g = S.grids[gid];
  if (!g) return null;
  // 饲料格先叠到已有的同种那一摞上，叠满了才另占一格
  const pile = stackCap(gid) && itemsIn(gid).find(o => o.id === it.id && o.uid !== it.uid && fits(gid, it, o.pos.x, o.pos.y));
  if (pile) return { x: pile.pos.x, y: pile.pos.y };
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (fits(gid, it, x, y)) return { x, y };
  return null;
}

function placeItem(it, gid, x, y) { it.pos = { g: gid, x, y }; }

function autoPlace(it, gids = ['store', 'floor']) {
  for (const gid of gids) {
    const p = findSpot(gid, it);
    if (p) { placeItem(it, gid, p.x, p.y); return gid; }
  }
  return null;
}

function canAutoPlace(it, gids = ['store', 'floor']) { return gids.some(g => findSpot(g, it)); }

// 整理：库房与地面上的货（连同 extra）大件先摆、尽量收进库房；摆不下、或白白多堆到地上（夜里遭贼），就原样不动
function tidy(extra = []) {
  const list = itemsIn('store').concat(itemsIn('floor'), extra);
  const saved = list.map(it => it.pos), area = it => ITEMS[it.id].w * ITEMS[it.id].h;
  const onFloor = () => itemsIn('floor').reduce((s, it) => s + area(it), 0), floor0 = onFloor();
  list.forEach(it => { it.pos = null; });
  const ok = list.slice().sort((a, b) => area(b) - area(a) || ITEMS[b.id].h - ITEMS[a.id].h).every(it => autoPlace(it))
    && (extra.length > 0 || onFloor() <= floor0);
  if (!ok) list.forEach((it, i) => { it.pos = saved[i]; });
  return ok;
}

// 收进铺里：放不下先整理，还放不下就拿在手上，等你腾地方
function stow(it) {
  if (autoPlace(it) || tidy([it])) return it.pos.g;
  it.pos = { g: 'hand', x: 0, y: 0 };
  layoutHand();
  log(`铺里堆满了，${itemName(it)}只好先拿在手上。`, 'loss');
  return 'hand';
}

// 手上的货排紧：一件挨一件，排满库房那么宽就换一行；手上空了就收起这一格
function layoutHand() {
  const list = itemsIn('hand');
  if (!list.length) { delete S.grids.hand; return; }
  const cap = Math.max(S.grids.store.w, ...list.map(it => ITEMS[it.id].w));
  let x = 0, y = 0, row = 0, w = 0;
  list.forEach(it => {
    const d = ITEMS[it.id];
    if (x + d.w > cap) { y += row; x = row = 0; }
    placeItem(it, 'hand', x, y);
    x += d.w; row = Math.max(row, d.h); w = Math.max(w, x);
  });
  S.grids.hand = { w, h: y + row };
}

const handItems = () => itemsIn('hand');

function resizeGrid(gid, w, h) { S.grids[gid].w = w; S.grids[gid].h = h; }

// 地上与暗格都要三格高：竖着三格的飞剑、铁尸、古琴才放得下（没有比两格更宽的货，所以两格宽就够）。面积与从前一样
const FLOOR_SIZE = [3, 4], HIDDEN_SIZE = [2, 3];
// 旧存档：地上 6×2、暗格 3×2 → 换成新的形状，货重新码一遍（大件先放）。
// 地上码不下的收进库房；暗格码不下就把暗格放宽到 3×3，原样留着——藏起来的东西不能被翻到明处
function reshapeGrid(gid, [w, h]) {
  const g = S.grids[gid];
  if (!g || (g.w === w && g.h === h) || g.h >= h) return;
  const list = itemsIn(gid), saved = list.map(it => it.pos), area = it => ITEMS[it.id].w * ITEMS[it.id].h;
  const old = { w: g.w, h: g.h };
  list.forEach(it => { it.pos = null; });
  S.grids[gid] = { w, h };
  const left = list.slice().sort((a, b) => area(b) - area(a) || ITEMS[b.id].h - ITEMS[a.id].h).filter(it => !autoPlace(it, [gid]));
  if (!left.length) return;
  if (gid === 'hidden') {
    S.grids[gid] = { w: Math.max(old.w, w), h: Math.max(old.h, h) };
    list.forEach((it, i) => { it.pos = saved[i]; });
    return;
  }
  left.forEach(stow);
}

// ───────────── 设备 ─────────────

function addMachine(type) {
  const def = MACHINES[type];
  const m = { mid: S.nextMid++, type, on: true, brew: 0, cash: 0 };
  ['in', 'pot', 'out', 'mod'].forEach(slot => {
    if (def[slot]) S.grids[`m${m.mid}:${slot}`] = { w: def[slot][0], h: def[slot][1] };
  });
  for (let i = 0; i < (def.stalls || 0); i++) addStall(m);
  S.machines.push(m);
  return m;
}

const gridOf = (m, slot) => `m${m.mid}:${slot}`;
// 旧存档：设备的格子后来加大了（作伪台放得下长条的货、样品格放得下铜镜），照新的尺寸撑开；只撑大不缩小，格子里的货不动
function growGrids(m) {
  const def = MACHINES[m.type];
  ['in', 'pot', 'out', 'mod'].forEach(slot => {
    const g = S.grids[gridOf(m, slot)];
    if (g && def[slot]) { g.w = Math.max(g.w, def[slot][0]); g.h = Math.max(g.h, def[slot][1]); }
  });
}
// 一台设备的全部格子（含灵兽圈的各栏）
const machineGridIds = m => Object.keys(S.grids).filter(g => g.startsWith(`m${m.mid}:`));
const countIn = (list, id) => list.filter(it => it.id === id).length;
const hasMod = (m, id) => itemsIn(gridOf(m, 'mod')).some(it => it.id === id);
const avgQ = list => Math.round(list.reduce((s, it) => s + it.q, 0) / list.length);

function takeItems(list, id, n) {
  const taken = list.filter(it => it.id === id).slice(0, n);
  taken.forEach(it => { destroyItem(it); list.splice(list.indexOf(it), 1); });
  return taken;
}

// 把产物放进产出格；允许溢出的设备会落到地上
function output(m, it) {
  const def = MACHINES[m.type];
  if (autoPlace(it, [gridOf(m, 'out')])) return 'out';
  if (def.overflow && autoPlace(it, ['floor'])) return 'floor';
  // 产出格、地面都放不下（长条的飞剑、魔剑溢不到地上）：搬进库房，不能白白没了
  log(`${def.name}的产出格放不下${itemName(it)}，搬进了库房。`, 'warn');
  return stow(it);
}

function outputHasRoom(m, id) {
  const probe = { uid: -1, id };
  return !!findSpot(gridOf(m, 'out'), probe) || (MACHINES[m.type].overflow && !!findSpot('floor', probe));
}

function danluRecipe(m, inputs) {
  if (techLv('alchemy') >= 2 && countIn(inputs, 'yao_core') >= 1 && countIn(inputs, 'blood_essence') >= 2 && countIn(inputs, 'herb_blood') >= 1)
    return { out: 'blood_infant', use: [['yao_core', 1], ['blood_essence', 2], ['herb_blood', 1]] };
  if (hasMod(m, 'pill_recipe') && countIn(inputs, 'herb_blood') >= 2 && countIn(inputs, 'yao_core') >= 1 && countIn(inputs, 'herb_dew') >= 1)
    return { out: 'pill_found', use: [['herb_blood', 2], ['yao_core', 1], ['herb_dew', 1]] };
  if (countIn(inputs, 'herb_blood') >= 1 && countIn(inputs, 'yao_core') >= 1)
    return { out: 'pill_blood', use: [['herb_blood', 1], ['yao_core', 1]] };
  if (countIn(inputs, 'mihun_flower') >= 2) return { out: 'wangyou', use: [['mihun_flower', 2]] };
  if (countIn(inputs, 'herb_dew') >= 2) return { out: 'pill_qi', use: [['herb_dew', 2]] };
  return null;
}

// 夜间是否有活可干：{ ok, msg }。ok=false 时不消耗灵力
// 魔剑：神兵胚料＋魂晶，须炼器二重
const bladeReady = inputs => techLv('refine') >= 2 && countIn(inputs, 'god_blank') >= 1 && countIn(inputs, 'soul_crystal') >= 1;

function machineCheck(m) {
  const def = MACHINES[m.type];
  if (!m.on) return { ok: false, msg: '已停用' };
  const inputs = def.in ? itemsIn(gridOf(m, 'in')) : [];
  const custom = customCheck(m, inputs);
  if (custom) return custom;
  switch (m.type) {
    case 'furnace':
      if (!inputs.some(it => it.id === 'scrap_sword' || it.id === 'broken_relic') && countIn(inputs, 'iron_ore') < 2) return { ok: false, msg: '缺原料：两块玄铁矿、一柄残剑或一件残破法器' };
      if (!outputHasRoom(m, 'iron_ingot')) return { ok: false, msg: '产出格与地面皆满' };
      return { ok: true, msg: `可炼 ${(hasMod(m, 'fire_disk') ? 4 : 2) * (hasBoostFu(m) ? 2 : 1)} 炉` };
    case 'forge':
      if (salvageReady(inputs))
        return outputHasRoom(m, 'sword_std') ? { ok: true, msg: '重新祭炼残破法器' } : { ok: false, msg: '产出格与地面皆满' };
      if (!hasMod(m, 'jade_slip')) return { ok: false, msg: '模组槽缺器谱玉简（或放残破法器，配一锭玄铁、一柄残剑或两块玄铁矿重新祭炼）' };
      if (bladeReady(inputs)) return outputHasRoom(m, 'demon_blade') ? { ok: true, msg: '以魂晶为神兵胚料开锋，铸噬魂魔剑' } : { ok: false, msg: '产出格与地面皆满' };
      if (countIn(inputs, 'iron_ingot') < 3) return { ok: false, msg: '缺原料：三锭玄铁' };
      if (!outputHasRoom(m, 'sword_std')) return { ok: false, msg: '产出格与地面皆满' };
      return { ok: true, msg: '可打一柄飞剑' };
    case 'danlu': {
      const r = danluRecipe(m, inputs);
      if (!r && countIn(inputs, 'waste_pill') >= 2) return { ok: true, msg: `重炼废丹${hasMod(m, 'dan_guide') ? '（有丹引，必成）' : ''}` };
      if (!r) return { ok: false, msg: '丹材不足以成任一丹方' };
      if (!findSpot(gridOf(m, 'out'), { id: r.out })) return { ok: false, msg: '产出格已满' };
      return { ok: true, msg: `将炼${ITEMS[r.out].name}` };
    }
    case 'pool': {
      const waters = countIn(inputs, 'water'), sand = countIn(inputs, 'filter_sand') + countIn(inputs, 'spirit_sand');
      if (!waters) return { ok: false, msg: '池中无水' };
      if (!sand) return { ok: false, msg: '缺滤灵砂或高纯灵砂' };
      if (!findSpot(gridOf(m, 'out'), { id: 'water' })) return { ok: false, msg: '产出格已满' };
      return { ok: true, msg: `可洗 ${Math.min(4, waters, sand)} 瓶` };
    }
    case 'spring':
      if (!outputHasRoom(m, 'water')) return { ok: false, msg: '产出格与地面皆满' };
      return { ok: true, msg: `将涌出${S.upgrades.vein ? '四' : '三'}瓶浊灵水` };
    case 'herbbed':
      if (!countIn(inputs, 'herb_seed')) return { ok: false, msg: '未下种' };
      return { ok: true, msg: `${countIn(inputs, 'herb_seed')} 株生长中` };
    case 'gupot': return gupotCheck(m, inputs);
    case 'winejar':
      if (m.brew > 0) return { ok: true, msg: `封坛中，还需 ${m.brew} 夜` };
      if (m.brew === 0 && m.ready) return outputHasRoom(m, 'spirit_wine') ? { ok: true, msg: '待出坛' } : { ok: false, msg: '产出格已满' };
      if (countIn(inputs, 'spirit_fruit') < 2 || countIn(inputs, 'yeast') < 1) return { ok: false, msg: '缺原料：两枚灵果+一块酒曲' };
      return { ok: true, msg: '今夜封坛' };
    case 'soulfurnace':
      if (countIn(inputs, 'live_soul') && countIn(inputs, 'soul_pearl'))
        return findSpot(gridOf(m, 'out'), { id: 'soul_crystal' }) ? { ok: true, msg: '以生魂淬魂珠，炼魂晶' } : { ok: false, msg: '产出格已满' };
      if (countIn(inputs, 'soul_wisp') < wispsPerPearl() && !countIn(inputs, 'soul_grudge')) return { ok: false, msg: `缺魂：${wispsPerPearl() === 2 ? '两' : '三'}缕游魂或一缕怨魂（或一缕生魂＋一颗魂珠炼魂晶）` };
      if (!findSpot(gridOf(m, 'out'), { id: 'soul_pearl' })) return { ok: false, msg: '产出格已满' };
      return { ok: true, msg: `可炼 ${hasMod(m, 'soul_bell') ? 2 : 1} 炉` };
    case 'coffin':
      if (m.brew > 0) return { ok: true, msg: `封棺中，还需 ${m.brew} 夜` };
      if (m.ready) return findSpot(gridOf(m, 'out'), { id: m.brewOut || 'iron_corpse' }) ? { ok: true, msg: '待开棺' } : { ok: false, msg: '产出格已满' };
      if (countIn(inputs, 'cult_corpse') && countIn(inputs, 'soul_crystal')) return { ok: true, msg: '今夜封棺，炼尸王' };
      if (!countIn(inputs, 'corpse') || !countIn(inputs, 'soul_pearl')) return { ok: false, msg: '缺料：一具尸身、一颗魂珠（或修士遗蜕、一块魂晶）' };
      return { ok: true, msg: '今夜封棺' };
    case 'puppetbench':
      if (!hasMod(m, 'puppet_scroll')) return { ok: false, msg: '模组槽缺傀儡图谱' };
      if (countIn(inputs, 'iron_ingot') < 2 || !countIn(inputs, 'soul_pearl')) return { ok: false, msg: '缺料：两锭玄铁、一颗魂珠' };
      if (!outputHasRoom(m, 'puppet_doll')) return { ok: false, msg: '产出格与地面皆满' };
      return { ok: true, msg: '可造一具傀儡' };
    case 'yaopot': {
      const seeds = inputs.filter(it => YAO_SEEDS[it.id]).length;
      if (!seeds) return { ok: false, msg: '未下种' };
      const vines = countIn(inputs, 'vine_seed'), food = countIn(inputs, 'bones') + countIn(inputs, 'corpse') * 3;
      return { ok: true, msg: vines && food < vines ? `噬血藤缺血食（${food}/${vines}）` : `${seeds} 株生长中` };
    }
    case 'forgery': return forgeryCheck(m, inputs);
    case 'dihuo': return dihuoCheck(m, inputs);
    case 'pen': return penCheck(m, inputs);
    case 'fudesk': return fudeskCheck(m, inputs);
    case 'puppet':
      if (!inputs.length) return { ok: false, msg: '货架空空' };
      return { ok: true, msg: `货架 ${inputs.length} 件` };
  }
  return { ok: false, msg: '' };
}

// 执行一夜生产，返回报告文字
function machineRun(m) {
  const def = MACHINES[m.type];
  const inputs = def.in ? itemsIn(gridOf(m, 'in')) : [];
  const made = [];
  let floorCount = 0;
  const bonus = techBonus(m.type);
  const emit = it => {
    if (bonus && hasQuality(it)) it.q = clamp(it.q + bonus, 5, 100);
    const where = output(m, it);
    if (where === 'floor') floorCount++;
    if (where) { made.push(itemName(it)); tally('made'); }
  };
  if (customRun(m, inputs, emit)) return `产出：${made.join('、')}${floorCount ? `（${floorCount} 件溢到地上）` : ''}`;
  switch (m.type) {
    case 'furnace': {
      const disk = hasMod(m, 'fire_disk');
      for (let b = 0; b < ((disk ? 4 : 2) + (techLv('refine') >= 3 ? 1 : 0)) * (hasBoostFu(m) ? 2 : 1); b++) {
        const relic = takeItems(inputs, 'broken_relic', 1);
        if (relic.length) {
          emit(makeItem('iron_ingot', { q: clamp(relic[0].q + 15, 5, 100) }));
          if (Math.random() < 0.3) emit(makeItem('spirit_crystal', { charge: 0, q: 60 }));
          continue;
        }
        let src = takeItems(inputs, 'scrap_sword', 1);
        if (!src.length) src = countIn(inputs, 'iron_ore') >= 2 ? takeItems(inputs, 'iron_ore', 2) : [];
        if (!src.length) break;
        emit(makeItem('iron_ingot', { q: clamp(avgQ(src) + (disk ? -15 : 5), 5, 100) }));
      }
      break;
    }
    case 'forge':
      if (hasMod(m, 'jade_slip') && bladeReady(inputs)) {
        const used = [...takeItems(inputs, 'god_blank', 1), ...takeItems(inputs, 'soul_crystal', 1)];
        emit(makeItem('demon_blade', { q: clamp(avgQ(used) + retreatQ(), 5, 100) }));
        burnMod(m, 'zhen_fu');
        break;
      }
      for (let b = 0; b < (hasBoostFu(m) ? 4 : 2); b++) {
        if (salvageForge(m, inputs, emit)) continue;
        if (b >= (hasBoostFu(m) ? 2 : 1)) break;
        if (!hasMod(m, 'jade_slip') || countIn(inputs, 'iron_ingot') < 3) break;
        emit(makeItem('sword_std', { q: clamp(avgQ(takeItems(inputs, 'iron_ingot', 3)) + 8 + retreatQ(), 5, 100) }));
      }
      burnMod(m, 'zhen_fu');
      break;
    case 'danlu': {
      const fire = hasMod(m, 'dan_fire');
      const guide = hasMod(m, 'dan_guide') ? 25 : 0;
      let blown = 0;
      for (let b = 0; b < ((fire ? 2 : 1) + (techLv('alchemy') >= 3 ? 1 : 0)) * (hasBoostFu(m) ? 2 : 1); b++) {
        const r = danluRecipe(m, inputs);
        if (!r) { const sv = salvagePills(m, inputs, emit); if (sv === null) break; if (sv !== true) blown++; continue; }
        if (!findSpot(gridOf(m, 'out'), { id: r.out })) break;
        const used = r.use.flatMap(([id, n]) => takeItems(inputs, id, n));
        emit(makeItem(r.out, { q: clamp(avgQ(used) + (fire ? 20 : 0) + guide + retreatQ(), 5, 100) }));
      }
      burnMod(m, 'dan_guide'); burnMod(m, 'zhen_fu');
      if (blown) made.push(`炸了 ${blown} 炉废丹`);
      break;
    }
    case 'pool': {
      const waters = inputs.filter(it => it.id === 'water');
      for (const w of waters.slice(0, 4)) {
        // 灵液越纯越该用高纯灵砂；滤灵砂最多洗到 99.01%
        const useHi = countIn(inputs, 'spirit_sand') && (w.purity >= 90 || !countIn(inputs, 'filter_sand'));
        if (!(useHi || countIn(inputs, 'filter_sand')) || !findSpot(gridOf(m, 'out'), w)) break;
        takeItems(inputs, useHi ? 'spirit_sand' : 'filter_sand', 1);
        const before = w.purity, cap = useHi ? 99.99 : 99.01;
        w.purity = Math.max(w.purity, Math.min(cap, Math.round((w.purity + (cap - w.purity) * (0.72 + 0.1 * techLv('water') + (useHi ? 0.1 : 0)) + 0.3) * 100) / 100));
        autoPlace(w, [gridOf(m, 'out')]);
        made.push(`${before}%→${w.purity}%`);
      }
      break;
    }
    case 'spring':
      for (let i = 0; i < 3 + (S.upgrades.vein ? 1 : 0); i++) emit(makeItem('water', { purity: rint(55, 70) }));
      break;
    case 'herbbed':
      inputs.filter(it => it.id === 'herb_seed').forEach(seed => {
        seed.growth = (seed.growth || 0) + Math.round(50 * seasonOf().growth * (1 + 0.25 * techLv('plant')));
        if (seed.growth < 100) return;
        const herb = { uid: -1, id: Math.random() < 0.3 ? 'herb_blood' : 'herb_dew' };
        if (!findSpot(gridOf(m, 'out'), herb)) return;
        destroyItem(seed);
        emit(makeItem(herb.id, { q: rint(40, 85) }));
      });
      break;
    case 'gupot': return gupotRun(m, inputs);
    case 'soulfurnace':
      for (let b = 0; b < (hasMod(m, 'soul_bell') ? 2 : 1); b++) {
        if (countIn(inputs, 'live_soul') && countIn(inputs, 'soul_pearl') && findSpot(gridOf(m, 'out'), { id: 'soul_crystal' })) {
          emit(makeItem('soul_crystal', { q: clamp(avgQ([...takeItems(inputs, 'live_soul', 1), ...takeItems(inputs, 'soul_pearl', 1)]) + 5, 5, 100) }));
          continue;
        }
        if (!findSpot(gridOf(m, 'out'), { id: 'soul_pearl' })) break;
        const grudge = takeItems(inputs, 'soul_grudge', 1);
        if (grudge.length) { emit(makeItem('soul_pearl', { q: rint(70, 95) })); continue; }
        if (countIn(inputs, 'soul_wisp') < wispsPerPearl()) break;
        emit(makeItem('soul_pearl', { q: avgQ(takeItems(inputs, 'soul_wisp', wispsPerPearl())) }));
      }
      break;
    case 'coffin':
      if (m.brew > 0 && --m.brew === 0) m.ready = true;
      else if (!m.ready && !m.brew) {
        const king = countIn(inputs, 'cult_corpse') && countIn(inputs, 'soul_crystal');
        const used = king ? [...takeItems(inputs, 'cult_corpse', 1), ...takeItems(inputs, 'soul_crystal', 1)]
          : [...takeItems(inputs, 'corpse', 1), ...takeItems(inputs, 'soul_pearl', 1)];
        m.brewQ = avgQ(used);
        m.brewOut = king ? 'corpse_king' : 'iron_corpse';
        if (techLv('corpse') < 2) { m.brew = 1; return `封棺，尸气翻涌，明夜开棺${king ? '——棺中有王' : ''}`; }
        m.ready = true;
      }
      if (m.ready && findSpot(gridOf(m, 'out'), { id: m.brewOut || 'iron_corpse' })) {
        m.ready = false;
        emit(makeItem(m.brewOut || 'iron_corpse', { q: m.brewQ || 50 }));
        const poison = makeItem('corpse_poison', { q: 60 });
        if (autoPlace(poison, [gridOf(m, 'out')])) made.push('尸毒'); else destroyItem(poison);
      }
      break;
    case 'puppetbench': {
      const used = [...takeItems(inputs, 'iron_ingot', 2), ...takeItems(inputs, 'soul_pearl', 1)];
      emit(makeItem('puppet_doll', { q: clamp(avgQ(used) + 5, 5, 100) }));
      break;
    }
    case 'yaopot': return yaopotRun(m, inputs);
    case 'forgery': return forgeryRun(m, inputs);
    case 'dihuo': dihuoRun(m, inputs, emit); break;
    case 'pen': return penRun(m, inputs);
    case 'fudesk': fudeskRun(m, inputs, emit); break;
    case 'winejar':
      if (m.brew > 0 && --m.brew === 0) m.ready = true;
      else if (!m.ready && m.brew === 0) {
        const used = [...takeItems(inputs, 'spirit_fruit', 2), ...takeItems(inputs, 'yeast', 1)];
        m.brewQ = avgQ(used);
        if (techLv('brew') < 2) { m.brew = 1; return '封坛，明夜出酒'; }
        m.ready = true;
      }
      if (m.ready && outputHasRoom(m, 'spirit_wine')) { m.ready = false; emit(makeItem('spirit_wine', { q: m.brewQ || 50 })); }
      break;
    case 'puppet': return puppetRun(m, inputs);
  }
  if (!made.length) return '没有产出';
  return `产出：${made.join('、')}${floorCount ? `（${floorCount} 件溢到地上）` : ''}`;
}

// 妖植盆里能种的：种子 → [结出什么, 每夜长几成]；货品册可往里添
const YAO_SEEDS = { mihun_seed: ['mihun_flower', 50], vine_seed: ['vine_fruit', 34] };
const isSeed = it => it.id === 'herb_seed' || !!YAO_SEEDS[it.id];

function yaopotRun(m, inputs) {
  const notes = [];
  const grow = seasonOf().growth;
  inputs.filter(it => YAO_SEEDS[it.id]).forEach(seed => {
    if (seed.id === 'vine_seed') {
      // 噬血藤要血食：一块腐骨一夜，一具尸身顶三夜
      if (!seed.fed) {
        if (takeItems(inputs, 'bones', 1).length) seed.fed = 1;
        else if (takeItems(inputs, 'corpse', 1).length) seed.fed = 3;
        else { notes.push('噬血藤饿得枯黄'); return; }
      }
      seed.fed--;
    }
    const [id, rate] = YAO_SEEDS[seed.id];
    seed.growth = (seed.growth || 0) + Math.round(rate * grow * (1 + 0.25 * techLv('plant')));
    if (seed.growth < 100) return;
    if (!findSpot(gridOf(m, 'out'), { id })) { notes.push('产出格已满'); return; }
    destroyItem(seed);
    const it = makeItem(id, { q: clamp(rint(45, 85) + techBonus('yaopot'), 5, 100) });
    autoPlace(it, [gridOf(m, 'out')]);
    notes.push(`结出${itemName(it)}`);
  });
  return notes.length ? notes.join('；') : '妖植在黑暗里缓缓舒展';
}

function puppetRun(m, shelf) {
  let sold = 0, cash = 0;
  for (const it of shelf.slice().sort(() => Math.random() - 0.5)) {
    if (sold >= 3 || Math.random() > 0.55) continue;
    const price = Math.round(claimedValue(it) * priceMul(it.id) * rnd(0.72, 0.98) * diff().sell);
    if (ITEMS[it.id].contra) S.heat += 3;
    if (it.fake) m.complaints = (m.complaints || 0) + 1;
    cash += price; sold++;
    destroyItem(it);
  }
  m.cash += cash;
  S.stats.income += cash;
  return sold ? `夜里卖出 ${sold} 件，钱匣进账 ${cash} 灵石` : '一夜无人问津';
}

function powerSupply() { return ARRAY_BASE_POWER + (S.upgrades.hijack ? 6 : 0) + (S.upgrades.vein ? 10 : 0); }
function crystalCharge() { return itemsIn('power').reduce((s, it) => s + (it.charge || 0), 0); }

// 预估今夜灵力：按设备顺序扣，供 UI 显示
function powerPlan() {
  let avail = powerSupply(), bank = crystalCharge();
  const rows = S.machines.map(m => {
    const chk = machineCheck(m), need = MACHINES[m.type].power;
    if (!chk.ok) return { m, chk, powered: null };
    if (avail + bank < need) return { m, chk, powered: false };
    const fromBase = Math.min(avail, need);
    avail -= fromBase; bank -= need - fromBase;
    return { m, chk, powered: true };
  });
  return { rows, demand: rows.filter(r => r.chk.ok).reduce((s, r) => s + MACHINES[r.m.type].power, 0), supply: powerSupply(), bank: crystalCharge() };
}

function drawPower(need, state) {
  if (state.avail + state.bank < need) return false;
  const fromBase = Math.min(state.avail, need);
  state.avail -= fromBase;
  let rest = need - fromBase;
  for (const c of itemsIn('power')) {
    const d = Math.min(c.charge || 0, rest);
    c.charge -= d; rest -= d; state.bank -= d;
  }
  return true;
}

// ───────────── 每日流程 ─────────────

function rentAmount(i = S.rentIndex) {
  // 钱执事的分账从下下期起算，给你留出出货的工夫
  const extra = S.flags.rentExtra && i >= (S.flags.rentExtraAt || 0) ? S.flags.rentExtra : 0;
  return Math.round(200 * Math.pow(1.28, i) * diff().rent * S.flags.rentMul / 10) * 10 + extra;
}

function rollMarket() {
  S.market = Math.random() < 0.3 ? MARKET_EVENTS[0] : pick(MARKET_EVENTS.slice(1));
  const markup = 1 + diff().markup;
  const discount = 1 - clamp(S.rep.mo, 0, 50) / 250;
  S.supply = SUPPLY.filter(s => S.rep.mo >= s[2]).map(([id, price]) => ({
    id, price: Math.max(1, Math.round(price * markup * discount * warStage().supply * (0.5 + 0.5 * priceMul(id)))), stock: BULK.includes(id) ? rint(6, 14) : rint(2, 6),
  }));
}

// 大宗原料，货郎每天备得多
const BULK = ['iron_ore', 'filter_sand', 'bones', 'fu_paper', 'cinnabar', 'herb_seed', 'jade_bottle'];

function supplierPrice(base) { return Math.round(base * (1 + diff().markup)); }

function displayAttraction() {
  return itemsIn('display').reduce((s, it) => s + claimedValue(it), 0);
}

// 顾客群体预测：陈列吸引的买家与普通顾客
// 陈列柜招来的买家占比：摆得越多越容易遇上对口的人
function displayPull(n) { return Math.min(0.75, n * 0.15); }

// 没人会专程来问的破烂：只能卖给贩子或喂灵宠
const JUNK = ['waste_pill', 'broken_relic', 'broken_bowl', 'bones', 'scrap_sword'];

// 主动询问的客人问的是某一样东西——碰巧你有，才做得成买卖
function inquiryItem(cat) {
  const ids = Object.keys(ITEMS).filter(id => ITEMS[id].cat === cat && !ITEMS[id].tool && !ITEMS[id].book && !ITEMS[id].additive && !JUNK.includes(id));
  const held = ids.filter(id => Object.values(S.items).some(it => HELD(it) && it.id === id));
  if (held.length && Math.random() < 0.15) return pick(held);
  return weighted(ids.map(id => [id, 1 / Math.sqrt(ITEMS[id].base + 10)]));
}

function forecast() {
  const disp = itemsIn('display');
  const pDisp = displayPull(disp.length);
  const byCat = {};
  disp.forEach(it => {
    const cat = ITEMS[it.id].cat;
    byCat[cat] = (byCat[cat] || 0) + 1 + Math.sqrt(claimedValue(it)) / 5;
  });
  const catTotal = Object.values(byCat).reduce((a, b) => a + b, 0) || 1;
  const fw = factionWeights(), fwTotal = Object.values(fw).reduce((a, b) => a + b, 0);
  const n = customerCount();
  return {
    n, pDisp,
    buyers: Object.entries(byCat).map(([cat, w]) => ({ cat, p: pDisp * w / catTotal })).sort((a, b) => b.p - a.p),
    generic: Object.entries(fw).map(([f, w]) => ({ faction: f, p: (1 - pDisp) * w / fwTotal })).sort((a, b) => b.p - a.p),
    angryYao: disp.some(it => it.id === 'yao_core' || it.id === 'beast_hide'),
    contra: disp.filter(isBanned).length,
    overseer: disp.some(isBanned) ? { name: landlordPerson().name, t: tolerance(landlordPerson()) } : null,
  };
}

function customerCount() {
  return 5 + (S.upgrades.sign ? 1 : 0) + patronBonus() - fateCustomerLoss() + Math.min(2, Math.floor(displayAttraction() / 600)) - (S.world.stage >= 3 ? 1 : 0) - (S.world.stage >= 4 ? 1 : 0);
}

const WAR_CATS = ['dan', 'qi', 'fu', 'hun', 'shi', 'zhi'];

function factionWeights() {
  const base = { ren: 35, mo: 35, yao: 18, xian: 12 };
  for (const f in base) base[f] = Math.max(3, base[f] * (1 + S.rep[f] / 120) * trafficMul(f));
  return base;
}

function openShop() {
  S.phase = 'day';
  S.queue = [];
  const n = customerCount();
  for (let i = 0; i < n; i++) S.queue.push(genCustomer());
  // 巡查是头天夜里定下的（见 planInspection），有风声的话，此时你已经知道了
  if (!S.plan || S.plan.day !== S.day) planInspection();
  if (S.plan.inspect) S.queue.splice(rint(1, S.queue.length), 0, inspectVisitor());
  overseeDisplay();
  queueNobles();
  queuePleas();
  castTick();
  teachTick();
  queueStoryVisitors();
  log(`开门迎客。今日预计 ${S.queue.length} 位来客。`);
}

function genCustomer() {
  const disp = itemsIn('display');
  if (disp.length && Math.random() < displayPull(disp.length)) {
    const target = weighted(disp.map(it => [it, 1 + Math.sqrt(claimedValue(it)) / 5]));
    const cat = ITEMS[target.id].cat;
    const fw = {};
    for (const [f, w] of Object.entries(CAT_FACTION[cat])) fw[f] = w * Math.max(0.2, 1 + S.rep[f] / 120) * trafficMul(f);
    const c = makeCustomer(weighted(fw), 'buy');
    Object.assign(c, { wantCat: cat, wantId: target.id, targetUid: target.uid, attracted: true, need: 1 });
    c.patience = Math.min(5, c.patience + 1);
    c.budget = Math.round(Math.max(c.budget, claimedValue(target) * priceMul(target.id) * rnd(1.05, 1.5)));
    return c;
  }
  const p = choosePerson();
  return makeCustomer(p.faction, decideKind(p), p);
}

function makeCustomer(faction, kind, person = pickPerson(faction)) {
  const [lo, hi] = FACTION_BUDGET[faction];
  const c = {
    kind, faction, patience: rint(2, 4),
    budget: Math.round(rnd(lo, hi) * (1 + S.day * 0.03) * (1 + S.rep[faction] / 250) * budgetMul(faction)),
  };
  seatPerson(c, person);
  if (kind === 'crave') {
    Object.assign(c, { kind: 'buy', craving: true, wantCat: 'dan' });
    c.budget = Math.round(c.budget * (1 + 0.3 * person.addict));
  } else if (kind === 'wantfake') {
    Object.assign(c, { kind: 'buy', wantFake: true, wantCat: pick(['wan', 'dan']), claim: 'honest' });
    c.budget = Math.round(c.budget * 1.3);
  } else if (kind === 'giftfake') {
    Object.assign(c, { kind: 'buy', wantFake: true, forGift: true, wantCat: pick(['wan', 'qi', 'dan']), claim: 'honest' });
  } else if (kind === 'wish') {
    Object.assign(c, { kind: 'buy', wishId: person.wish, wantCat: ITEMS[person.wish].cat });
    c.budget = Math.round(Math.max(c.budget * 1.5, claimedValue({ id: person.wish, q: 70 }) * priceMul(person.wish) * 1.3));
  } else if (kind === 'plea') {
    pleaSetup(c, person);
  } else if (kind === 'noble') {
    Object.assign(c, { kind: 'buy', noble: true, patience: rint(1, 2) });
    c.budget = Math.round(c.budget * rnd(2.5, 4.5));
  }
  if (c.kind === 'sell') {
    // 来卖货的人一次拿出好几样；走投无路的倾囊而出
    const n = +weighted([[1, 50], [2, 35], [3, 15]]) + (person.desperate ? 1 : 0);
    c.itemSpecs = Array.from({ length: n }, () => sellSpec(faction));
    if (faction !== 'yao' && Math.random() < 0.08) c.wanted = rint(12, 30) * 10;
    // 卖完了顺手也买点什么
    if (Math.random() < 0.4) c.wantCat = weighted(BUY_WANTS[faction]);
    c.budget = Math.round(c.budget * 0.6);
  } else if (c.kind === 'buy') {
    if (!c.wantCat || c.noble) {
      // 战时各族更想要战备；权贵只要体面的东西
      const wants = {};
      for (const [cat, w] of Object.entries(c.noble ? NOBLE_WANTS : BUY_WANTS[faction])) wants[cat] = w * Math.max(0.2, 1 + S.world.stage * (WAR_CATS.includes(cat) ? 0.5 : -0.1));
      c.wantCat = weighted(wants);
      c.wantId = inquiryItem(c.wantCat);
    }
    // 带伤中毒的人，多半是来买药的
    const heal = healingWant(person);
    if (heal && !c.wishId && !c.craving && Math.random() < 0.7) { c.wantId = heal; c.wantCat = ITEMS[heal].cat; }
    // 有的人顺便带了东西来出手
    if (!c.noble && Math.random() < 0.3) c.itemSpecs = [sellSpec(faction)];
  } else if (c.kind === 'appraise') {
    c.itemSpecs = [{ id: pick(['pill_found', 'jade_pendant', 'bronze_mirror']), extra: { fake: Math.random() < 0.5 } }];
    c.fee = rint(3, 7) * 10 * (S.upgrades.master ? 2 : 1);
  }
  if (c.wantCat && !c.wantId && !c.wishId && !c.craving && !c.wantFake) c.wantId = inquiryItem(c.wantCat);
  // 要几件：要得多的，钱也带得多些
  if (c.wantCat) {
    c.need = wantNeed(c, person);
    c.budget = Math.round(c.budget * (1 + 0.4 * (c.need - 1)));
  }
  return c;
}

// 权贵想要的：体面、稀罕、能拿出去炫耀的
const NOBLE_WANTS = { wan: 4, qi: 4, yin: 2, dan: 2, shi: 1 };

function sellSpec(faction) {
  const id = weighted(SELL_POOLS[faction]);
  const extra = {};
  if (ITEMS[id].appraise) extra.fake = Math.random() < 0.4;
  // 客人来卖的丹药、灵酒、灵果，偶尔是别人掺过料的——他自己多半也不知道
  marketLace(id, extra, faction === 'mo' ? 0.15 : faction === 'yao' ? 0.1 : 0.06);
  if ((faction === 'mo' && Math.random() < 0.4) || (faction === 'ren' && Math.random() < 0.12)) extra.stolen = rint(3, 6);
  return { id, extra };
}

// 叫下一位顾客上前；返回顾客或 null（已无客）
function nextCustomer() {
  clearCounter();
  S.customer = S.queue.shift() || null;
  const c = S.customer;
  if (!c) return null;
  if (c.kind === 'story') { arriveStory(c); return c; }
  arrivePerson(c);
  maybeConfide(c);
  // 进门时看看柜上还有没有冲着来的东西
  if (c.attracted && !itemsIn('display').some(it => it.id === c.wantId)) c.attracted = false;
  if (c.wishId) c.wishSeen = itemsIn('display').some(it => it.id === c.wishId);
  maybeReport(c);
  (c.itemSpecs || []).forEach(spec => {
    const it = makeItem(spec.id, Object.assign({}, spec.extra));
    if (it.stolen && S.perks.fence) it.stolen = Math.ceil(it.stolen / 2);
    if (it.stolen && hasQuality(it) && Math.random() < 0.6) stampMark(it);
    if (c.kind === 'sell' && dressable(it) && Math.random() < 0.42) {
      dressUp(it, rollGrade());
      const pp = personOf(c);
      it.knew = Math.random() < 0.55 + (pp ? pp.savvy : 0.3) * 0.35;
    }
    if (!autoPlace(it, ['counter'])) { destroyItem(it); return; }
    if (!c.item) c.item = it.uid;
    const fakeDiscount = it.fake ? rnd(0.6, 0.9) : 1;
    const contraDiscount = ITEMS[it.id].contra ? 0.6 : 1;
    const pp = personOf(c), savvy = pp ? pp.savvy : 0.3;
    it.ask = Math.max(1, Math.round(claimedValue(it) * priceMul(it.id) * rnd(0.8 + 0.15 * savvy, 1.05) * (pp && pp.desperate ? 0.6 : 1)
      * (it.stolen ? 0.55 : 1) * fakeDiscount * contraDiscount * (1 - affOf(c) / 600) * softTouch()));
  });
  if (c.faction === 'yao' && c.kind !== 'inspect' && forecast().angryYao && !S.flags.foxBlessing) {
    c.offended = true;
    S.rep.yao = clamp(S.rep.yao - 3, -100, 100);
  }
  return c;
}

function clearCounter() { itemsIn('counter').forEach(destroyItem); }

function customerItem() { return S.customer && S.customer.item ? S.items[S.customer.item] : null; }

const affOf = c => (personOf(c) || { aff: 0 }).aff;

function dismissCustomer(angry) {
  const c = S.customer;
  if (c && angry && c.faction) { adjustRep(c.faction, -1); remember(personOf(c), '在你这儿谈崩了买卖。', -3); }
  if (c) settleReports(c);
  clearCounter();
  returnTray();
  S.customer = null;
}

function adjustRep(f, d) { S.rep[f] = clamp(Math.round(S.rep[f] + d), -100, 100); }
function addHeat(d) { S.heat = clamp(Math.round(S.heat + d), 0, 100); peak('heat', S.heat); }

function earn(n, why) { S.stones += n; S.today.income += n; S.stats.income += n; peak('stones', S.stones); if (why) log(why, 'gain'); }
// 结局画像用的计数：tally 累加，peak 记最高
function tally(k, n = 1) { S.stats[k] = (S.stats[k] || 0) + n; }
function peak(k, v) { if (v > (S.stats[`${k}Max`] || 0)) S.stats[`${k}Max`] = v; }
function spend(n, why) { S.stones -= n; S.today.expense += n; S.stats.spent += n; if (why) log(why, 'loss'); }

// ───────────── 议价 ─────────────

// 顾客买：对方心理价。claim 可以逐件不同：有的当真货卖，有的告知实情
const claimOf = (c, it) => it.claim || c.claim;

function buyerValuation(c, it) {
  const pref = c.attracted ? 1.15 : 1;
  const base = c.forGift && isFlawed(it) ? giftFakeValue(it)
    : claimOf(c, it) === 'honest' && isFlawed(it) ? honestValue(it) * (c.wantFake ? 1.8 : 1) : claimedValue(it);
  return base * priceMul(it.id) * (1 + S.rep[c.faction] / 250) * diff().sell * pref * (1 + affOf(c) / 500) * personValueMul(c, it) * trustMul();
}

function roll(odds) {
  const r = Math.random();
  return r < odds.accept ? 'accept' : r < odds.accept + odds.counter ? 'counter' : 'leave';
}

// 顾客买下物品；v 为这件货在这笔交易里的心理价（顺带买的货打了折）
function completeSale(c, it, price, v = buyerValuation(c, it)) {
  const x = price / v;
  if (x < 0.9) adjustRep(c.faction, 2);
  else if (x > 1.3) adjustRep(c.faction, -1);
  if (c.faction === 'xian') addHeat(4);
  if (it.id === 'yao_core') adjustRep('yao', -2);
  if (it.id === 'beast_hide') adjustRep('yao', -1);
  const name = itemName(it);
  if (it.stolen > 0 && Math.random() < 0.2) {
    destroyItem(it);
    adjustRep('mo', -4); addHeat(8);
    log(`${c.name}认出了这件${name}是同门失窃之物，当场收走，还扬言要告到执法堂！`, 'loss');
    return { stolenCaught: true };
  }
  const p = personOf(c);
  if (applyLace(p, it, 'sale', !!c.forGift).caught) {
    log(`${c.name}察觉${name}被动了手脚，当场摔了回来！`, 'loss');
    return { lacedCaught: true };
  }
  if (c.wishId === it.id && p) {
    remember(p, `从你这儿买到了心心念念的${name}。`, 15, 'helped');
    p.wish = null;
  }
  if (ITEMS[it.id].illicit) addHeat(2);
  if (c.faction === 'mo' || c.faction === 'xian') fuelWar(it, price);
  if (isFlawed(it)) recordSold(c, it, price, claimOf(c, it) === 'honest');
  deliverIntel(p, it);
  if (it.mark) { S.markedSold = S.markedSold || []; S.markedSold.push({ owner: it.mark.owner, name: itemName(it), day: S.day, str: it.mark.str }); }
  noteSale(c, it, price, x);
  castEvent(p, 'sold', it, price);
  earn(price, `${c.name}以 ${price} 灵石买下${name}。`);
  S.stats.sales++;
  if (it.stolen > 0 || ITEMS[it.id].contra) tally('hot');
  if (!S.stats.bestSale || price > S.stats.bestSale.price) S.stats.bestSale = { name, price, day: S.day };
  if (it.cost != null) {
    const profit = price - it.cost;
    if (!S.stats.bestFlip || profit > S.stats.bestFlip.profit) S.stats.bestFlip = { name, cost: it.cost, price, profit, day: it.boughtDay };
  }
  destroyItem(it);
  return {};
}

// 非凡人买家有一半机会看穿赝品
// 当真货卖时，买家的眼力不低于做工才可能看穿
function buyerDetectsFake(c, it) {
  if (!isFlawed(it) || claimOf(c, it) === 'honest') return false;
  const p = personOf(c), eye = p ? p.eye : 1;
  // 权贵自恃眼力，又被你捧得飘飘然，看得最马虎
  const careless = p && p.noble ? 0.45 - 0.08 * (c.flatter || 0) : 1;
  if (Math.random() > (eye >= it.grade ? 0.65 : 0.04) * careless) return false;
  const knew = knownFlaw(it);
  if (it.fake) it.revealed = true; else it.seen = Math.max(it.seen || 0, it.grade);
  adjustRep(c.faction, knew ? -4 : -2);
  remember(p, knew ? `你拿${it.fake ? '赝品' : '以次充好的'}${itemName(it)}当真货卖他，被他看穿。` : `你卖他的${itemName(it)}有问题，被他看了出来。`,
    knew ? -18 : -8, 'fakeSold');
  log(`${c.name}看出${itemName(it)}${it.fake ? '是赝品' : '是以次充好'}，冷笑着走了。`, 'loss');
  return true;
}

// 玩家买下顾客的物品
function completePurchase(c, it, offer) {
  if (offer >= it.ask) adjustRep(c.faction, 1);
  else if (offer < it.ask * 0.6) adjustRep(c.faction, -1);
  if (c.faction === 'xian') addHeat(4);
  if (ITEMS[it.id].contra) addHeat(3);
  notePurchase(c, it, offer);
  castEvent(personOf(c), 'bought', it, offer);
  spend(offer, `以 ${offer} 灵石收下${c.name}的${itemName(it)}。`);
  it.cost = offer;
  it.boughtDay = S.day;
  if (it.stolen > 0 || ITEMS[it.id].contra) tally('hot');
  ['ask', 'knew', 'told', 'disputed'].forEach(k => delete it[k]);
  stow(it);
}

// 举报是暗中递状子：当面不动声色，买卖照做；客人出了这道门才被拿下，赏金随后送到
function reportWanted(c) { c.reportedWanted = true; }

function payWanted(c, p) {
  earn(c.wanted, `执法堂在巷口按住了通缉犯${c.name}，你领得赏金 ${c.wanted} 灵石。`);
  adjustRep('mo', 4); adjustRep(c.faction, -6); addHeat(-8);
  S.merit.mo += 2;
  if (p) { remember(p, '你向执法堂举报了他。', -80, 'betrayed'); p.status = 'jailed'; lifeNote(p, '被你举报，押入血狱。'); }
  commitSin('betray', { p: p || { pid: null, name: c.name, faction: c.faction }, w: 1, what: `举报通缉犯${c.name}`, virtue: 2 });
  return { text: `${c.name}前脚出门，执法堂的人后脚就在巷口按住了${ta(p)}。赏金 ${c.wanted} 灵石送到。`, cls: 'good' };
}

// 客人走了（成交、谈崩、送客、打烊都算）：先前暗中递的状子这才兑现；人要是已经没了，状子作废
const NOTICES = [];
function settleReports(c) {
  const p = personOf(c);
  if (!c.reportedWanted && !c.reportedSecret) return;
  if (p && p.status !== 'alive') return;
  if (c.reportedWanted) NOTICES.push(payWanted(c, p));
  if (c.reportedSecret && p && p.secret) NOTICES.push(paySecret(p));
}

// ───────────── 鉴定话术 ─────────────

// 所言不实时被识破的概率：对方越精明越难骗；声望高、有鉴宝心得，对方更信你
function lieDetectChance(c) {
  return clamp(c.savvy - S.rep[c.faction] / 400 - (S.upgrades.master ? 0.1 : 0) - 0.03 * (S.cult.lv - 1), 0.03, 0.95);
}

function demeanor(c) {
  return c.savvy >= 0.65 ? '老辣' : c.savvy >= 0.45 ? '精明' : c.savvy >= 0.25 ? '寻常' : '憨直';
}

// 对赝品的贱卖价
function fakeAsk(it) { return Math.max(3, Math.round(fakeValue(it) * rnd(1.5, 3))); }

// 把鉴定结论告诉顾客。结论与真相不符（无论是有意欺骗还是看走眼）都可能被识破；
// 当场没被识破的，日后也可能另请高明而翻出旧账
function tellCustomer(c, claimFake) {
  const it = customerItem();
  const honest = claimFake === !!it.fake;
  const caught = !honest && Math.random() < lieDetectChance(c);
  // 把真品说成赝品是存心坑人；把赝品说成真品，照妖镜里明明照出了破绽才算
  const knowing = !honest && (claimFake || (ITEMS[it.id].appraise && visibleFeats(it, appraiseLevel()).length > 0));
  if (knowing) commitSin('fraud', { p: personOf(c), w: 1, what: `对${c.name}谎称${itemName(it)}是${claimFake ? '赝品' : '真品'}`, virtue: 2 });
  c.told = it.told = claimFake ? 'fake' : 'real';
  noteClaim(c, honest, caught, claimFake);
  if (honest) tally('honest'); else if (knowing) tally('lies');
  if (caught) adjustRep(c.faction, -6);
  else if (!honest && Math.random() < 0.35) {
    S.grudges.push({ faction: c.faction, name: c.name, pid: c.pid, item: itemName(it), day: S.day + rint(1, 3) });
  }
  return { honest, caught };
}

// 鉴定委托：说出结论后，听说是赝品的多半想贱卖给你，听说是真品的偶尔愿意出让
function finishAppraisal(c, claimFake) {
  const it = customerItem();
  const { honest, caught } = tellCustomer(c, claimFake);
  S.stats.appraisals++;
  if (caught) {
    log(`${c.name}识破了你的说辞，甩袖而去，酬金分文未给。`, 'loss');
    return { caught };
  }
  earn(c.fee, `${c.name}付了 ${c.fee} 灵石鉴定酬金。`);
  if (honest) adjustRep(c.faction, 3);
  let ask = null;
  if (claimFake && Math.random() < 0.7) ask = fakeAsk(it);
  else if (!claimFake && Math.random() < 0.4) ask = Math.round(claimedValue(it) * priceMul(it.id) * rnd(0.9, 1.1));
  if (ask) { Object.assign(c, { kind: 'sell', afterAppraisal: true }); it.ask = ask; }
  return { honest, ask };
}

// 收货时当面指为赝品压价；被识破则对方加价、耐心大减
function disputeAsFake(c) {
  const it = customerItem();
  const { caught } = tellCustomer(c, true);
  if (caught) {
    it.disputed = 'caught';
    c.patience -= 2;
    it.ask = Math.round(it.ask * 1.1);
    log(`${c.name}识破了你的压价伎俩。`, 'loss');
  } else {
    it.disputed = 'ok';
    it.ask = Math.min(it.ask, fakeAsk(it));
  }
  return { caught };
}

// ───────────── 巡查 ─────────────

function inspectionCost() { return 60 + S.heat * 3; }

// offer：打点的灵石数，0 为配合搜查
function runInspection(offer = 0) {
  S.stats.inspections++;
  const e = official('enforcer');
  if (!offer && tolerance(e) === 'ignore') {
    log(`${e.name}扫了一眼你的铺子，什么也没说就走了。`, 'gain');
    return { bribed: true, ignored: true, found: [] };
  }
  if (S.flags.enforcerOwned || (offer && S.flags.chenShelter)) {
    if (offer) spend(offer, `塞给${e.name} ${offer} 灵石。`);
    log(`${e.name}草草走了个过场。`, 'gain');
    return { bribed: true, found: [] };
  }
  if (offer) {
    if (tryBribe(e, inspectionStake(), offer, '免了一场搜查')) return { bribed: true, found: [] };
    log(`${e.name}冷笑一声，把你的灵石拍在柜上：“想收买执法堂？搜！”`, 'loss');
  }
  const found = [];
  Object.values(S.items).forEach(it => {
    if (!it.pos || it.pos.g === 'hidden' || it.pos.g === 'counter') return;
    const shown = it.pos.g === 'display' || it.pos.g.endsWith(':in') && machineOfGrid(it.pos.g).m.type === 'puppet';
    if ((ITEMS[it.id].contra || ITEMS[it.id].illicit) && Math.random() < (shown ? 1 : 0.5)) found.push(it);
    else if (it.stolen > 0 && Math.random() < (shown ? 0.8 : 0.35)) found.push(it);
  });
  const fine = found.reduce((s, it) => s + Math.round(claimedValue(it) * (ITEMS[it.id].contra || ITEMS[it.id].illicit ? 0.5 : 0.2)), 0);
  const names = found.map(itemName);
  found.forEach(destroyItem);
  if (!found.length) {
    addHeat(-25); adjustRep('mo', 3);
    log('巡查翻了一圈一无所获，执法堂对你的疑心淡了。', 'gain');
  } else {
    const paid = Math.min(fine, Math.max(0, S.stones));
    spend(paid, `执法堂收走了${names.join('、')}，罚没 ${paid} 灵石。`);
    addHeat(found.some(it => ITEMS[it.id].contra || ITEMS[it.id].illicit) ? 15 : 6);
    if (paid < fine) { adjustRep('mo', -15); addHeat(15); log('你交不齐罚金，被记了一笔大过。', 'loss'); }
  }
  checkHeat();
  return { found: names, fine };
}

function checkHeat() {
  loveBondCheck();
  // 情蛊种在了执法堂巡查使身上：卷宗到了她手里，就再也递不上去
  const law = S.loveGu && S.people[S.loveGu];
  if (S.heat >= 100 && !S.over && law && isLawman(law) && law.status === 'alive') {
    S.heat = 80;
    log(`${law.name}把你的卷宗压进了案底，还顺手替你把关注抹掉了一截。`, 'gold');
    return;
  }
  if (S.heat >= 100 && !S.over && savedByBenefactor('heat')) return;
  if (S.heat >= 100 && !S.over) {
    S.over = { win: false, cause: 'heat', title: '锁拿入狱', text: '执法堂认定你私通仙门，铁链加身，押入血狱。当铺被查封，所有货物充公。' };
  }
}

// ───────────── 闭铺与夜晚 ─────────────

function closeShop() {
  dismissCustomer(false);
  returnTray();
  S.queue = [];
  S.phase = 'night';
  S.scavenged = false;
  log('闭铺打烊。夜色渐浓。');
}

// 尸身按季节腐烂，烂透变成腐骨（炼尸棺里的不算）
function rotCorpses() {
  let n = 0;
  for (const it of Object.values(S.items)) {
    if (it.id !== 'corpse' || !it.pos || it.pos.g.endsWith(':in') && machineOfGrid(it.pos.g).m.type === 'coffin') continue;
    it.fresh = Math.round((it.fresh - seasonOf().rot) * 10) / 10;
    if (it.fresh > 0) continue;
    const pos = it.pos;
    destroyItem(it);
    placeItem(makeItem('bones', { q: 20 }), pos.g, pos.x, pos.y);
    n++;
  }
  return n;
}

function nightResolve() {
  const rep = [];
  const state = { avail: powerSupply(), bank: crystalCharge() };
  let labor = laborPool();
  for (const m of S.machines) {
    const def = MACHINES[m.type], chk = machineCheck(m);
    if (!chk.ok) { rep.push({ icon: def.icon, title: def.name, text: `停工：${chk.msg}`, cls: 'warn' }); continue; }
    const [cst0, csp] = MACHINE_COST[m.type] || [0, 0];
    const cover = Math.min(labor, cst0), cst = cst0 - cover;
    const tired = vitShort(cst, csp);
    if (tired) { rep.push({ icon: def.icon, title: def.name, text: `停工：${tired}（需体力 ${cst}、精神 ${csp}）`, cls: 'bad' }); continue; }
    if (!drawPower(def.power, state)) { rep.push({ icon: def.icon, title: def.name, text: '停工：灵力不足', cls: 'bad' }); continue; }
    drain(cst, csp);
    labor -= cover;
    rep.push({ icon: def.icon, title: def.name, text: machineRun(m), cls: 'ok' });
  }
  // 剩余基础灵力为灵晶充能
  let spare = state.avail;
  for (const c of itemsIn('power')) {
    const add = Math.min(CRYSTAL_CAP - (c.charge || 0), spare);
    c.charge = (c.charge || 0) + add; spare -= add;
  }
  rep.push({ icon: 'ic_power', title: '聚灵阵', text: `基础灵力 ${powerSupply()}，余 ${state.avail} 点存入灵晶（共 ${crystalCharge()}）` });

  // 赃物风头、违禁陈列、执法堂关注
  let cooled = 0;
  Object.values(S.items).forEach(it => { if (it.stolen > 0 && --it.stolen === 0) cooled++; });
  if (cooled) rep.push({ icon: 'ic_stolen', title: '风头过去', text: `${cooled} 件来路不明的货已无人追查` });
  // 违禁品摆在明处：管事不肯视而不见时，执法堂的关注一天天涨
  const contraShown = tolerance(landlordPerson()) === 'ignore' ? 0 : bannedShown().length;
  const before = S.heat;
  addHeat(contraShown * 3 - 4 - Math.max(0, S.rep.mo) / 25);
  if (S.upgrades.hijack && Math.random() < 0.1) {
    addHeat(10);
    rep.push({ icon: 'ic_heat', title: '灵脉', text: '宗门灵脉巡守察觉到异常流失……', cls: 'bad' });
  }
  rep.push({ icon: 'ic_heat', title: '执法堂关注', text: `${before} → ${S.heat}${contraShown ? `（陈列禁物 ${contraShown} 件）` : ''}`, cls: S.heat > before ? 'bad' : '' });

  // 傀儡卖出的赝品会招来投诉
  S.machines.filter(m => m.complaints).forEach(m => {
    adjustRep('mo', -2 * m.complaints);
    rep.push({ icon: 'm_puppet', title: '投诉', text: `有人发现从傀儡货摊买到了赝品（魔宗声望 -${2 * m.complaints}）`, cls: 'bad' });
    m.complaints = 0;
  });

  // 夜间随机事件
  const floor = itemsIn('floor');
  if (floor.length && !S.flags.guard && Math.random() < 0.18) {
    const lost = pick(floor);
    rep.push({ icon: 'ic_stolen', title: '夜贼', text: `有小贼溜进铺子，顺走了地上的${itemName(lost)}`, cls: 'bad' });
    destroyItem(lost);
  }

  // 当初所言不实的鉴定，被人翻了旧账
  S.grudges = S.grudges.filter(g => {
    if (g.day > S.day) return true;
    adjustRep(g.faction, -5);
    noteGrudge(g);
    rep.push({ icon: FACTIONS[g.faction].icon, title: '旧账', cls: 'bad',
      text: `${g.name}另请高明鉴定了那件${g.item}，发现你当初所言不实（${FACTIONS[g.faction].name}声望 -5）` });
    return false;
  });

  lifeTick().forEach(n => rep.push({ icon: 'ic_ledger', title: '坊间传闻', text: n.text, cls: n.cls }));
  intrigueTick().forEach(n => rep.push({ icon: 'ic_lace', title: '暗处', text: n.text, cls: n.cls }));
  soldTick().forEach(n => rep.push({ icon: 'ic_appraise', title: '卖出的货', text: n.text, cls: n.cls }));
  resolveReports().forEach(r => rep.push(r));
  gossipTick().forEach(r => rep.push(r));
  markTick();
  const rotted = rotCorpses();
  if (rotted) rep.push({ icon: 'ic_ledger', title: '尸身', text: `${rotted} 具尸身烂透了，只剩一堆腐骨`, cls: 'warn' });
  pendingTick().forEach(r => rep.push(r));
  worldTick().forEach(r => rep.push(r));
  cliqueTick().forEach(r => rep.push(r));
  karmaTick().forEach(r => rep.push(r));
  fateTick().forEach(r => rep.push(r));
  condTick().forEach(r => rep.push(r));
  castNight().forEach(r => rep.push(r));
  periodicTick();
  tourneyTick().forEach(r => rep.push(r));

  S.stats.days.push({ day: S.day, income: S.today.income, expense: S.today.expense, stones: S.stones });
  S.today = { income: 0, expense: 0 };
  S.day++;
  S.phase = 'morning';
  if (S.upgrades.vein) for (let i = 0; i < 4; i++) { const it = makeItem('iron_ore', { q: rint(45, 70) }); if (!autoPlace(it)) destroyItem(it); }
  rollMarket();
  planInspection();
  const tip = tipOff();
  if (tip) rep.push(tip);
  rep.push({ icon: 'ic_day', title: '时令', text: `${calendar().text}。${todayText()}${S.market.text}` });
  const rent = rentCheck();
  if (rent) rep.push(rent);
  rep.push(restNight());
  S.retreat = false;
  checkHeat();
  S.report = rep;
  save();
  return rep;
}

// 交租：到期日早晨自动缴纳，不足则宽限两日并加收两成
function rentCheck() {
  if (S.grace > 0) {
    S.grace--;
    if (S.stones >= S.rentOwed) return payRent();
    if (S.grace === 0 && savedByBenefactor('rent')) return { icon: 'ic_deed', title: '租金', text: '宽限期满——你帮过的人替你把租子交了', cls: 'ok' };
    if (S.grace === 0) {
      S.over = { win: false, cause: 'rent', title: '扫地出门', text: `宽限期已过，你仍欠着 ${S.rentOwed} 灵石的租子。${landlordName()}带着人收回了铺子。` };
      return { icon: 'ic_deed', title: '租金', text: '宽限期满，你被逐出了铺子', cls: 'bad' };
    }
    return { icon: 'ic_deed', title: '租金', text: `仍欠 ${S.rentOwed} 灵石，宽限还剩 ${S.grace} 日`, cls: 'bad' };
  }
  if (S.day < S.rentDue) return null;
  S.rentOwed = rentAmount();
  if (S.stones >= S.rentOwed) return payRent();
  S.rentOwed = Math.round(S.rentOwed * 1.2);
  S.grace = 2;
  tally('late');
  S.landlordVisit = true;
  return { icon: 'ic_deed', title: '租金', text: `交不起租！${landlordName()}宽限两日，连罚金共需 ${S.rentOwed} 灵石`, cls: 'bad' };
}

function payRent() {
  if (S.flags.rentWaive) { S.flags.rentWaive = false; S.rentOwed = 0; log(`${landlordName()}免了你这一期的租金。`, 'gain'); }
  const amt = S.rentOwed;
  spend(amt, `向${landlordName()}缴纳租金 ${amt} 灵石。`);
  S.rentOwed = 0; S.grace = 0;
  if (S.rentIndex >= (S.flags.rentExtraAt || 0)) S.flags.rentExtra = 0;
  S.rentIndex++;
  S.rentDue = S.day + 7;
  S.landlordVisit = true;
  return { icon: 'ic_deed', title: '租金', text: `缴纳 ${amt} 灵石。下期 ${rentAmount()} 灵石，第 ${S.rentDue} 日到期`, cls: 'warn' };
}

function payRentEarly() {
  if (S.grace > 0) { if (S.stones >= S.rentOwed) payRent(); return; }
  S.rentOwed = rentAmount();
  if (S.stones >= S.rentOwed) payRent(); else S.rentOwed = 0;
}

function deedPrice() { return Math.round(diff().deed * S.flags.deedMul / 10) * 10; }
function landlordName() { return { sun: '孙管事', tu: '屠管事' }[S.flags.landlord] || '钱执事'; }

function buyDeed() {
  if (S.stones < deedPrice()) return false;
  spend(deedPrice(), '你买下了这间铺子的铺契。');
  // 铺契到手才知道过户另有规矩：剩下的灵石和铺里的货，一样一样都抵了进去
  const left = S.stones, goods = Object.values(S.items).filter(it => it.pos && it.pos.g !== 'counter');
  peak('lens', appraiseLevel());
  const n = goods.length;
  if (left > 0) spend(left, '缴清过户的契税、印钱与各路打点。');
  goods.forEach(destroyItem);
  S.over = { win: true, cause: 'deed', title: '铺契到手', scene: 'end_deed', text: `${landlordName()}在铺契上按了手印，又从袖里抽出一张单子：契税、宗门印钱、执法堂的平安钱、过户的茶水……`
    + (left > 0 || n ? `你剩下的 ${left} 灵石${n ? `和铺里 ${n} 件货` : ''}，一样一样抵了进去。` : '你兜里早已一个子儿不剩，他把单子折好，说下回再收。')
    + '从今往后，这间铺子姓你的了。你站在空荡荡的柜台后面，和刚来杂役区那天一样一贫如洗——好在这回，不用交租了。' };
  return true;
}

// ───────────── 货郎与升级 ─────────────

function buySupply(entry) {
  if (entry.stock <= 0 || S.stones < entry.price) return '灵石不够';
  const it = makeItem(entry.id, marketLace(entry.id, { q: rint(40, 70) }, 0.04));
  if (dressable(it) && Math.random() < 0.18) dressUp(it, rint(1, 2));
  stow(it);
  it.cost = entry.price; it.boughtDay = S.day;
  entry.stock--;
  spend(entry.price);
  return null;
}

function machinePrice(type) { return supplierPrice(MACHINES[type].price); }

function buyMachine(type) {
  const price = machinePrice(type);
  if (S.stones < price) return '灵石不够';
  spend(price, `从鬼市牙人处购得${MACHINES[type].name}。`);
  addMachine(type);
  return null;
}

function buyUpgrade(id) {
  const up = UPGRADES.find(u => u.id === id);
  if (S.stones < up.price || S.upgrades[id] || (up.need && !S.upgrades[up.need])) return '无法购买';
  spend(up.price, `购置了「${up.name}」。`);
  S.upgrades[id] = true;
  if (id === 'store1') resizeGrid('store', 10, 6);
  if (id === 'store2') resizeGrid('store', 12, 7);
  if (id === 'display') resizeGrid('display', 6, 4);
  if (id === 'hidden') S.grids.hidden = { w: HIDDEN_SIZE[0], h: HIDDEN_SIZE[1] };
  return null;
}

// 货郎（鬼市牙人）的收价：四成；掺过料的货牙人一闻就知道，只肯出一成
function brokerPrice(it) { return Math.max(1, Math.round(trueValue(it) * (it.laced && it.lacedBy !== 'me' && it.lacedSeen ? 0.1 : 0.4))); }

function sellToBroker(it) {
  const price = brokerPrice(it);
  if (ITEMS[it.id].contra) addHeat(2);
  earn(price, `把${itemName(it)}折价 ${price} 灵石卖给了鬼市牙人。`);
  destroyItem(it);
  return price;
}

function collectPuppetCash(m) {
  if (!m.cash) return;
  earn(m.cash, `从傀儡钱匣取出 ${m.cash} 灵石。`);
  m.cash = 0;
}

function moveMachine(m, dir) {
  const i = S.machines.indexOf(m), j = i + dir;
  if (j < 0 || j >= S.machines.length) return;
  [S.machines[i], S.machines[j]] = [S.machines[j], S.machines[i]];
}

// 拆除设备：格子里的东西退回库房或地面，放不下的拿在手上
function removeMachine(m) {
  machineGridIds(m).forEach(gid => {
    itemsIn(gid).forEach(stow);
    delete S.grids[gid];
  });
  S.machines.splice(S.machines.indexOf(m), 1);
  const refund = Math.round(MACHINES[m.type].price * 0.3);
  earn(refund, `拆了${MACHINES[m.type].name}，旧料卖得 ${refund} 灵石。`);
}

// ───────────── 拾荒 ─────────────

function allLocations() { return LOCATIONS.concat(WAR_LOCATIONS.filter(l => S.world.stage >= l.minStage)); }

function startScavenge(locId) {
  const loc = allLocations().find(l => l.id === locId);
  S.scavenged = true;
  S.grids.basket = { w: BASKET[0], h: BASKET[1] };
  S.scav = { loc: locId, tries: loc.tries + (S.perks.digger ? 2 : 0), danger: loc.danger * (S.flags.thugBoss ? 0.5 : 1), found: null, ended: false, lines: [] };
  return S.scav;
}

function scavOdds() {
  const loc = allLocations().find(l => l.id === S.scav.loc);
  return { find: loc.find, danger: S.scav.danger + 0.03 * condSev('me', 'injured') };
}

function scavSearch() {
  const sc = S.scav, loc = allLocations().find(l => l.id === sc.loc);
  if (sc.tries <= 0 || sc.ended) return null;
  const tired = exert('dig', 1 + 0.3 * condSev('me', 'injured'));
  if (tired) return { tired };
  sc.tries--;
  if (Math.random() < scavOdds().danger) {
    const hz = loc.hazard;
    // 备着遁地符的，出事时符一燃就钻进地里：人货无损，只是这一趟到此为止
    const dundi = owns('fu_dundi');
    if (dundi) {
      destroyItem(dundi);
      sc.ended = true;
      sc.lines.push({ text: `眼看要出事，你捏碎一张遁地符，身子一沉钻进土里，再冒头已在三里之外。背篓里的东西一样不少，这一趟却只能到此为止。`, cls: 'warn' });
      return { escaped: true };
    }
    // 拾荒遇险多半只是皮肉伤；倒霉时才伤得重
    if (hz.cond && Math.random() < 0.6) addCond('me', hz.cond[0], Math.random() < 0.25 ? hz.cond[1] : 1, `在${loc.name}`);
    if (hz.heat) addHeat(hz.heat);
    if (hz.cost) spend(Math.min(hz.cost, Math.max(0, S.stones)));
    sc.ended = true;
    sc.lines.push({ text: hz.text, cls: 'bad' });
    return { hazard: hz };
  }
  sc.danger += S.flags.thugBoss ? 0.02 : 0.04;
  const mapped = treasureFind(loc.id);
  if (!mapped && Math.random() > loc.find) { sc.lines.push({ text: '翻了半天，一无所获。' }); return { none: true }; }
  // 机遇：偶尔翻出一卷你正缺的高重秘籍（只翻得到这处地方有的那几门）
  const scrolls = mapped ? [] : nextBooks().filter(b => (loc.scrolls || []).includes(b[1]) && !owns(b[0]));
  const scroll = scrolls.length && Math.random() < SCROLL_FIND ? pick(scrolls)[0] : null;
  const id = mapped || scroll || weighted(loc.loot.concat(S.world.stage >= 2 && loc.warLoot ? loc.warLoot : []));
  if (mapped) sc.lines.push({ text: '照着藏宝图，你一锄挖了下去——', cls: 'ok' });
  if (scroll) sc.lines.push({ text: '一只朽烂的经匣里，压着一卷没被虫蛀透的手抄——', cls: 'ok' });
  const extra = {};
  if (ITEMS[id].appraise) extra.fake = !mapped && Math.random() < 0.6;
  const it = makeItem(id, Object.assign(extra, { q: mapped ? rint(55, 85) : rint(15, 70) }));
  if (id === 'yao_core' && loc.id === 'beastcave') adjustRep('yao', -2);
  if (!autoPlace(it, ['basket'])) {
    sc.pending = it.uid;
    sc.lines.push({ text: `找到${itemName(it)}，可背篓放不下了。`, cls: 'warn' });
  } else sc.lines.push({ text: `找到${itemName(it)}。`, cls: 'ok' });
  return { item: it };
}

// 回铺：背篓里的东西搬进库房，放不下的留在地上，再放不下就拿在手上
function endScavenge() {
  itemsIn('basket').forEach(stow);
  if (S.scav.pending && S.items[S.scav.pending] && !S.items[S.scav.pending].pos) destroyItem(S.items[S.scav.pending]);
  delete S.grids.basket;
  S.scav = null;
  checkHeat();
}

// 背篓里放不下的待定物品（未定位）在 UI 中可拖动或丢弃
function pendingScavItem() { return S.scav && S.scav.pending ? S.items[S.scav.pending] : null; }

function netWorth() {
  return S.stones + Object.values(S.items).filter(it => it.pos && it.pos.g !== 'counter')
    .reduce((s, it) => s + knownValue(it), 0);
}
