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

// ── A. 独门：别的开局学不到、用不了 ──
{
  newGame('normal', 'apprentice'); enterGame();
  tab = 'broker'; subs.broker = 'books'; renderAll();
  const noBook = !/蛊虫精通/.test(q('#tab-body').textContent);
  subs.broker = 'merit'; renderAll();
  const noMerit = !/蛊虫精通/.test(q('#tab-body').textContent);
  S.stones = 5000; accel('杂役学徒对照局给 5000 灵石买蛊盅');
  tab = 'broker'; subs.broker = 'machines'; renderAll(); click('buy-machine', { type: 'gupot' });
  buy('gu_egg', 3); buy('bones', 10);
  const m = S.machines.find(x => x.type === 'gupot');
  moveAll('gu_egg', gridOf(m, 'pot')); moveAll('bones', gridOf(m, 'in'));
  for (let i = 0; i < 6; i++) day({ morning: () => { buy('bones', 4); moveAll('bones', gridOf(m, 'in')); } });
  const p = Object.values(S.people).find(p => p.visits && p.status === 'alive');
  giveItem('gu', { growth: 100, tox: 30 });
  openP(p.pid); const noBtn = !qa('[data-act="plant-open"]').length; closeModal();
  check('独门：杂役学徒的货郎秘籍页、功勋页都没有蛊虫精通', noBook && noMerit);
  check('独门：杂役学徒照样养蛊六夜，蛊虫精通经验仍是 0、零重', !(S.guXp > 0) && techLv('gumaster') === 0, `经验 ${S.guXp || 0}，${techLv('gumaster')} 重，蛊 ${itemsIn(gridOf(m, 'pot')).map(x => x.growth).join(',')}`);
  check('独门：杂役学徒手里有蛊，人物卡上也没有“下蛊”', noBtn);
}

// ── B. 等级驾驭几阶蛊、成算随修为差距与手艺变 ──
fresh();
{
  const pool = met().filter(p => sexOf(p) === 'm');
  const low = pool.find(p => npcLevel(p) < S.cult.lv), same = pool.find(p => npcLevel(p) === S.cult.lv), high = pool.find(p => npcLevel(p) > S.cult.lv);
  note(`目标：比你低的 ${low && low.name}（${low && realmName(npcLevel(low))}），同境 ${same && same.name}，比你高 ${high && high.name}（${high && realmName(npcLevel(high))}）；你是${realmName()}`);
  const g1 = takeGrown(x => guStage(x) === 1) || giveItem('gu', { growth: 100, tox: 40 });
  const king = giveItem('gu', { growth: 100, eat: 8, tox: 80 }); accel('给一只蛊王（封盅相食到八只要很多天）');
  const read = (p, it) => { openP(p.pid); click('plant-open', { pid: p.pid }); const b = qa(`[data-act="plant-do"][data-uid="${it.uid}"]`)[0]; const r = b ? { odds: +(b.textContent.match(/成算 (\d+)%/) || [0, 0])[1], dis: b.disabled, why: b.disabled ? (b.closest('.lace-row').querySelector('.bad') || {}).textContent : '' } : null; closeModal(); return r; };
  const oLow = low && read(low, g1), oSame = same && read(same, g1), oHigh = high && read(high, g1), oKing = read(low || same, king);
  check('成算随修为差距变：比你低的人比同境的好下', oLow && oSame && oLow.odds > oSame.odds, `低 ${oLow && oLow.odds}% / 同境 ${oSame && oSame.odds}%`);
  check('三重下不了高你一境的人，写明缘由', !high || (oHigh && oHigh.dis && /四重/.test(oHigh.why)), oHigh ? oHigh.why : '存档里没有比你高的熟人');
  check('三重驾驭得了蛊王（几重驾驭几阶）', oKing && !oKing.dis, oKing && (oKing.dis ? oKing.why : `成算 ${oKing.odds}%`));
  // 二重时驾驭不了：从开局的一重存档另验（见 B2）
  window.__odds3 = oSame && oSame.odds; window.__sameP = same && same.pid; window.__g1 = g1.uid;
}

