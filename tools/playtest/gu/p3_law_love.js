// ───── 第三段：执法堂与情蛊同命（从同一份真实存档起；察觉与否看真随机，每回从存档重开，像玩家读档重来） ─────
const SAVE = window.__SAVE;
function fresh() { localStorage.setItem(SAVE_KEY, SAVE); load(); enterGame(); closeModal(); sel = null; renderAll(); }
const openP = pid => HANDLERS.person({ dataset: { pid } });
const potOf = () => gridOf(S.machines.find(m => m.type === 'gupot'), 'pot');
function takeGrown() {
  const g = itemsIn(potOf()).filter(x => x.id === 'gu' && x.growth >= 100 && guStage(x) <= guLv()).sort((a, b) => b.tox - a.tox)[0];
  if (!g) return giveItem('gu', { growth: 100, tox: 40 });
  pick(g); click('move-to', { g: 'store' }); return S.items[g.uid];
}
function plantVia(p, it) {
  openP(p.pid);
  if (!click('plant-open', { pid: p.pid })) { closeModal(); return { noButton: true }; }
  const btn = qa(`[data-act="plant-do"][data-uid="${it.uid}"]`)[0];
  if (!btn) { closeModal(); return { notListed: true }; }
  if (btn.disabled) { const why = (btn.closest('.lace-row').querySelector('.bad') || {}).textContent; closeModal(); return { blocked: why }; }
  const shown = +(btn.textContent.match(/成算 (\d+)%/) || [0, 0])[1];
  btn.click(); const text = modalText(); settle();
  return { done: true, odds: shown, text };
}

// ── H. 给厉寒下蛊被察觉、关注不到 100：几日后冷翡到任 ──
let caughtRun = null, attempts = 0;
const reachLaw = () => { if (npcLevel(S.people.enforcer) > guReach()) { S.cult.lv = Math.max(S.cult.lv, 2); S.tech.gumaster = 4; S.guXp = Math.max(S.guXp, GU_XP[4]); } };
for (; attempts < 30 && !caughtRun; attempts++) {
  fresh(); reachLaw(); if (attempts === 0) accel(`厉寒是${realmName(npcLevel(S.people.enforcer))}：修为补到筑基、蛊虫精通补到四重才下得了（Codex 那局第 60 日仍是炼气、三重）`);
  const enf = S.people.enforcer, heat0 = S.heat;
  const r = plantVia(enf, takeGrown());
  if (r.noButton || r.blocked) { note(`厉寒：${r.blocked || '没有下蛊按钮'}`); break; }
  if (/察觉/.test(r.text) && !S.over) caughtRun = { heat0, heat1: S.heat, text: r.text, ok: guBound(enf), over: S.over && S.over.title };
}
check('给执法堂巡查下蛊：有时被察觉（读档重来）', !!caughtRun, `第 ${attempts} 回被察觉`);
if (caughtRun) {
  check('被察觉：关注大涨 +45', caughtRun.heat1 - caughtRun.heat0 >= 45 || caughtRun.heat1 >= 80, `${caughtRun.heat0} → ${caughtRun.heat1}；${caughtRun.text.split('\n').pop()}`);
  check('关注没到 100：没被锁拿', !caughtRun.over, caughtRun.over || '照常营业');
  // 她登门那天：开门第一位客人就是她，柜前的故事对白里有她的自报家门
  let arrived = null, arriveText = '';
  const grab = bs => { const t = modalText(); if (/冷翡/.test(t) && !arrived) { arrived = S.day; arriveText = t; } return bs[0]; };
  for (let d = 0; d < 6 && !S.over && !arrived; d++) day({ choose: grab });
  check('几日后执法堂换人：冷翡登门到任', !!arrived, `第 ${arrived} 日（下蛊在第 ${S.flags.guCaught} 日）；${arriveText.slice(0, 60)}`);
  check('厉寒“告了病假”离开，巡查换成冷翡', S.people.enforcer.status === 'gone' && official('enforcer').pid === 'leng_fei', `厉寒 ${S.people.enforcer.status}；巡查 ${official('enforcer').name}`);
  // 巡查真的由她来：触发一次巡查
  S.flags.forceInspect = true; accel('让人往执法堂递一回状子，好看看来查的是谁（状子第二天才见效）');
  let inspector = null;
  const seeInspect = c => { if (c.kind === 'inspect') { inspector = c.name; click('inspect'); settle(); if (S.customer === c) click('dismiss'); return true; } return false; };
  for (let d = 0; d < 3 && !inspector && !S.over; d++) day({ onCustomer: seeInspect, morning: () => { if (S.customer && S.customer.kind === 'inspect') inspector = S.customer.name; } });
  check('往后来查铺子的是冷翡', inspector === '冷翡', `来查的是 ${inspector}`);
  check('冷翡不在攻略的人物表里（隐藏）', true, '攻略只列非 hidden 人物（guide check 断言过）');

  // ── I. 冷翡中情蛊：关注再高也锁不了你 ──
  const LF = S.people.leng_fei;
  check('冷翡与你打过照面，可以下蛊', LF.visits > 0, `见过 ${LF.visits} 回`);
  let lg = giveItem('love_gu'); accel('给一对情蛊（F 段已验过能炼出来）');
  if (techLv('gumaster') < 3) { S.tech.gumaster = 3; accel('蛊虫精通补到三重'); }
  let t = 0;
  for (; t < 10 && !LF.loveGu && !S.over; t++) {
    if (!(lg.uid in S.items)) lg = giveItem('love_gu');
    const r = plantVia(LF, lg); note(`对冷翡下情蛊：${r.blocked || `成算 ${r.odds}% → ${LF.loveGu ? '中了' : '没中'}`}${/察觉/.test(r.text || '') ? '（又被察觉）' : ''}`);
    if (!LF.loveGu && !S.over) day();
  }
  check('冷翡中了情蛊', !!LF.loveGu, `试了 ${t} 回；${S.over ? '途中' + S.over.title : ''}`);
  check('冷翡见了你：脸红（专画的 smitten 立绘）', personFace(LF) === 'leng_fei~smitten' && ART_SET.has('chars/leng_fei_smitten'), personFace(LF));
  if (LF.loveGu && !S.over) {
    // 关注拉到满：陈列违禁品、闯鬼市都会涨，这里直接加到 160 再过几夜
    addHeat(160); accel('关注直接加到 160（真玩要好些天的违禁陈列）');
    const h = S.heat;
    for (let d = 0; d < 3 && !S.over; d++) { addHeat(60); day(); }
    check('冷翡中了情蛊：关注过百也不锁拿', !S.over, `加关注后 ${h}，三夜各再 +60，结局 ${S.over ? S.over.title : '无，照常营业'}，现在关注 ${S.heat}`);
    check('冷翡对你的铺子一律放行', tolerance(LF) === 'ignore', tolerance(LF));
  }
}

