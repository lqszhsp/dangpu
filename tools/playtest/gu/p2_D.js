// ───── 第二段：从 Codex 养蛊人第 30 日的真实存档起，按界面把蛊虫精通的每一项设定都触发一遍 ─────
const SAVE = window.__SAVE;
function fresh() { localStorage.setItem(SAVE_KEY, SAVE); load(); enterGame(); closeModal(); sel = null; renderAll(); }
const openP = pid => HANDLERS.person({ dataset: { pid } });   // 与在「人物」页点他的卡片同一个处理
const card = pid => { openP(pid); return modalText(); };
const met = () => Object.values(S.people).filter(p => p.status === 'alive' && p.visits && !p.official && !p.story);
const potOf = () => gridOf(S.machines.find(m => m.type === 'gupot'), 'pot');
// 从蛊虫格里取一只长满的蛊放进库房（下蛊要拿在手上）
function takeGrown(pred = g => true) {
  const g = itemsIn(potOf()).filter(x => x.id === 'gu' && x.growth >= 100 && pred(x)).sort((a, b) => b.tox - a.tox)[0];
  if (!g) return null;
  pick(g); click('move-to', { g: 'store' }); return S.items[g.uid];
}
// 在人物卡上点“下蛊”，选这只蛊，读按钮上的成算，再点下去
function plantVia(p, it) {
  openP(p.pid);
  if (!click('plant-open', { pid: p.pid })) { closeModal(); return { noButton: true }; }
  const btn = qa(`[data-act="plant-do"][data-uid="${it.uid}"]`)[0];
  if (!btn) { closeModal(); return { notListed: true }; }
  const shown = (btn.textContent.match(/成算 (\d+)%/) || [])[1], why = btn.disabled ? (btn.closest('.lace-row').querySelector('.bad') || {}).textContent : null;
  if (btn.disabled) { closeModal(); return { blocked: why, odds: shown }; }
  btn.click();
  const text = modalText(); settle();
  return { done: true, odds: +shown, text, ok: guBound(p) || !!p.loveGu };
}

window.__keepAlive = true;
fresh();
check('载入 Codex 养蛊人第 30 日的真实存档', S.day === 30 && techLv('gumaster') === 3 && S.start === 'gu', `第 ${S.day} 日，蛊虫精通 ${techLv('gumaster')} 重，经验 ${S.guXp}，灵石 ${S.stones}，修为 ${realmName()}`);

