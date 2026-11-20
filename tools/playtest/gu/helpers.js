// 在真浏览器里按界面按钮玩养蛊人，逐项验证蛊虫精通、下蛊、情蛊、执法堂隐藏线。
// 能点按钮的都点按钮；不得不直接改状态的（加速）一律记进 log，标“加速”。
window.confirm = () => true; window.alert = () => {};
const L = [], checks = [];
const note = t => L.push(`d${S.day} ${t}`);
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 220) }); note(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };
const accel = t => note(`加速：${t}`);
const q = s => document.querySelector(s);
const qa = s => [...document.querySelectorAll(s)];
// 点一颗按钮：按 data-act 与 data-* 找，必须看得见、没禁用
function click(act, data = {}) {
  const el = qa(`[data-act="${act}"]`).find(e => !e.disabled && Object.entries(data).every(([k, v]) => e.dataset[k] == String(v)));
  if (!el) return false;
  el.click(); return true;
}
// 列表分页时一页页翻着找按钮（货郎的货品、设备都分页）
function clickPaged(act, data, key) {
  for (let pg = 0; pg < 30; pg++) {
    if (click(act, data)) return true;
    if (!click('page', { key, d: 1 })) break;
  }
  pages[key] = 0; renderAll(); return false;
}
const modalOn = () => !!q('#modal-layer.on');
const modalText = () => (q('#modal-layer') || {}).textContent || '';
const pick = it => { sel = it.uid; renderAll(); };   // 等同点选一件货
// 把弹窗一路点掉：故事抉择按 choose 挑（默认第一个能点的），其余点“继续/好/合上”
function settle(choose = bs => bs[0]) {
  for (let i = 0; i < 40 && modalOn(); i++) {
    if (q('#ending, .ending') || S.over) return;
    const bs = qa('#modal-layer [data-act="story-choose"]').filter(b => !b.disabled);
    if (bs.length) { choose(bs).click(); continue; }
    if (['story-done', 'report-ok', 'modal-close', 'land-ok', 'landlord-ok'].some(a => click(a))) continue;
    const one = qa('#modal-layer button').filter(b => !b.disabled);
    if (one.length) one[one.length - 1].click(); else break;
  }
}
// 手上放不下的货：先整理库房，还放不下就点选它“卖给货郎”（玩家也只能这么腾地方）
function clearHand() {
  if (!itemsIn('hand').length) return;
  click('tidy');
  for (const it of itemsIn('hand')) { pick(it); if (!click('sell-broker')) { const p = findSpot('floor', it); if (p) placeItem(it, 'floor', p.x, p.y); } }
  // 库房太挤也卖掉些不要紧的杂货，留出空位
  if (itemsIn('store').length > 30) for (const it of itemsIn('store').filter(x => (JUNK.includes(x.id) && x.id !== 'broken_relic') || ['scroll_manual', 'demon_charm', 'broken_bowl'].includes(x.id)).slice(0, 8)) { pick(it); click('sell-broker'); }
  sel = null; renderAll();
}
// 过一天：开门，客人：故事去谈、巡查配合、其余送客；打烊、入夜、看报告
function day(opts = {}) {
  if (S.over) return;
  const d0 = S.day;
  try { dayInner(opts); } finally { if (S.day === d0 && !S.over && (window.__stuck = (window.__stuck || 0) + 1) <= 3) note(`日子没往前走：phase ${S.phase} hand ${itemsIn('hand').length} customer ${S.customer && S.customer.kind} queue ${S.queue.length} modal ${modalOn()} [${modalText().slice(0, 60)}] toast ${(q('#toast') || {}).textContent}`); }
}
window.__rentTopUps = 0;
function dayInner(opts) {
  { const need = Math.max(rentAmount(), S.rentOwed || 0) + 300; if (window.__keepAlive && (S.grace > 0 || S.day + 2 >= S.rentDue) && S.stones < need) { window.__rentTopUps += need - S.stones; S.stones = need; } }
  // 测的不是怎么躲执法堂：关注过 70 就压回 40（真玩家会打点、收手），记下压了几回
  if (window.__keepAlive && S.heat > 70) { window.__heatCuts = (window.__heatCuts || 0) + 1; window.__heatMax = Math.max(window.__heatMax || 0, S.heat); S.heat = 40; }
  if (window.__keepAlive && S.stones < 300) { window.__rentTopUps += 500; S.stones += 500; }
  clearHand();
  if (opts.morning) opts.morning();
  clearHand();
  click('open'); settle(opts.choose);
  for (let k = 0; k < 40 && !S.over; k++) {
    if (!S.customer) { if (!S.queue.length) break; click('next'); settle(opts.choose); continue; }
    const c = S.customer;
    if (opts.onCustomer && opts.onCustomer(c)) { settle(opts.choose); continue; }
    if (c.kind === 'story') { click('story-talk'); settle(opts.choose); }
    else if (c.kind === 'inspect') { click('inspect'); settle(); if (S.customer === c) click('dismiss'); }
    else click('dismiss');
    settle(opts.choose);
    if (S.customer === c) { dismissCustomer(false); renderAll(); }
  }
  if (S.over) return;
  if (opts.evening) opts.evening();
  clearHand(); click('close'); settle();
  if (opts.night && !S.over) { opts.night(); settle(opts.choose); }
  clearHand(); click('sleep'); settle(opts.choose);
}
// 送礼：打开送礼单，一页页翻，找到这件货那一行点下去
function giftVia(p, uid) {
  HANDLERS.person({ dataset: { pid: p.pid } });
  pages[`gift-${p.pid}`] = 0;
  if (!click('gift-open', { pid: p.pid })) { closeModal(); return 'no-gift-button'; }
  for (let pg = 0; pg < 30; pg++) {
    if (click('gift-give', { pid: p.pid, uid })) return (q('#toast') || {}).textContent || 'given';
    if (!click('page', { key: `gift-${p.pid}`, d: 1 })) break;
  }
  closeModal(); return 'not-listed';
}
// 货郎买货：按名字找那一行的买按钮
function buy(id, n) {
  tab = 'broker'; subs.broker = 'goods'; renderAll();
  let got = 0;
  for (let k = 0; k < n; k++) {
    const i = S.supply.findIndex(e => e.id === id && e.stock > 0);
    pages['broker-goods'] = 0; renderAll();
    if (i < 0 || !clickPaged('buy-supply', { i }, 'broker-goods')) break;
    got++;
  }
  return got;
}
// 把库房里的某样货挪进某格（点选它，再点“放进…”）
function moveAll(id, gid, n = 99) {
  let moved = 0;
  for (let k = 0; k < n; k++) {
    const it = Object.values(S.items).find(x => x.id === id && x.pos && ['store', 'floor', 'hand'].includes(x.pos.g));
    if (!it) break;
    pick(it);
    if (!click('move-to', { g: gid })) { sel = null; break; }
    moved++;
  }
  return moved;
}
