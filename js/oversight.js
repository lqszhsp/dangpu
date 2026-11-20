// 监管：违禁品不得陈列，管事路过会看见，客人会举报；管理者按交情视而不见、敲竹杠或上报。
// 巡查头天夜里就定下了，交情够的人会提前捎来风声
'use strict';

const isBanned = it => !!(ITEMS[it.id].contra || ITEMS[it.id].illicit);
const bannedShown = () => itemsIn('display').filter(isBanned);

// 管理者对你的容忍：看交情、收过多少好处、贪念与操守，也看你的势力
function tolerance(p) {
  if (!p || p.status !== 'alive') return 'report';
  if (p.controlled || p.loveGu || S.flags.chenShelter || (isLawman(p) && S.flags.enforcerOwned)) return 'ignore';
  const score = p.aff + (p.bribes || 0) * 8 + p.greed * 30 - p.integrity * 50 + (playerPower() - npcPower(p)) * 0.2;
  // 清官不收黑钱：要么网开一面，要么公事公办
  if (p.integrity >= 0.7) return score >= 50 ? 'ignore' : 'report';
  return score >= 50 ? 'ignore' : score >= 5 ? 'shakedown' : 'report';
}
const TOLERANCE_NAME = { ignore: '视而不见', shakedown: '借机敲竹杠', report: '上报执法堂' };

function bannedStake() { return 30 + Math.round(bannedShown().reduce((s, it) => s + claimedValue(it) * 0.5, 0)); }

function inspectVisitor() {
  const e = official('enforcer');
  return { kind: 'inspect', faction: 'mo', portrait: e.portrait, name: e.name, title: e.title, pid: e.pid };
}

// 当天就来：举报坐实或管事告发
function inspectNow() {
  if (S.queue.some(c => c.kind === 'inspect') || (S.customer && S.customer.kind === 'inspect')) return;
  S.queue.splice(Math.min(2, S.queue.length), 0, inspectVisitor());
}

// ───────────── 巡查排期与风声 ─────────────

// 夜里定下明日是否巡查
function planInspection() {
  const p = clamp(S.heat / 100, 0, 0.9) * diff().inspect * (S.market.heat || 1) * 0.55 * S.flags.inspectMul
    * (weekdayOf().inspect || 1) * warStage().inspect;
  let reason = null;
  if (S.flags.forceInspect) { reason = '有人往执法堂递了状子'; S.flags.forceInspect = false; }
  else if (S.flags.reported) { reason = S.flags.reported; }
  else if (Math.random() < p) reason = weekdayOf().inspect > 1 ? '点卯例查' : '例行巡查';
  S.flags.reported = null;
  S.plan = { day: S.day, inspect: !!reason, reason, tipped: null };
}

// 谁会给你通风报信：[人, 几率]
function informants() {
  const out = owedInformants(), e = S.people.enforcer;
  if ((S.flags.spyUntil || 0) >= S.day) {
    const spy = Object.values(S.people).find(p => p.pid === S.flags.spyBy);
    if (spy && spy.status === 'alive') out.push([spy, 1]);
  }
  if (e && e.status === 'alive' && (e.aff >= 45 || (e.bribes || 0) >= 2)) out.push([e, 0.8]);
  const amu = S.people.amu;
  if (amu && amu.status === 'alive' && amu.portrait === 'amu_disciple' && amu.aff >= 30) out.push([amu, 0.85]);
  if (thugAlly()) out.push([S.people.thug, 0.6]);
  const ll = landlordPerson();
  if (ll && ll.status === 'alive' && ll.aff >= 35 && ll.integrity < 0.5) out.push([ll, 0.6]);
  for (const p of Object.values(S.people)) {
    if (p.story || p.official || p.status !== 'alive' || p.aff < 50 || S.day - p.lastDay > 10) continue;
    if (p.faction === 'mo' || p.faction === 'ren') out.push([p, p.faction === 'mo' ? 0.3 : 0.15]);
  }
  return out;
}

const TIP_LINES = {
  enforcer: '厉寒派了个小弟子来，丢下一句：“明儿我要来你那儿转转，收拾干净些。”',
  amu: '阿木趁夜敲开后窗：“掌柜的，明日执法堂要查到这条街，您早做打算。”',
  thug: '刘癞子的小弟跑来报信：“掌柜的，执法堂的人明天要来！”',
};

// 夜间报告里的风声
function tipOff() {
  if (!S.plan || !S.plan.inspect) return null;
  for (const [p, ch] of informants()) {
    if (Math.random() >= ch) continue;
    S.plan.tipped = p.name;
    const text = TIP_LINES[p.pid] || `${p.name}悄悄捎来话：明日执法堂要来巡查（${S.plan.reason}）。`;
    return { icon: 'ic_heat', title: '风声', text: `${text}趁开铺前把禁物、赃物撤下陈列柜吧。`, cls: 'warn' };
  }
  return null;
}

// 白天的熟客也可能顺口提一句
function customerTip(c) {
  if (!S.plan || !S.plan.inspect || S.plan.tipped || !S.queue.some(x => x.kind === 'inspect')) return false;
  S.plan.tipped = c.name;
  return true;
}

