// 擂台：每四周一次外门小比，年终宗门大比。你可以报名、押注、暗中做手脚，或者不去。
// 胜负由 judge() 按双方境界、兵器、身上的伤毒定——带伤上擂多半败下阵来，奖赏一件也拿不到；你下过毒的人，也会在台上倒下
'use strict';

const TOURNEY_EVERY = 28;
const TOURNEY_PRIZE = {
  small: { stones: 150, items: ['pill_blood', 'zhen_fu', 'sword_std', 'soul_pearl', 'lens2'], fee: 30, name: '外门小比' },
  grand: { stones: 400, items: ['pill_found', 'soul_banner', 'god_blank', 'soul_crystal'], fee: 80, name: '宗门大比' },
};

// 每夜：提前四天发请帖；没人报名的擂台也照样打，打完的人各有命数
function tourneyTick() {
  const d = S.day + 1, at = d + 4;
  const grand = calendar(at).doy === 330;
  if (at % TOURNEY_EVERY === 0 || grand) startStory(`tn_${at}`, 'tourney', 'invite', 1, { day: at, grand, field: pickField(grand) });
  const out = [];
  for (const [key, st] of Object.entries(S.story)) {
    if (st.tpl !== 'tourney' || st.flags.resolved || st.flags.day > S.day) continue;
    if (st.flags.entered) continue;   // 你报了名：等你夜里上擂时一并结算
    const res = runBracket(st, false);
    st.flags.resolved = true; st.done = true;
    st.summary = `${res.champName}夺得${prizeOf(st).name}头名。`;
    out.push({ icon: 'ic_war', title: prizeOf(st).name, text: `${res.lines.join(' ')}${betText(st, res)}`, cls: 'warn' });
  }
  return out;
}

const prizeOf = st => TOURNEY_PRIZE[st.flags.grand ? 'grand' : 'small'];

// 参赛的三个人：有修为的熟客优先，不够就来几个外门弟子
function pickField(grand) {
  // 管事、官差和老故事里的人不上擂；角色册里的人可以
  const known = Object.values(S.people).filter(p => p.status === 'alive' && !p.official && !p.noble && !PROTECTED.includes(p.pid) && (!p.story || CAST[p.story])
    && npcBasePower(p) >= 20 && ['mo', 'ren', 'yao'].includes(p.faction))
    .sort(() => Math.random() - 0.5).slice(0, 3);
  while (known.length < 3) {
    const p = newPerson('mo', { portrait: 'mo_disciple', title: '外门弟子', anyFace: true });
    if (grand) p.budgetMul = 1.4;
    known.push(p);
  }
  // 擂台之前，总有人带着伤
  if (Math.random() < 0.5) addCond(pick(known), 'injured', 1, '小比前与人争斗');
  return known.map(p => p.pid);
}

const fieldOf = st => st.flags.field.map(id => S.people[id]).filter(p => p && p.status === 'alive');

// 一个人的“风声”：状态、境界——你认得他、或打听过才知道
function rumor(p) {
  const c = condList(p);
  return `${p.name}（${p.title}，${realmName(npcLevel(p))}${c.length ? `，听说${c.map(x => x.label).join('、')}` : ''}）`;
}

// 擂台：每轮两两相斗，赢的晋级。me 为你是否在场；ignore：服药硬撑时抵掉多少状态折损
function runBracket(st, me, ignore = 0) {
  let pool = fieldOf(st).slice();
  if (me) pool.unshift('me');
  const lines = [], fate = new Map();
  let round = 1, myBest = 0;
  while (pool.length > 1) {
    const next = [];
    for (let i = 0; i < pool.length; i += 2) {
      const a = pool[i], b = pool[i + 1];
      if (!b) { next.push(a); continue; }
      const r = judge(a, b, { bonus: a === 'me' ? ignore : b === 'me' ? -ignore : 0 });
      const win = r.win ? a : b, lose = r.win ? b : a;
      const g = r.win ? r.grade : r.grade === 'rout' ? 'crush' : 'win';   // 从赢家这边说
      lines.push(`第${cn(round)}轮，${whoName(a)}对${whoName(b)}：${whoName(win)}${GRADE_NAME[g]}。`);
      if (a === 'me' || b === 'me') lines.push(`（你：${partsText(a === 'me' ? r.a : r.b)}；${whoName(a === 'me' ? b : a)}：${partsText(a === 'me' ? r.b : r.a)}）`);
      // 惨败的人被抬下去：带伤
      if (Math.abs(r.margin) > 18) fate.set(lose, 'routed');
      else fate.set(lose, 'lost');
      if (win === 'me') myBest = round;
      next.push(win);
    }
    pool = next; round++;
  }
  const champ = pool[0];
  if (champ === 'me') myBest = 99;
  // 人物的命数：头名出头，惨败的带伤
  for (const p of fieldOf(st)) {
    if (p === champ) {
      const ev = LIFE[p.faction].find(e => e.id === 'rise');
      applyLife(p, Object.assign({}, ev || {}, { text: `{n}在${prizeOf(st).name}中夺魁。` }));
    } else if (fate.get(p) === 'routed') addCond(p, 'injured', 2, `${prizeOf(st).name}上被打成重伤`);
    else if (fate.get(p) === 'lost') lifeNote(p, `${prizeOf(st).name}落败。`);
  }
  return { lines, champ, champName: whoName(champ), myBest, myFate: fate.get('me') };
}

