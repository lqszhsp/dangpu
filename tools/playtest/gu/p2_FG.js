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
// ── F. 情蛊：三重时买妖植盆种迷魂花，花放进蛊盅，金蚕蛊化为一对情蛊 ──
fresh();
{
  const xp0 = S.guXp;
  if (S.stones < machinePrice('yaopot') + 100) { accel(`灵石 ${S.stones} 不够买妖植盆，补到 ${machinePrice('yaopot') + 300}`); S.stones = machinePrice('yaopot') + 300; }
  tab = 'broker'; subs.broker = 'machines'; pages['broker-machines'] = 0; renderAll();
  const boughtPot = clickPaged('buy-machine', { type: 'yaopot' }, 'broker-machines');
  const yp = S.machines.find(m => m.type === 'yaopot');
  if (!yp) throw new Error('妖植盆没买成：' + (q('#toast') || {}).textContent);
  buy('mihun_seed', 2); moveAll('mihun_seed', gridOf(yp, 'in'));
  let days = 0;
  for (; days < 5 && !Object.values(S.items).some(x => x.id === 'mihun_flower') && !S.over; days++) day();
  const flower = Object.values(S.items).find(x => x.id === 'mihun_flower');
  check('妖植盆种迷魂花（货郎买种子）', boughtPot && !!flower, `${days} 夜后开花`);
  const gp = S.machines.find(m => m.type === 'gupot');
  if (!itemsIn(potOf()).some(x => x.id === 'gu' && guStage(x) === 1 && !x.eat)) { giveItem('gu', { growth: 100, tox: 45 }); accel('盅里没有金蚕蛊了，补一只'); moveAll('gu', potOf(), 1); }
  // 迷魂花长在妖植盆的产出格里：选中它，点“放进蛊盅”
  { const fl = Object.values(S.items).find(x => x.id === 'mihun_flower' && x.pos); if (fl) { pick(fl); note('放迷魂花进蛊盅：' + click('move-to', { g: gridOf(gp, 'in') })); } }
  day();
  const love = Object.values(S.items).filter(x => x.id === 'love_gu');
  check('迷魂花饲金蚕：产物格里出了一对情蛊，蛊虫精通涨经验', love.length >= 1 && S.guXp > xp0, `情蛊 ${love.length} 对，经验 ${xp0}→${S.guXp}`);
}

// ── G. 情蛊只认成年女子、一生一人；好感锁满、无负面；见了你脸红 ──
let W = null;
fresh();
{
  let lg = Object.values(S.items).find(x => x.id === 'love_gu' && HELD(x));
  if (lg && lg.pos.g !== 'store') { pick(lg); click('move-to', { g: 'store' }); }
  lg = lg || (accel('给一对情蛊'), giveItem('love_gu'));
  const man = met().find(p => sexOf(p) === 'm' && !guAny(p));
  const rMan = plantVia(man, lg);
  check('情蛊对男子：列出来但下不了，写明只认成年女子', rMan.blocked && /成年女子/.test(rMan.blocked), rMan.blocked);
  const minor = Object.values(S.people).find(p => p.status === 'alive' && p.visits && isMinor(p) && sexOf(p) === 'f');
  if (minor) { const rMinor = plantVia(minor, lg); check('情蛊对未成年少女：根本不列出来', rMinor.notListed || rMinor.noButton, `${minor.name}（${minor.title}）：${rMinor.notListed ? '不列' : rMinor.noButton ? '没有下蛊按钮' : JSON.stringify(rMinor)}`); }
  else note('存档里没见过未成年少女，这项改在下面用新人物验');
  const women = met().filter(p => isAdultWoman(p) && npcLevel(p) <= S.cult.lv);
  W = women[0];
  let tries = 0;
  for (; tries < 8 && !W.loveGu && !S.over; tries++) {
    if (!S.items[lg.uid]) lg = Object.values(S.items).find(x => x.id === 'love_gu' && HELD(x)) || giveItem('love_gu');
    const r = plantVia(W, lg); note(`对${W.name}下情蛊：成算 ${r.odds}% → ${W.loveGu ? '中了' : '没中'}${r.blocked ? '（' + r.blocked + '）' : ''}`);
    if (!W.loveGu) day();
  }
  check('情蛊下中成年女子：好感拉满', !!W.loveGu && W.aff === 100, `${W.name}（${W.title}），试了 ${tries} 回，好感 ${W.aff}`);
  const W2 = women.find(p => p !== W) || (() => { const p = newPerson('xian', { sex: 'f', portrait: 'xian_spy' }); p.visits = 1; accel('再造一位见过面的成年女子'); return p; })();
  const lg2 = giveItem('love_gu'); accel('再给一对情蛊，验“一生只认一人”');
  const r2 = plantVia(W2, lg2);
  check('情蛊一生只认一人：第二位女子下不了', r2.blocked && /一生只认一人/.test(r2.blocked), r2.blocked);
  // 锁满：掺料的礼她一回也没识破，好感一直是 100
  let caught = 0, gifts = 0;
  for (let d = 0; d < 5 && !S.over; d++) day({ night: () => note(`夜里 ${W.name}：${W.status} 体 ${W.health} 瘾 ${W.addict || 0} 伤 ${JSON.stringify(W.conds || {})} 近事 ${W.life.slice(-1).map(l => l.t).join('')}`), morning: () => {
    if (!canGift(W)) return;
    buy('spirit_fruit', 1); const f = Object.values(S.items).find(x => x.id === 'spirit_fruit' && HELD(x) && !x.laced);
    const a = Object.values(S.items).find(x => x.id === 'wangyou' && HELD(x)) || giveItem('wangyou');
    pick(f); click('lace'); click('lace-do', { uid: a.uid });
    const res = giftVia(W, f.uid); if (res !== 'no-gift-button' && res !== 'not-listed') gifts++;
    if (/动了手脚/.test(res)) caught++;
  } });
  remember(W, '（测试）你当众驳了她的面子。', -60); accel('直接扣她 60 好感，验锁');
  check('情蛊的她：掺料的礼一回没识破，好感锁在 100', caught === 0 && W.aff === 100, `送 ${gifts} 回，识破 ${caught} 回，好感 ${W.aff}`);
  check('情蛊的她：神态脸红（有专画的用 smitten，没画的先用高兴）', ['smitten', 'pleased'].includes(moodOf(null, W)) && moodOf(null, W) !== 'thrall', `${W.name} 的神态 ${moodOf(null, W)}（${ART_SET.has('chars/' + faceOf(W) + '_smitten') ? '有专画' : '暂无专画，用高兴'}）`);
  check('情蛊的她在人物卡上写明同命', /死你也活不成/.test(card(W.pid))); closeModal();
}

window.__W = W && W.pid;
note(`加速汇总：补了 ${window.__rentTopUps} 灵石（租金与买料），关注压回 ${window.__heatCuts || 0} 回（最高到过 ${window.__heatMax || S.heat}）`);
check('G 段跑完没被扫地出门、没死', !S.over, S.over && `${S.over.title}；${W.name}：${W.status}，${W.life.slice(-2).map(l => l.d + ':' + l.t).join(' | ')}`);
