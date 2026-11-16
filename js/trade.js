// 交易盘：一位来客可以同时买你几样、卖你几样，谈一个总价——正数是他付你，负数是你付他
'use strict';

function initTrade() {
  if (!S.grids.tray) S.grids.tray = { w: 4, h: 3 };
  S.grids.counter = { w: 4, h: 3 };
}

// 不是他专程来找的，但对他有用的货，只肯出六五成；同样的东西多买一件，就少稀罕一分
const SIDE_BUY = 0.65;
const DUP_DECAY = 0.7;

const goodsOf = () => itemsIn('counter');
const tradeOpen = () => !!S.customer && ['sell', 'buy'].includes(S.customer.kind) && !S.customer.refuse && !S.customer.offended;
const trayItems = () => itemsIn('tray');

// 1 为正中下怀；SIDE_BUY 为顺带捎上；0 为不要
function wantMatch(c, it) {
  const d = ITEMS[it.id];
  if (c.craving && isAddictive(it)) return 1;
  if (c.wishId && it.id === c.wishId) return 1;
  if (c.wantFake) return isFlawed(it) && knownFlaw(it) && d.cat === c.wantCat && (!c.forGift || (it.grade || 1) >= 2) ? 1 : 0;
  if (c.wantId && it.id === c.wantId) return 1;
  if (!c.wantCat || d.tool || d.book || JUNK.includes(it.id) || (it.id === 'intel' && intelExpired(it))) return 0;
  const wants = c.noble ? NOBLE_WANTS : BUY_WANTS[c.faction] || {};
  return wants[d.cat] ? SIDE_BUY : 0;
}

// 这笔交易的全貌：他要的、他不要的、你要收的
function dealOf(c) {
  const take = (c.take || []).map(uid => S.items[uid]).filter(it => it && it.pos && it.pos.g === 'counter').map(it => ({ it, a: it.ask }));
  const give = [], reject = [], seen = {};
  for (const it of trayItems().sort((a, b) => wantMatch(c, b) - wantMatch(c, a))) {
    let m = wantMatch(c, it);
    if (!m) { reject.push(it); continue; }
    if (seen[it.id]) m = Math.min(m, SIDE_BUY) * Math.pow(DUP_DECAY, seen[it.id]);
    seen[it.id] = (seen[it.id] || 0) + 1;
    give.push({ it, m, v: buyerValuation(c, it) * m });
  }
  const V = give.reduce((s, g) => s + g.v, 0), A = take.reduce((s, t) => s + t.a, 0);
  return { give, take, reject, V, A, N0: Math.round(V - A), scale: Math.max(1, V + A) };
}

// 他的盘算：k 为你要价高出公道价的比例。买与卖两头的脾气不同，按份量调和
function dealOdds(c, d, net) {
  const w = d.V / d.scale;
  const k = (net - d.N0) / d.scale * (c.noble ? 0.6 : 1);
  const tired = (4 - c.patience) * 0.08;
  const p = personOf(c);
  const urgent = d.take.some(t => t.it.stolen || ITEMS[t.it.id].contra) || c.wanted || (p && p.desperate) ? 0.15 * (1 - w) : 0;
  if (net > 0 && net > c.budget * 1.02) {
    const leave = clamp(0.35 + (net / c.budget - 1) + tired, 0, 1);
    return { accept: 0, counter: 1 - leave, leave };
  }
  const accept = clamp(0.84 * w + 0.98 * (1 - w) - (1.6 * w + 1.75 * (1 - w)) * k + urgent, 0.02, 0.98);
  const leave = clamp(w * (k - 0.1) * 0.9 + (1 - w) * (k - 0.2) * 1.2 + tired - urgent, 0, 0.9) * (1 - accept);
  return { accept, counter: Math.max(0, 1 - accept - leave), leave };
}

// 一笔买卖件数越多，谈起来越费神
function dealEffort(d) { return 1 + 0.6 * Math.max(0, d.give.length + d.take.length - 1); }

// 他还的价：在你的价和他心里的价之间折个中
function dealCounter(c, d, net) {
  let n = Math.round((net + d.N0) / 2);
  if (n > 0) n = Math.min(n, c.budget);
  return Math.min(n, net);
}

// 摆上货盘：记下原来的位置，没卖出去的放回原处
function toTray(it, x, y) {
  if (it.pos.g !== 'tray') it.from = it.pos;
  placeItem(it, 'tray', x, y);
}

function returnTray() {
  trayItems().forEach(it => {
    const f = it.from;
    delete it.claim; delete it.from;
    if (f && S.grids[f.g] && !rejectReason(f.g, it) && fits(f.g, it, f.x, f.y)) placeItem(it, f.g, f.x, f.y);
    else stow(it);
  });
}

// 出价前先过眼：当真货卖的假货，眼力够的当场看穿，整笔买卖告吹
function dealInspect(c, d) {
  const caught = d.give.find(g => buyerDetectsFake(c, g.it));
  return caught ? caught.it : null;
}

// 成交：总价按各件的分量摊开，逐件交割；卖出去的货出了岔子，他当场翻脸，收货也作罢
function settleDeal(c, d, net) {
  const k = (net - d.N0) / d.scale;
  const prices = d.give.map(g => Math.max(1, Math.round(g.v * (1 + k))));
  const pays = d.take.map(t => Math.max(0, Math.round(t.a * (1 - k))));
  const drift = net - (prices.reduce((a, b) => a + b, 0) - pays.reduce((a, b) => a + b, 0));
  if (prices.length) prices[0] = Math.max(1, prices[0] + drift); else if (pays.length) pays[0] = Math.max(0, pays[0] - drift);
  const out = { sold: [], bought: [], income: 0, paid: 0 };
  for (let i = 0; i < d.give.length; i++) {
    const { it, v } = d.give[i], name = itemName(it);
    const r = completeSale(c, it, prices[i], v);
    if (r.stolenCaught || r.lacedCaught) { out.caught = r.stolenCaught ? 'stolen' : 'laced'; break; }
    out.sold.push(name); out.income += prices[i];
  }
  if (!out.caught) d.take.forEach((t, i) => { completePurchase(c, t.it, pays[i]); out.bought.push(itemName(t.it)); out.paid += pays[i]; });
  c.take = [];
  S.stats.deals = (S.stats.deals || 0) + 1;
  if (d.give.length + d.take.length >= 3) log(`与${c.name}做成一笔大买卖：卖出 ${out.sold.length} 件，收进 ${out.bought.length} 件。`, 'gold');
  return out;
}

function toggleTake(c, uid) {
  c.take = c.take || [];
  const i = c.take.indexOf(uid);
  if (i >= 0) c.take.splice(i, 1); else c.take.push(uid);
}

// 来客想要什么，用一句话说清
function wantText(c) {
  if (c.craving) return '忘忧散（或掺了它的东西）';
  if (c.wishId) return ITEMS[c.wishId].name;
  if (c.forGift) return `送礼用的高仿${CATS[c.wantCat]}（做工寻常以上，你知道是假的）`;
  if (c.wantFake) return `能以假乱真的${CATS[c.wantCat]}`;
  if (c.wantId) return `${ITEMS[c.wantId].name}（${CATS[c.wantCat]}）`;
  return c.wantCat ? CATS[c.wantCat] : '';
}