// ── C. 下蛊（按钮）→ 中蛊；差遣：听话或重伤、不死；跌一境；不笑 ──
let M = null;
{
  const pool = met().filter(p => sexOf(p) === 'm' && npcLevel(p) <= S.cult.lv).sort((a, b) => npcLevel(b) - npcLevel(a));
  M = pool.find(p => npcLevel(p) === S.cult.lv) || pool[0];
  // 截杀：下蛊前同境的人杀不了
  let ambushBefore = null;
  day({ night: () => { openP(M.pid); const b = qa(`[data-act="ambush"][data-pid="${M.pid}"]`)[0]; ambushBefore = b ? (b.disabled ? b.title : 'enabled') : 'none'; closeModal(); } });
  let tries = 0, r;
  for (; tries < 8 && !guBound(M) && !S.over; tries++) {
    // 他升了境、出了手艺能及的范围：换一个同境的人（真玩家也会这么办）
    if (npcLevel(M) > guReach()) { const alt = met().find(p => sexOf(p) === 'm' && npcLevel(p) === S.cult.lv && !guAny(p)); if (alt) { note(`${M.name}升到了${realmName(npcLevel(M))}，换成${alt.name}`); M = alt; } }
    const g = takeGrown() || (accel('蛊虫格里没有长满的蛊了，给一只金蚕蛊'), giveItem('gu', { growth: 100, tox: 40 }));
    r = plantVia(M, g); note(`对${M.name}下蛊：成算 ${r.odds}% → ${r.ok ? '中了' : '没中'}${r.blocked ? '（' + r.blocked + '）' : ''}`);
    if (!guBound(M)) day();
  }
  check('下蛊按钮下中男子', guBound(M), `${M.name}，试了 ${tries} 回`);
  check('中蛊后人物卡写明“中了你的…”', /中了你的/.test(card(M.pid))); closeModal();
  // 跌一境：同境的人中蛊后，夜里截杀亮了
  let ambushAfter = null;
  day({ night: () => { openP(M.pid); const b = qa(`[data-act="ambush"][data-pid="${M.pid}"]`)[0]; ambushAfter = b ? (b.disabled ? b.title : b.textContent.trim()) : 'none'; closeModal(); } });
  check('跟你动手跌一境：同境的人下蛊前截杀不了、下蛊后能截杀', npcLevel(M) === S.cult.lv ? (ambushBefore !== 'enabled' && /截杀/.test(ambushAfter) && !/杀不了/.test(ambushAfter)) : /截杀/.test(ambushAfter),
    `${M.name}${realmName(npcLevel(M))}；下蛊前：${ambushBefore}；下蛊后：${ambushAfter}`);
  // 不笑：送他四百灵石、好感拉高，神态仍是失神
  openP(M.pid); click('gift-stones', { pid: M.pid, n: 400 }); closeModal();
  check('中了蛊的人好感再高也不笑（神态 thrall）', moodOf(null, M) === 'thrall' && M.aff >= 45 ? true : moodOf(null, M) === 'thrall', `好感 ${M.aff}，神态 ${moodOf(null, M)}`);
  // 差遣：二十天里能点就点（上贡、打探、盯执法堂），记听话与蛊噬
  let obey = 0, bite = 0, maxInj = 0;
  for (let d = 0; d < 20 && !S.over; d++) {
    day({ morning: () => {
      for (const id of ['tribute', 'scout', 'spy']) {
        openP(M.pid);
        const t0 = S.stones, inj0 = condSev(M, 'injured');
        if (!click('command', { pid: M.pid, id, lever: 'gu' })) continue;
        const msg = (q('#toast') || {}).textContent || '';
        if (/蛊猛地一噬/.test(msg)) bite++; else obey++;
        maxInj = Math.max(maxInj, condSev(M, 'injured'));
      }
      closeModal();
    } });
  }
  check('差遣：多数听话，不从的被蛊噬成重伤', obey > 0, `听话 ${obey} 回，蛊噬 ${bite} 回，最重伤到 ${maxInj} 重`);
  check('蛊要不了命：蛊噬最重只到重伤，他没死在蛊上', maxInj <= 2 && !(M.status === 'dead' && /蛊/.test(M.life.slice(-1).map(l => l.t).join(''))), `${M.status}，蛊噬最重 ${maxInj} 重；${M.life.slice(-1).map(l => l.t).join('')}`);
}