// ───────────── 管事路过与客人举报 ─────────────

// 开铺时：管事路过，看见陈列的违禁品
function overseeDisplay() {
  const banned = bannedShown();
  if (!banned.length || Math.random() > 0.6) return;
  const m = landlordPerson(), names = banned.map(itemName).join('、');
  const t = tolerance(m);
  if (t === 'ignore') { log(`${m.name}路过陈列柜，瞥了一眼${names}，什么也没说。`, 'gain'); return; }
  if (t === 'shakedown') { startStory(`ov_${S.day}_${m.pid}`, 'oversight', 'shakedown', 0, { pid: m.pid, items: names }); return; }
  log(`${m.name}看见你陈列的${names}，脸一沉，转身去了执法堂。`, 'loss');
  remember(m, `看见你公然陈列${names}。`, -5);
  addHeat(6);
  inspectNow();
}

// 客人看见陈列的违禁品：交情差的会去举报（仙门的人自己就是冲着它来的，不会举报）
function maybeReport(c) {
  const p = personOf(c);
  if (!p || c.faction === 'xian' || !bannedShown().length) return;
  const ch = clamp((-p.aff - 5) / 90, 0, 0.55) + (c.faction === 'mo' ? 0.05 : 0) + (p.integrity > 0.5 ? 0.1 : 0);
  if (Math.random() >= ch) return;
  S.reports = S.reports || [];
  S.reports.push({ pid: p.pid, name: p.name, items: bannedShown().map(itemName).join('、'), day: S.day });
  remember(p, '把你陈列禁物的事报给了执法堂。', -3);
  c.reporting = true;
}

// 夜里：执法堂处置举报
function resolveReports() {
  const out = [];
  const list = S.reports || [];
  S.reports = [];
  if (!list.length) return out;
  const e = official('enforcer'), t = tolerance(e), who = list.map(r => r.name).join('、');
  if (t === 'ignore') {
    out.push({ icon: 'ic_heat', title: '举报', text: `听说${who}向执法堂举报你陈列禁物。${e.name}把状子压了下来，连看都没看。`, cls: 'ok' });
  } else if (t === 'shakedown') {
    startStory(`ov_rep_${S.day}`, 'oversight', 'shakedown', 1, { pid: e.pid, items: list[0].items, reported: who });
    out.push({ icon: 'ic_heat', title: '举报', text: `${who}向执法堂举报了你。${e.name}把状子揣进了怀里——看样子，他想先找你“聊聊”。`, cls: 'warn' });
  } else {
    S.flags.reported = `${who}举报你陈列禁物`;
    addHeat(5);
    out.push({ icon: 'ic_heat', title: '举报', text: `${who}向执法堂举报你陈列禁物，${e.name}准了状子。`, cls: 'bad' });
  }
  return out;
}

// ───────────── 敲竹杠 ─────────────

Object.assign(STORIES, {
  oversight: {
    nodes: {
      shakedown: {
        when: 'day',
        who: st => { const p = S.people[st.flags.pid]; return { name: p.name, portrait: p.portrait, title: p.title, faction: p.faction, pid: p.pid }; },
        cond: st => S.people[st.flags.pid].status === 'alive',
        text: st => {
          const f = st.flags, p = S.people[f.pid];
          const lead = f.reported ? `${p.name}从怀里掏出一张状子，在你眼前晃了晃：“${f.reported}告你公然陈列${f.items}。”`
            : `${p.name}踱进铺子，在陈列柜前站定，用指节敲了敲柜门：“${f.items}……啧啧，胆子不小。”`;
          return `${lead}\n“这事嘛，可大可小。”${ta(landlordPerson())}压低了声音，“我可以当没看见——就看你懂不懂事了。”`;
        },
        choices: st => {
          const p = S.people[st.flags.pid], stake = bannedStake();
          return [
            ...bribeChoices(p, stake, (n, ok) => ok
              ? { text: `${p.name}把灵石揣进袖子，拍拍你的肩：“我什么也没看见。”`, end: true }
              : (inspectNow(), { text: `“就这点？”${p.name}冷笑一声，“那就公事公办。”执法堂的人马上就到。`, end: true }), '封口'),
            { label: '当面撤下', hint: '违禁品收回库房；他会记你识相', run: () => {
              const moved = bannedShown().filter(it => autoPlace(it));
              remember(p, '你当着他的面撤下了违禁品。', 2);
              return { text: `你把${moved.map(itemName).join('、') || '东西'}收了回去。${p.name}哼了一声：“下不为例。”`, end: true };
            } },
            { label: '装糊涂', hint: '他多半会上报', run: () => {
              remember(p, '你在他面前装糊涂。', -8);
              if (tolerance(p) === 'ignore') return { text: `${p.name}盯了你一会儿，摇摇头走了。`, end: true };
              inspectNow(); addHeat(5);
              return { text: `“行，装。”${p.name}转身就走。不到半个时辰，执法堂的人就来了。`, end: true };
            } },
          ];
        },
      },
    },
  },
});