function betText(st, res) {
  const b = st.flags.bet;
  if (!b) return '';
  if (res.champ !== 'me' && res.champ.pid === b.pid) { earn(b.n * 3, `押中${res.champName}，赢得 ${b.n * 3} 灵石。`); return `你押的${res.champName}赢了，进账 ${b.n * 3} 灵石。`; }
  return `你押的${S.people[b.pid].name}没能夺魁，${b.n} 灵石打了水漂。`;
}

Object.assign(STORIES, {
  tourney: {
    nodes: {
      invite: {
        when: 'day',
        who: () => ({ name: '战堂执事', portrait: 'mo_disciple_f1', title: '擂台执事', faction: 'mo' }),
        text: st => {
          const P = prizeOf(st), me = condText('me');
          return `一个披着战堂红袍的执事把一张擂帖拍在柜上：“${P.name}，四日后开擂。杂役区也有一个擂位，报名费 ${P.fee} 灵石。”\n`
            + `“头名赏 ${P.stones} 灵石，外加库里的一件好东西；输了的，什么也拿不到，被抬下去的也别来找战堂。”\n`
            + `“这回上擂的有：${fieldOf(st).map(rumor).join('；')}。”`
            + (me ? `\n他上下打量你一眼：“${me.replace(/。$/, '')}——带着这身子上擂，生死自负。”` : '');
        },
        choices: (st, p) => {
          const P = prizeOf(st), field = fieldOf(st), list = [];
          if (!field.length) return [{ label: '……', run: () => ({ text: '上擂的人一个个都不在了。擂台空着，执事悻悻收了帖子。', end: true }) }];
          const odds = Math.round(field.reduce((s, f) => s * judgeOdds('me', f), 1) * 100);
          list.push({ label: `报名上擂（${P.fee} 灵石）`, hint: `连胜到底约 ${odds}%；带伤中毒都折实力${deathWarn('injured')}`, req: needStones(P.fee), run: () => {
            spend(P.fee, `${P.name}报名费。`); st.flags.entered = true;
            return { text: '执事在擂帖上添了你的名字：“四日后，夜里开擂。养好你的身子。”', go: ['bout', st.flags.day - S.day] };
          } });
          for (const f of field.slice(0, 2)) list.push({ label: `押 100 灵石赌${f.name}夺魁`, hint: `赢则三倍；${condList(f).length ? `${ta(f)}${condList(f).map(c => c.label).join('、')}` : `${ta(f)}看着无伤无病`}`,
            req: needStones(100), run: () => {
              spend(100, `押注${f.name}夺魁。`); st.flags.bet = { pid: f.pid, n: 100 };
              return { text: `执事收了灵石，在押簿上画了个圈：“${f.name}，一赔三。”`, go: ['bout', st.flags.day - S.day] };
            } });
          const dose = ownItem(it => ['corpse_poison', 'wangyou', 'spider_venom', 'gu_venom'].includes(it.id) || (lacedKnown(it) && ['poison', 'addict', 'numb'].includes(it.laced)));
          list.push({ label: `暗中给${field[0].name}下药`, hint: dose ? `用掉${itemName(dose)}；${ta(field[0])}上擂时中毒；被识破则执法堂关注 +12` : '手里没有尸毒、忘忧散、蛛毒、蛊毒或掺了料的货',
            req: () => !!dose || '没有能下的药', run: () => {
              const f = field[0];
              takeItem(dose); karmaShift(-4);
              commitSin('harm', { p: f, w: 1, what: `擂台前给${f.name}下药` });
              if (lieCaught(f.savvy * 0.6)) {
                addHeat(12); adjustRep('mo', -5); remember(f, '你在擂台前给他下药，被他察觉。', -60, 'poisoned');
                return { text: `${f.name}端起碗闻了闻，脸色一变，把药泼在你脚下。第二天，执法堂的人来问话了。`, go: ['bout', st.flags.day - S.day] };
              }
              addCond(f, 'poisoned', 2, '擂台前喝了一碗来路不明的汤');
              return { text: `药混进了${f.name}的饭食。${ta(f)}吃得很香。`, go: ['bout', st.flags.day - S.day] };
            } });
          list.push({ label: '不去', run: () => ({ text: '执事哼了一声，把擂帖收了回去。', end: true }) });
          return list;
        },
      },

      bout: {
        when: 'night',
        who: () => ({ name: '擂台', portrait: 'mo_disciple_f1', title: '战堂擂台', faction: 'mo' }),
        text: st => {
          const P = prizeOf(st), me = condText('me');
          return `${P.name}的擂台搭在战堂外，火把照得血红。${st.flags.entered ? '轮到杂役擂了。' : '你挤在人群里看擂。'}\n`
            + `上擂的人：${fieldOf(st).map(rumor).join('；')}。`
            + (st.flags.entered && me ? `\n${me}上擂之前，你得想清楚。` : '');
        },
        choices: st => {
          if (!st.flags.entered) return [{ label: '看擂', run: () => {
            const res = runBracket(st, false); st.flags.resolved = true;
            return { text: `${res.lines.join('\n')}\n${betText(st, res)}`, end: true, summary: `${res.champName}夺得${prizeOf(st).name}头名。` };
          } }];
          const hurt = condPenalty('me'), list = [];
          const fight = ignore => {
            const P = prizeOf(st), res = runBracket(st, true, ignore);
            st.flags.resolved = true;
            let tail;
            if (res.champ === 'me') {
              const it = giveItem(pick(P.items), { q: rint(70, 90) });
              earn(P.stones, `${P.name}夺魁，赏 ${P.stones} 灵石。`); adjustRep('mo', st.flags.grand ? 10 : 5); S.merit.mo += st.flags.grand ? 4 : 2; shiftSt('war', 8);
              tail = `你夺得头名！赏 ${P.stones} 灵石${it ? `，还有一件${itemName(it)}` : ''}。战堂记了你的名字。`;
            } else {
              if (res.myFate === 'routed') addCond('me', 'injured', 2, '在擂台上被打成重伤');
              else if (Math.random() < 0.5) addCond('me', 'injured', 1, '擂台上挂了彩');
              tail = res.myBest ? `你止步第${cn(res.myBest + 1)}轮。` : '你第一轮就被打下擂台。';
              tail += res.myFate === 'routed' ? '你是被抬下去的，奖赏一件也没拿到。' : '奖赏一件也没拿到。';
            }
            if (ignore) addCond('me', 'injured', 1, '药力退去，伤势反扑');
            return { text: `${res.lines.join('\n')}\n${tail}${betText(st, res)}`, end: true, summary: res.champ === 'me' ? `你夺得${prizeOf(st).name}头名。` : `你在${prizeOf(st).name}上落败，空手而归。` };
          };
          list.push({ label: '上擂', hint: hurt ? `身上的状态折实力 -${hurt}${deathWarn('injured')}` : '状态良好', run: () => fight(0) });
          if (hurt && owns('pill_blood')) list.push({ label: '吞一颗血煞丹硬撑', hint: '用掉血煞丹；这一夜抵掉大半伤毒，过后伤势加重', run: () => {
            takeItem(owns('pill_blood')); return fight(Math.round(hurt * 0.8));
          } });
          list.push({ label: '弃权', hint: '报名费不退；不受伤', run: () => {
            const res = runBracket(st, false); st.flags.resolved = true;
            return { text: `你在擂台下撕了自己的名帖。\n${res.lines.join('\n')}${betText(st, res)}`, end: true, summary: `你弃了${prizeOf(st).name}的擂。` };
          } });
          return list;
        },
      },
    },
  },
});
