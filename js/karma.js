// 善恶有报——但这世道不讲理：做好人要掏真金白银，善名太盛人人当你好欺负；
// 偶尔，你帮过的人记着你，极少时候，那份回报大得能救你的命。弱者可以帮，也可以榨
'use strict';

function initKarma() {
  if (S.virtue == null) S.virtue = 10;
  S.loans = S.loans || [];
}

// 善名：如实相告、公道买卖、接济弱者会涨；骗人、害人、杀人会跌
function karmaShift(n) { S.virtue = clamp(Math.round(S.virtue + n), 0, 100); }

// 一件善事：记在善名上，也记在对方心里
function goodDeed(p, n) {
  karmaShift(n);
  tally('good', n);
  if (p && !p.official) p.owed = (p.owed || 0) + n;
}

// 善名太盛又没本事：人人当你好欺负。修到金丹，就没人敢了
function softPenalty() { return S.cult.lv >= 3 ? 0 : Math.min(12, Math.floor(S.virtue / 8)); }
// 卖货的人看你老实，开价也敢高些
function softTouch() { return 1 + S.virtue / 400; }

const VIRTUE_NAME = v => v >= 70 ? '活菩萨' : v >= 45 ? '厚道人' : v >= 20 ? '本分' : v >= 8 ? '精明' : '黑心';

function isWeak(p) { return !p.official && !p.noble && npcPower(p) < 20; }

// ───────────── 求助 ─────────────

const PLEAS = ['娘病得下不了床，抓药还差 {n} 灵石', '矿上把工钱克扣了，家里三天没开火，求您借 {n} 灵石',
  '欠了刘癞子的印子钱，再还不上要被打断腿，差 {n} 灵石', '弟弟被丹房抓去试药，赎人要 {n} 灵石'];

function pleaSetup(c, p) {
  c.need = Math.round(rnd(20, 45) * (1 + S.day * 0.02) / 5) * 5;
  c.plea = fill(pick(PLEAS), { n: c.need });
}

function pleaLine(c) { return `（${c.name}扑通一声跪在柜台前）${ADDRESS[c.faction]}……${c.plea}。俺什么都肯干！`; }

// 善名在外，求上门的人也多
function queuePleas() {
  if (Math.random() > S.virtue / 160) return;
  const old = Object.values(S.people).filter(p => p.status === 'alive' && !p.story && isWeak(p) && p.desperate && !p.indentured && !S.queue.some(c => c.pid === p.pid));
  const p = old.length ? pick(old) : newPerson('ren');
  if (!old.length) Object.assign(p, { desperate: true, budgetMul: 0.4 });
  S.queue.splice(rint(0, S.queue.length), 0, makeCustomer(p.faction, 'plea', p));
}

// 接济：掏钱，他念你的好，往后成了你的耳目
function helpWeak(c) {
  const p = personOf(c);
  if (S.stones < c.need) return '灵石不够';
  spend(c.need, `接济${p.name} ${c.need} 灵石。`);
  goodDeed(p, 3);
  Object.assign(p, { informant: true, desperate: false, budgetMul: Math.min(1, p.budgetMul + 0.2) });
  remember(p, '走投无路时，你帮了他一把。', 20, 'helped');
  dismissCustomer(false);
  return null;
}

// 放贷：借他三倍，七日后还一倍半
function lendTo(c) {
  const p = personOf(c), amt = c.need * 3, owe = Math.round(amt * 1.5);
  if (S.stones < amt) return '灵石不够';
  spend(amt, `借给${p.name} ${amt} 灵石，七日后还 ${owe}。`);
  S.loans.push({ pid: p.pid, amt, owe, due: S.day + 7 });
  remember(p, `你借了他 ${amt} 灵石，七日后要还 ${owe}。`, 2);
  karmaShift(-1);
  dismissCustomer(false);
  return null;
}

// 苦力夜里替你烧炉搬货：每人顶 15 点体力
const laborPool = () => Object.values(S.people).filter(p => p.status === 'alive' && p.indentured).length * 15;

// 收作苦力：管口饭，替你搬货烧炉，干到死为止
function indenture(p, why = '为了一口饭，把自己押给了你做苦力。') {
  p.indentured = { day: S.day };
  tally('cruel');
  p.informant = false;
  remember(p, why, -12);
  karmaShift(-5); adjustRep('ren', -1);
  if (S.customer && S.customer.pid === p.pid) dismissCustomer(false);
  return null;
}