window.__keepAlive = true;
let M = null;
// ── D. 中蛊的人多半抹掉对你不利的事：送掺忘忧散的礼，比被识破几率 ──
fresh();
{
  // 鬼市买忘忧散（夜里去）
  let bought = 0;
  for (let d = 0; d < 4 && bought < 8 && !S.over; d++) day({ night: () => {
    if (!click('market')) return;
    const i = dealerStock('ghost').offers.findIndex(o => o.id === 'wangyou' && o.lots > 0);
    while (i >= 0 && dealerStock('ghost').offers[i].lots > 0 && click('mk-buy', { k: 'ghost', i })) bought += dealerStock('ghost').offers[i].lot;
    closeModal();
  } });
  const wy = () => Object.values(S.items).filter(x => x.id === 'wangyou' && HELD(x)).length;
  if (wy() < 4) { for (let i = wy(); i < 4; i++) giveItem('wangyou'); accel(`鬼市这几夜只买到 ${bought} 份忘忧散，补到 4 份`); }
  // 对照两组：中了蛊的（再下几个）与没中蛊的
  const guGroup = [], plain = [];
  for (const p of met().filter(p => p !== M && npcLevel(p) <= S.cult.lv && sexOf(p) === 'm')) {
    if (guGroup.length >= 3) break;
    if (guBound(p)) { guGroup.push(p); continue; }
    const g = takeGrown() || giveItem('gu', { growth: 100, tox: 40 });
    for (let t = 0; t < 4 && !guBound(p); t++) { plantVia(p, S.items[g.uid] ? g : (takeGrown() || giveItem('gu', { growth: 100, tox: 40 }))); if (!guBound(p)) day(); }
    if (guBound(p)) guGroup.push(p);
  }
  for (const p of met()) if (!guAny(p) && plain.length < 3 && p.savvy >= 0.4) plain.push(p);
  const fruit = () => { buy('spirit_fruit', 1); return Object.values(S.items).find(x => x.id === 'spirit_fruit' && HELD(x) && !x.laced); };
  const laceOne = () => { const f = fruit(); if (!f) return null; pick(f); click('lace'); const a = Object.values(S.items).find(x => x.id === 'wangyou' && HELD(x)); if (!a || !click('lace-do', { uid: a.uid })) { closeModal(); return null; } return f; };
  const tally = { gu: [0, 0], plain: [0, 0] };
  for (let d = 0; d < 10 && !S.over; d++) {
    day({ morning: () => {
      for (const [k, grp] of [['gu', guGroup], ['plain', plain]]) for (const p of [...new Set(grp)]) {
        if (!canGift(p)) { note(`${p.name}今日不能送礼`); continue; }
        if (wy() < 2) { giveItem('wangyou'); giveItem('wangyou'); }
        const f = laceOne(); if (!f) continue;
        const res = giftVia(p, f.uid);
        if (res === 'no-gift-button' || res === 'not-listed') { note(`送${p.name}：${res}`); continue; }
        tally[k][0]++; if (/动了手脚/.test(res)) tally[k][1]++;
        closeModal();
      }
    } });
  }
  const shownOdds = p => { const f = Object.values(S.items).find(x => x.laced === 'addict' && x.lacedBy === 'me' && HELD(x)) || (() => { buy('spirit_fruit', 1); const t = Object.values(S.items).find(x => x.id === 'spirit_fruit' && HELD(x) && !x.laced) || giveItem('spirit_fruit'); const a = Object.values(S.items).find(x => x.id === 'wangyou' && HELD(x)) || giveItem('wangyou'); pick(t); click('lace'); click('lace-do', { uid: a.uid }); return t; })();
    pages[`gift-${p.pid}`] = 0; HANDLERS.person({ dataset: { pid: p.pid } }); if (!click('gift-open', { pid: p.pid })) { closeModal(); return null; }
    for (let pg = 0; pg < 30; pg++) { const row = qa(`[data-act="gift-give"][data-uid="${f.uid}"]`)[0]; if (row) { const m = row.textContent.match(/识破 (\d+)%/); closeModal(); return m ? +m[1] : 0; } if (!click('page', { key: `gift-${p.pid}`, d: 1 })) break; }
    closeModal(); return null; };
  day();
  const oddsGu = guGroup.filter(p => p.status === 'alive').map(p => [p.name, shownOdds(p)]), oddsPlain = plain.filter(p => p.status === 'alive').map(p => [p.name, shownOdds(p)]);
  const avg = l => l.filter(x => x[1] != null).reduce((s, x) => s + x[1], 0) / Math.max(1, l.filter(x => x[1] != null).length);
  check('送礼单上标的识破几率：中蛊的人明显低于没中蛊的人', oddsGu.filter(x => x[1] != null).length && oddsPlain.filter(x => x[1] != null).length && avg(oddsGu) < avg(oddsPlain) * 0.7, `中蛊 ${oddsGu.map(x => x.join(' ') + '%').join('，')}；没中蛊 ${oddsPlain.map(x => x.join(' ') + '%').join('，')}`);
  note(`送掺料的礼：中蛊的 ${guGroup.map(p => p.name).join('、')}；没中蛊的 ${plain.map(p => p.name).join('、')}`);
  note('实送：' + JSON.stringify(tally)); check('（参考）实送掺料礼的识破次数', true,
    `中蛊 ${tally.gu[1]}/${tally.gu[0]} 次识破；没中蛊 ${tally.plain[1]}/${tally.plain[0]} 次识破`);
  check('中蛊的人吃了掺忘忧散的礼，照样上瘾', guGroup.some(p => p.addict > 0), guGroup.map(p => `${p.name}瘾${p.addict || 0}`).join('，'));
}

