// 因果：恶事是一场赌。每做一桩恶事，就欠下一笔孽债，几日后见分晓——五五开，要么风平浪静，要么报应上门。
// 报应要赔的本金随你累计的恶行滚着涨：头几桩赔得起，做多了总有赔不起的一天（爆仓：抄货、挨打、执法堂盯上）。
// 报应由苦主本人或亲友、同族上门讨；败露多了恶名在外，机遇跟着断：来客变少、托付的人不上门、好报不再来。
// 行善能冲淡旧孽，隔一阵子不作恶，孽也会淡——一味行善赚得慢，一味作恶迟早爆仓，要在两头之间拿捏
'use strict';

const FATE_ODDS = 0.5;          // 一笔孽债败露的机会
const FATE_GROW = 1.18;         // 每作一分恶，往后的本金翻这么多
const FATE_WAIT = [3, 9];       // 几日后见分晓
const FATE_FADE = 21;           // 多少日不作恶，旧孽淡去一分
const FATE_MERIT = 8;           // 积多少善（接济、放人、护人……），抵去一分旧孽

// 恶行的种类：报应从哪儿来、怎么来
const SINS = {
  fraud:  { name: '欺诈', who: '被你坑过的苦主', how: ['聚了一伙人堵在铺子门口讨说法', '一纸状子告到了执法堂', '找了几个混混上门“说理”'] },
  betray: { name: '出卖', who: '被你出卖的人的旧识', how: ['摸清了是谁告的密，夜里寻上门来', '托人放出话来：这笔账迟早要算', '堵在巷口等你'] },
  fence:  { name: '销赃包庇', who: '执法堂', how: ['顺着赃物查到了你的铺子，上门追缴', '翻出了旧账，要你把吞下的连本带利吐出来'] },
  harm:   { name: '害人', who: '苦主的血亲', how: ['披麻戴孝闯进铺子', '带着刀寻上门来报仇', '在你的水缸边守了三夜'] },
};
const KIN = { ren: '同乡', mo: '同门师兄弟', yao: '族人', xian: '师门' };

function initFate() {
  S.fate = Object.assign({ n: 0, debts: [], infamy: 0, merit: 0, last: 0, total: 0, erupted: 0, buried: 0, busts: 0, patrons: 0 }, S.fate || {});
}

// 一笔恶事若败露要赔的本金：分量越重、日子越往后、作恶越多越大
const fateBase = () => 40 + 4 * S.day;
function fateStake(w = 1) { return Math.round(w * fateBase() * Math.pow(FATE_GROW, S.fate.n) / 10) * 10; }

// 选项提示：这是一桩恶事，赌注多大
const sinHint = ([kind, w]) => `作恶（${SINS[kind].name}）：五成会败露，败露约赔 ${fateStake(w)} 灵石，往后作恶的本金也跟着涨`;

// 作了一桩恶：欠下孽债。w 是分量（1 小恶 / 2 出卖销赃 / 3 害命），virtue 是顺带扣的善名
function commitSin(kind, { p = null, w = 1, what = '', virtue = 0 } = {}) {
  initFate();
  const F = S.fate, stake = fateStake(w);
  F.n += w; F.last = S.day; F.total++;
  if (virtue) karmaShift(-virtue);
  F.debts.push({ kind, w, stake, what, day: S.day, due: S.day + rint(FATE_WAIT[0], FATE_WAIT[1]),
    pid: p ? p.pid : null, name: p ? p.name : null, faction: p ? p.faction : null });
  log(`这桩恶事（${SINS[kind].name}）记下了：几日内见分晓，若败露约要赔 ${stake} 灵石。`, 'warn');
  return stake;
}

// 行善冲淡旧孽：有分量的善事（n ≥ 2）才算；头一回真心帮某个人，他还会给你荐来客人
function fateMerit(p, n) {
  initFate();
  const F = S.fate;
  if (n < 2) return;
  F.merit += n;
  while (F.merit >= FATE_MERIT && F.n > 0) { F.merit -= FATE_MERIT; F.n = Math.max(0, F.n - 1); }
  if (p && !p.official && !p.patron) { p.patron = true; F.patrons++; }
}

// ───────────── 恶名：机遇断了 ─────────────