function turnAway(c) {
  remember(personOf(c), '求你帮忙，被你撵了出去。', -6);
  karmaShift(-1);
  dismissCustomer(false);
}

function release(p) {
  p.indentured = null;
  remember(p, '你放他走了。', 12);
  goodDeed(p, 2);
}

// ───────────── 讨债 ─────────────

const loanOf = p => S.loans.find(l => l.pid === p.pid);

function collectDebt(p, how) {
  const l = loanOf(p);
  S.loans.splice(S.loans.indexOf(l), 1);
  switch (how) {
    case 'mine': {
      const n = Math.round(80 + l.owe * 0.4);
      earn(n, `把还不上债的${p.name}卖去矿上，得 ${n} 灵石。`);
      p.status = 'gone'; lifeNote(p, '还不上印子钱，被卖去魔宗矿上做苦役。');
      karmaShift(-8); adjustRep(p.faction, -3);
      return `${p.name}被矿上的监工拿铁链锁走了，回头看了你一眼。`;
    }
    case 'labor': indenture(p, '还不上债，被你收作苦力抵债。'); return `${p.name}低着头搬进了你的后院。`;
    case 'extend':
      S.loans.push({ ...l, owe: Math.round(l.owe * 1.2), due: S.day + 7, defaulted: false });
      remember(p, '你宽限了他七日，利滚利。', 2);
      return `宽限七日，欠款涨到 ${Math.round(l.owe * 1.2)}。`;
    case 'forgive':
      goodDeed(p, 4);
      remember(p, `你把他欠的 ${l.owe} 灵石一笔勾销了。`, 30, 'helped');
      return `${p.name}愣了半天，给你磕了三个响头。`;
  }
  return '';
}

// ───────────── 好报 ─────────────

// 大回报：只有混出头的人给得起；给得起的，足以改命
const BOONS = [
  { text: '{n}如今在宗门里说得上话，托人把你铺契的价钱压下了四分之一。', run: () => { S.flags.deedMul *= 0.75; } },
  { text: '{n}送来一道护身符：“哪天大祸临头，拿它来找我。”（可免一次锁拿、驱逐或横死）', run: () => { S.flags.savior = (S.flags.savior || 0) + 1; } },
  { text: '{n}传了你一段压箱底的心法，又送来破境之物。', run: () => { S.cult.xp += Math.round((realm().need || 3000) * 0.7); giveItem(realm().key || 'soul_crystal'); } },
  { text: '{n}托人抬来一件重宝：“当年那份情，我一直记着。”', run: () => giveItem(pick(['god_blank', 'soul_banner', 'demon_blade', 'lens4'])) },
];

// 大回报要两头都硬：他混出了头，你也得强到让人敢把重注押在你身上
const strongEnough = () => S.cult.lv >= 2 || playerPower() >= 45;

function repay(p) {
  const fill_ = t => fill(t, { n: p.name });
  const rich = p.budgetMul >= 1.4 || npcLevel(p) >= 2;
  p.owed = 0;
  if (rich && strongEnough() && Math.random() < 0.15) {
    const b = pick(BOONS);
    b.run();
    remember(p, '报答了你当年的恩情。', 10);
    return { icon: 'ic_gift', title: '好人好报', text: fill_(b.text), cls: 'ok' };
  }
  if (Math.random() < 0.3) {
    const r = Math.random();
    if (r < 0.4) {
      const n = Math.round(rint(20, 50) * 10 * Math.min(2, p.budgetMul));
      earn(n, `${p.name}送来 ${n} 灵石答谢。`);
      return { icon: 'ic_gift', title: '还情', text: `${p.name}托人送来 ${n} 灵石：“当初多亏了你。”`, cls: 'ok' };
    }
    if (r < 0.75) {
      const it = giveItem(pick(['pill_found', 'soul_pearl', 'lens2', 'spirit_wine', 'xuan_essence']));
      return it ? { icon: 'ic_gift', title: '还情', text: `${p.name}送来一件${itemName(it)}，说是谢你当初的照应。`, cls: 'ok' } : null;
    }
    const k = pick(Object.keys(CLIQUES));
    shiftSt(k, 12);
    return { icon: 'ic_clique', title: '还情', text: `${p.name}在${CLIQUES[k].name}替你说了几句好话（${CLIQUES[k].name}好感 +12）。`, cls: 'ok' };
  }
  if (Math.random() < 0.5) {
    const it = giveItem(pick(GIFTS[p.faction]), { q: rint(55, 80) });
    return it ? { icon: 'ic_gift', title: '还情', text: `${p.name}在门口放下一件${itemName(it)}，什么也没说就走了。`, cls: 'ok' } : null;
  }
  const it = makeIntel('market');
  return it ? { icon: 'ic_secret', title: '还情', text: `${p.name}悄悄塞给你一份${itemName(it)}。`, cls: 'ok' } : null;
}