// ── J. 对照：关注已高时下蛊被察觉——当场锁拿，不会换人 ──
let jailed = null;
for (let k = 0; k < 30 && !jailed; k++) {
  fresh(); reachLaw(); S.heat = 60; S.flags.savior = 0; if (k === 0) accel('对照局：关注先设到 60，收走护身符（不然有恩人替你挡）');
  const r = plantVia(S.people.enforcer, takeGrown());
  // 关注一过百，锁拿的结局画面会盖住下蛊的结果：直接看结局
  if (S.over || /察觉/.test(r.text || '')) jailed = { over: S.over && S.over.title, swap: S.flags.lawSwap, screen: !!q('#modal-layer .ending') && q('#modal-layer .ending h2').textContent };
}
check('关注已高时被察觉：当场锁拿入狱，没有隐藏剧情', jailed && jailed.over === '锁拿入狱' && !jailed.swap && jailed.screen === '锁拿入狱', jailed ? `${jailed.over}；结局画面「${jailed.screen}」；换人 ${!!jailed.swap}` : '三十回都没被察觉');

// ── K. 情蛊同命：她死了，你也死（夜里截杀她，按界面） ──
fresh();
{
  if (techLv('gumaster') < 3) S.tech.gumaster = 3;
  S.cult.lv = 3; accel('修为补到金丹：截杀她时你自己别先死在打斗里');
  const W = Object.values(S.people).filter(p => p.status === 'alive' && p.visits && isAdultWoman(p) && !p.official && !p.story && npcLevel(p) <= S.cult.lv)[0];
  let lg = giveItem('love_gu');
  for (let t = 0; t < 10 && !W.loveGu && !S.over; t++) { if (!(lg.uid in S.items)) lg = giveItem('love_gu'); plantVia(W, lg); if (!W.loveGu) day(); }
  check('（同命）先给她种上情蛊', !!W.loveGu, W.name);
  let tries = 0, ended = null;
  for (; tries < 10 && !S.over; tries++) {
    day({ night: () => {
      openP(W.pid);
      const b = qa(`[data-act="ambush"][data-pid="${W.pid}"]`)[0];
      if (!b || b.disabled) { note(`截杀${W.name}：${b ? b.title : '没有截杀按钮'}`); closeModal(); return; }
      b.click();
      if (S.over) window.__endScreen = !!q('#modal-layer .ending') && q('#modal-layer .ending h2').textContent;
      settle();
    } });
  }
  ended = S.over;
  const endingShown = /情蛊同命/.test(window.__endScreen || '');
  check('她死了，你也死：新结局“情蛊同命”', ended && ended.cause === 'lovegu' && W.status === 'dead', ended ? `${ended.title}（截杀 ${tries} 夜）` : `${tries} 夜没截杀成`);
  check('结局画面（.ending）的标题是“情蛊同命”，下一局的提示不报错', endingShown && !window.__pageErr, `截杀那一下弹出的结局画面标题：${window.__endScreen}`);
  if (ended) note('结局文字：' + ended.text);
}
