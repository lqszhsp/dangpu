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
// ── E. 蛊可加料：给蛊掺忘忧散（加料按钮），下中时料一并入体 ──
fresh();
{
  const target = met().find(p => !guAny(p) && npcLevel(p) <= S.cult.lv && !(p.addict > 0) && sexOf(p) === 'm');
  let g = takeGrown() || (accel('给一只金蚕蛊'), giveItem('gu', { growth: 100, tox: 40 }));
  if (!Object.values(S.items).some(x => x.id === 'wangyou' && HELD(x))) giveItem('wangyou');
  pick(g); const hasBtn = click('lace'); const listed = qa('[data-act="lace-do"]').map(b => S.items[b.dataset.uid] && S.items[b.dataset.uid].id);
  const a = Object.values(S.items).find(x => x.id === 'wangyou' && HELD(x)); click('lace-do', { uid: a.uid });
  check('蛊身上能加料（选中蛊点“加料”），掺料列表里没有蛊自己', hasBtn && g.laced === 'addict' && !listed.includes('gu'), `加料后：${g.laced}；可掺：${[...new Set(listed)].join(',')}`);
  let r;
  for (let t = 0; t < 6 && !guBound(target) && !S.over; t++) {
    if (!S.items[g.uid]) { g = takeGrown() || giveItem('gu', { growth: 100, tox: 40 }); pick(g); click('lace'); const a2 = Object.values(S.items).find(x => x.id === 'wangyou' && HELD(x)) || giveItem('wangyou'); click('lace-do', { uid: a2.uid }); }
    r = plantVia(target, g); note(`对${target.name}下掺料的蛊：${r.blocked || r.notListed && '不在单子上' || r.noButton && '没有下蛊按钮' || `成算 ${r.odds}% → ${guBound(target) ? '中了' : '没中'}`}`); if (!guBound(target)) day();
  }
  check('掺了料的蛊下中：料效一并生效（对方上了忘忧散的瘾）', guBound(target) && target.addict > 0, `${target.name}：中蛊 ${guBound(target)}，瘾 ${target.addict || 0}；${(r && r.text || '').slice(-30)}`);
}