// 护身符：大祸临头，你帮过的人出面保你一次
function savedByBenefactor(kind) {
  if (!S.flags.savior) return false;
  S.flags.savior--;
  if (kind === 'heat') { S.heat = 60; log('执法堂要来锁人，一位你帮过的人连夜出面，把事压了下来。', 'gold'); }
  else if (kind === 'death') log('你一口气眼看就要断了，护身符忽然烫得灼手——一位你帮过的人请来大夫，硬是把你从鬼门关拽了回来。', 'gold');
  else { earn(S.rentOwed, '你帮过的人替你交了租子。'); payRent(); }
  return true;
}

// ───────────── 每夜 ─────────────

function karmaTick() {
  const out = [];
  // 债到期
  for (const l of S.loans) {
    if (l.defaulted || l.due > S.day + 1) continue;
    const p = S.people[l.pid];
    if (!p || p.status !== 'alive') { l.defaulted = true; l.dead = true; continue; }
    if (!p.desperate && (p.budgetMul >= 0.6 || Math.random() < 0.4)) {
      earn(l.owe, `${p.name}还了 ${l.owe} 灵石的债。`);
      remember(p, '连本带利还清了你的债。', 0);
      l.paid = true;
      out.push({ icon: 'ic_ledger', title: '收债', text: `${p.name}连本带利还了 ${l.owe} 灵石。`, cls: 'ok' });
    } else {
      l.defaulted = true;
      out.push({ icon: 'ic_ledger', title: '赖债', text: `${p.name}还不上欠你的 ${l.owe} 灵石。可在「人物」页讨债。`, cls: 'warn' });
    }
  }
  S.loans = S.loans.filter(l => !l.paid && !l.dead);
  for (const p of Object.values(S.people)) {
    if (p.status !== 'alive') continue;
    // 苦力：替你干活，熬干了就是一具尸首
    if (p.indentured) {
      p.health -= 7;
      if (p.health <= 0) {
        die(p, `${p.name}累死在你的后院里。`);
        giveItem('corpse', { fresh: 6 }); giveItem('soul_grudge');
        karmaShift(-5); adjustRep('ren', -3);
        out.push({ icon: 'ic_ledger', title: '苦力', text: `${p.name}没熬过这一夜，累死在后院。尸身和一缕怨魂留给了你。`, cls: 'bad' });
      }
      continue;
    }
    // 耳目：你接济过的人，在街头巷尾替你听着
    if (p.informant && Math.random() < 0.1) {
      const target = pick(Object.values(S.people).filter(t => t.status === 'alive' && t.secret && !t.secret.known && t !== p));
      const kind = target && Math.random() < 0.35 ? 'secret' : Math.random() < 0.7 ? 'market' : 'treasure';
      if (kind === 'secret') target.secret.known = true;
      const it = makeIntel(kind, { p: target });
      if (it) out.push({ icon: 'ic_secret', title: '耳目', text: `${p.name}悄悄塞给你一张纸条：${itemName(it)}。`, cls: 'ok' });
    }
    // 你帮过的人，命也硬些；混出头的，才还得起大情
    if ((p.owed || 0) >= 3 && !p.story && Math.random() < 0.012) {
      const ev = LIFE[p.faction].find(e => e.id === 'rise');
      out.push({ icon: 'ic_ledger', title: '坊间传闻', text: `你帮过的${applyLife(p, ev)}`, cls: 'ok' });
    }
    if ((p.owed || 0) >= 2 && !p.official && Math.random() < Math.min(0.035, p.owed * 0.004)) {
      const r = repay(p);
      if (r) out.push(r);
    }
  }
  // 天道偶尔也开眼
  if (S.virtue >= 50 && strongEnough() && Math.random() < 0.006) {
    const b = pick(BOONS);
    b.run();
    out.push({ icon: 'ic_gift', title: '奇遇', text: fill(b.text, { n: '一位你早已忘了名字的故人' }), cls: 'ok' });
  }
  return out;
}