const fateInfamy = () => (S.fate ? S.fate.infamy : 0);
// 托付、求助、报恩的人还肯不肯上门
const fateTrusted = () => fateInfamy() < 4;
// 恶名在外，来客变少
const fateCustomerLoss = () => fateInfamy() >= 8 ? 2 : fateInfamy() >= 4 ? 1 : 0;

// ───────────── 善名：口碑与熟客 ─────────────

// 口碑：老实人的铺子，客人肯多出些（善名到七十就到顶，再往上只是花钱买名声）；恶名让人压价
function trustMul() { return 1 + clamp((S.virtue - 20) / 400, 0, 0.125) - Math.min(0.2, fateInfamy() * 0.025); }
// 熟客：善名在外多一位；真心帮过五个人，他们荐来的客人再多一位
const patronBonus = () => (S.virtue >= 45 ? 1 : 0) + Math.min(1, Math.floor((S.fate ? S.fate.patrons : 0) / 5));

// ───────────── 每夜：见分晓 ─────────────

function fateTick() {
  initFate();
  const F = S.fate, out = [];
  // 隔一阵子不作恶，旧孽淡一分
  if (F.n > 0 && S.day - F.last >= FATE_FADE) { F.n = Math.max(0, F.n - 1); F.last = S.day; }
  const due = F.debts.filter(d => d.due <= S.day);
  F.debts = F.debts.filter(d => d.due > S.day);
  for (const d of due) {
    if (Math.random() >= FATE_ODDS) {
      F.buried++;
      out.push({ icon: 'ic_secret', title: '因果', text: `${d.what ? `“${d.what}”那件事` : `那桩${SINS[d.kind].name}`}，渐渐没人再提了。这一把，你赌赢了。`, cls: 'ok' });
      continue;
    }
    out.push(retribution(d));
    if (S.over) break;
  }
  return out;
}

// 报应：谁来讨、讨多少、赔不起会怎样
function retribution(d) {
  const F = S.fate, K = SINS[d.kind];
  F.erupted++;
  const p = d.pid && S.people[d.pid];
  const who = d.kind === 'fence' ? K.who : p && p.status === 'alive' ? p.name : d.name ? `${d.name}的${KIN[d.faction] || '亲友'}` : K.who;
  const paid = payDebt(d.stake);
  F.infamy += d.w;
  if (d.faction) adjustRep(d.faction, -3 * d.w);
  let text = `${d.what ? `“${d.what}”的事` : `那桩${K.name}`}败露了：${who}${pick(K.how)}。要赔 ${d.stake} 灵石`
    + (paid.cash ? `，你掏出 ${paid.cash} 灵石` : '') + (paid.seized.length ? `，又被抄走${paid.seized.slice(0, 4).join('、')}${paid.seized.length > 4 ? `等 ${paid.seized.length} 件货` : ''}` : '') + '。';
  if (paid.rest > 0) {
    // 爆仓：赔不起的那部分，拿人来抵
    F.busts++;
    const heat = Math.min(40, Math.round(paid.rest / 25));
    addHeat(heat);
    text += `还差 ${paid.rest} 灵石赔不上——你被打得爬不起来，执法堂关注 +${heat}。`;
    addCond('me', 'injured', 2, '赔不起孽债，被人打上门来');
  }
  text += '恶名又传开了一些。';
  return { icon: 'ic_heat', title: '报应', text, cls: 'bad' };
}

// 先掏灵石，不够就抄货（挑最值钱的），还不够的就是窟窿
function payDebt(amount) {
  const cash = Math.min(Math.max(0, S.stones), amount);
  if (cash) spend(cash, `赔孽债 ${cash} 灵石。`);
  let rest = amount - cash;
  const seized = [];
  if (rest > 0) {
    const goods = Object.values(S.items).filter(it => it.pos && ['store', 'display', 'floor', 'hidden'].includes(it.pos.g))
      .sort((a, b) => knownValue(b) - knownValue(a));
    for (const it of goods) {
      if (rest <= 0) break;
      rest -= knownValue(it); seized.push(itemName(it)); destroyItem(it);
    }
  }
  return { cash, seized, rest: Math.max(0, rest) };
}
