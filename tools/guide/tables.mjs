// 攻略的数据层：[[类型:id]] 的名称、反向对账的清单、{{ T.xxx() }} 生成的表格。
// 只从游戏的全局里读，或者在新开的一局里实际跑一遍（开一炉、过一夜），不抄数字。
//   REFS[类型](G, id)   → 正式名称；不存在返回 null
//   COVER[类型](G)      → 这一类在代码里的全部 id：攻略必须一一提到，代码新增了攻略就对不上
//   tables(h)           → T.xxx(...) 返回 markdown；每列出一个东西就 h.mark(类型, id)，算作攻略提到了它

const by = (arr, k = 'id') => Object.fromEntries(arr.map(x => [x[k], x]));
const n2 = v => Math.round(v * 100) / 100;

export const REFS = {
  item: (G, id) => G.ITEMS[id] ? G.ITEMS[id].name : null,
  machine: (G, id) => G.MACHINES[id] ? G.MACHINES[id].name : null,
  cond: (G, id) => G.CONDS[id] ? G.CONDS[id].name : (G.DERIVED[id] ? G.DERIVED[id].name : null),
  start: (G, id) => (by(G.STARTS)[id] || {}).name || null,
  diff: (G, id) => (by(G.DIFFICULTIES)[id] || {}).name || null,
  loc: (G, id) => (by(G.LOCATIONS)[id] || {}).name || null,
  upgrade: (G, id) => (by(G.UPGRADES)[id] || {}).name || null,
  tech: (G, id) => G.TECHS[id] ? G.TECHS[id].name : null,
  char: (G, id) => G.CAST[id] ? G.CAST[id].name : (G.STORIES[id] && G.STORIES[id].person ? G.STORIES[id].person.name : null),
  healer: (G, id) => G.CAST[id] && G.CAST[id].healer ? G.CAST[id].name : null,
  faction: (G, id) => G.FACTIONS[id] ? G.FACTIONS[id].name : null,
  clique: (G, id) => G.CLIQUES[id] ? G.CLIQUES[id].name : null,
  dealer: (G, id) => G.DEALERS[id] ? G.DEALERS[id].name : null,
  lace: (G, id) => G.LACE[id] ? G.LACE[id].name : null,
  lever: (G, id) => G.LEVERS[id] ? G.LEVERS[id].name : null,
  cat: (G, id) => G.CATS[id] || null,
  realm: (G, i) => G.REALMS[+i] ? G.REALMS[+i].name : null,
  war: (G, i) => G.WAR_STAGES[+i] ? G.WAR_STAGES[+i].name : null,
  action: (G, id) => G.ACTION_NAME[id] || null,
  sin: (G, id) => G.SINS[id] ? G.SINS[id].name : null,
};

// 代码里有、攻略就必须写到的
export const COVER = {
  start: G => G.STARTS.map(s => s.id),
  diff: G => G.DIFFICULTIES.map(d => d.id),
  machine: G => Object.keys(G.MACHINES),
  loc: G => G.LOCATIONS.map(l => l.id),
  upgrade: G => G.UPGRADES.map(u => u.id),
  tech: G => Object.keys(G.TECHS),
  cond: G => Object.keys(G.CONDS),
  healer: G => Object.keys(G.CAST).filter(k => G.CAST[k].healer),
  char: G => Object.keys(G.CAST),
  clique: G => Object.keys(G.CLIQUES),
  dealer: G => Object.keys(G.DEALERS),
  lace: G => Object.keys(G.LACE),
  lever: G => Object.keys(G.LEVERS),
  item: G => Object.keys(G.ITEMS),
  realm: G => G.REALMS.map((_, i) => String(i)).slice(1),
  war: G => G.WAR_STAGES.map((_, i) => String(i)),
  sin: G => Object.keys(G.SINS),
};

const table = (head, rows) => rows.length
  ? [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.map(c => String(c ?? '').replace(/\|/g, '｜').replace(/\n/g, ' ')).join(' | ')} |`)].join('\n')
  : '（无）';

export function tables(h) {
  const { G, mark, ref, pct } = h;
  const itemName = id => ref('item', id);
  const items = list => list.map(([id, n]) => `${itemName(id)}${n > 1 ? `×${n}` : ''}`).join('、');
  const stones = n => `${n} 灵石`;
  const markupOf = id => (by(G.DIFFICULTIES)[id] || G.diff()).markup;

  // 在新开的一局里实际开一炉：放进原料与模块，过 nights 夜，返回产出。配方以游戏自己的 machineRun 为准
  function craft(type, inputs, { mods = [], tech = {}, nights = 1, retreat = false } = {}) {
    h.fresh();
    Object.assign(G.S.tech, tech);
    G.S.retreat = retreat;
    const m = G.addMachine(type);
    const put = (slot, list) => list.forEach(([id, n = 1, extra = {}]) => {
      for (let i = 0; i < n; i++) if (!G.autoPlace(G.makeItem(id, { q: 60, ...extra }), [G.gridOf(m, slot)])) throw new Error(`${ref('machine', type)}的${slot}格放不下${itemName(id)}`);
    });
    put('in', inputs); put('mod', mods);
    const msgs = [];
    for (let i = 0; i < nights; i++) {
      const c = G.machineCheck(m);
      if (!c.ok) return { ok: false, msg: c.msg, out: [] };
      msgs.push(G.machineRun(m));
    }
    const got = [...G.itemsIn(G.gridOf(m, 'out')), ...G.itemsIn('floor')];
    const out = got.reduce((o, it) => (o[it.id] = (o[it.id] || 0) + 1, o), {});
    // 显示用游戏自己的名字（灵水按纯度叫法不同）
    const shown = got.reduce((o, it) => (o[G.itemName(it)] = (o[G.itemName(it)] || 0) + 1, o), {});
    return { ok: true, msg: msgs.join('；'), out: Object.entries(out), shown: Object.entries(shown).map(([n, k]) => `${n}${k > 1 ? `×${k}` : ''}`).join('、') };
  }

  // 探测：在新开的一局里试出规则，不抄常数
  const probe = {
    // 关注到多少会被锁拿
    heatLimit() { for (let x = 0; x <= 200; x++) { h.fresh(); G.S.flags.savior = 0; G.S.heat = x; G.checkHeat(); if (G.S.over) return x; } return null; },
    // 头一期租金在第几日收
    firstRentDay() { return h.fresh().rentDue; },
    // 交过一期后，隔几日再收
    rentEvery() { h.fresh(); G.S.stones = 99999; G.S.day = G.S.rentDue; G.S.rentOwed = G.rentAmount(); G.payRent(); return G.S.rentDue - G.S.day; },
    // 交不上租：宽限几日、欠款涨到几倍
    rentGrace() { h.fresh(); G.S.stones = 0; G.S.day = G.S.rentDue; G.rentCheck(); return { days: G.S.grace, mul: n2(G.S.rentOwed / G.rentAmount()) }; },
    // 打点巡查的价钱随关注涨多少
    bribe(heat) { h.fresh(); G.S.heat = heat; return G.inspectionCost(); },
    // 淘宝客拾荒多翻几次
    diggerExtra() { h.fresh('normal', 'digger'); G.startScavenge(G.LOCATIONS[0].id); return G.S.scav.tries - G.LOCATIONS[0].tries; },
    // 每日来客
    customers() { h.fresh(); G.itemsIn('display').forEach(it => G.destroyItem(it)); return G.customerCount(); },
    // 你不治，一直熬 nights 夜，有多少死于这一状态
    deathRate(kind, sev, nights, n = 400) {
      return h.sim(n, () => {
        h.fresh(); G.S.flags.savior = 0; G.addCond('me', kind, sev);
        for (let i = 0; i < nights && !G.S.over; i++) { G.condTick(); G.S.day++; }
        return !!G.S.over;
      });
    },
  };

  return {
    craft, probe,

    // 难度：铺契、租金倍率、加价、顾客出价、巡查
    diffs() {
      return table(['难度', '铺契', '租金', '货郎与设备加价', '顾客出价', '巡查频率', '说明'],
        G.DIFFICULTIES.map(d => { mark('diff', d.id); return [`**${d.name}**`, stones(d.deed), `×${d.rent}`, pct(d.markup), `×${d.sell}`, `×${d.inspect}`, d.desc || '']; }));
    },

    // 开局：灵石、设备、货、手艺、名声
    starts() {
      return table(['开局', '灵石', '设备', '随身货物', '手艺', '另有', '说明'],
        G.STARTS.map(s => {
          mark('start', s.id);
          const extra = [];
          if (s.heat) extra.push(`执法堂关注 ${s.heat}`);
          if (s.rep) extra.push(Object.entries(s.rep).map(([f, v]) => `${ref('faction', f)}声望${v > 0 ? '+' : ''}${v}`).join('、'));
          if (s.perks) extra.push(Object.keys(s.perks).map(k => ({ fence: '熟识销赃门路', hidden: '自带夹层暗格', digger: `拾荒多翻 ${probe.diggerExtra()} 次` })[k] || k).join('、'));
          return [`**${s.name}**${s.tag ? `（${s.tag}）` : ''}`, s.stones, (s.machines || []).map(t => ref('machine', t)).join('、') || '—',
            items((s.items || []).concat((s.into || []).map(x => [x[2], x[3]]))) || '—',
            Object.entries(s.tech || {}).map(([t, l]) => `${ref('tech', t)}${l}重`).join('、') || '—', extra.join('；') || '—', s.desc || ''];
        }));
    },

    // 租金：每期多少（当前难度）
    rents(n = 10) {
      return table(['期', ...Array.from({ length: n }, (_, i) => `第${i + 1}期`)],
        [['租金', ...Array.from({ length: n }, (_, i) => G.rentAmount(i))]]);
    },

    upgrades() {
      return table(['扩建', '价钱', '前置', '效果'],
        G.UPGRADES.map(u => { mark('upgrade', u.id); return [`**${u.name}**`, u.price, u.need ? ref('upgrade', u.need) : '—', u.desc]; }));
    },

    // 货郎常备货：底价（未计难度加价、魔宗声望折扣、行情）与要求的魔宗声望
    supply() {
      return table(['货', '底价', '要魔宗声望'],
        G.SUPPLY.map(([id, p, rep]) => [itemName(id), p, rep <= -100 ? '—' : rep]));
    },

    dealers() {
      return Object.entries(G.DEALERS).map(([k, d]) => {
        mark('dealer', k);
        return `**${d.name}**：进货价为底价×${d.price}，${d.lag ? `行情涨落传到他那儿只剩${pct(d.lag)}` : '不随行情涨落'}；收你的货按估值的 ${pct(d.sellK)} 付钱${d.stolenOk ? '，收赃' : ''}。\n`
          + `- 卖：${d.sells.map(([id, lot]) => `${itemName(id)}（${lot}件一批）`).join('、')}\n- 收：${d.buys.map(itemName).join('、')}`;
      }).join('\n\n');
    },

    machines(diffId = 'normal') {
      const mk = markupOf(diffId);
      return table(['设备', '价钱', '灵力/夜', '体力/精神每夜', '入料格', '产出格', '用途'],
        Object.entries(G.MACHINES).map(([k, m]) => {
          mark('machine', k);
          const [st, sp] = G.MACHINE_COST[k] || [0, 0];
          return [`**${m.name}**`, Math.round(m.price * (1 + mk)), m.power, `${st}/${sp}`, m.in ? m.in.join('×') : '—', m.out ? m.out.join('×') : '—', m.desc || ''];
        }));
    },

    // 配方：每一行都真的开一炉验证
    recipes(rows) {
      return table(['设备', '放进去', '模块', '条件', '开炉后得到'], rows.map(([type, inputs, opt = {}]) => {
        const r = craft(type, inputs, opt);
        if (!r.ok) throw new Error(`${ref('machine', type)}放 ${items(inputs)} 开不了炉：${r.msg}`);
        if (!r.out.length) throw new Error(`${ref('machine', type)}放 ${items(inputs)} 什么也没产出`);
        const cond = [...Object.entries(opt.tech || {}).map(([t, l]) => `${ref('tech', t)}${l}重`), opt.retreat ? '闭关' : '', opt.nights > 1 ? `${opt.nights} 夜` : ''].filter(Boolean).join('、');
        mark('machine', type);
        return [ref('machine', type), items(inputs) || '—', items(opt.mods || []) || '—', cond || '—', r.shown];
      }));
    },

    techs() {
      return table(['功法', '管哪些设备', '最高', '效果', '秘籍（价钱 · 要魔宗声望）'],
        Object.entries(G.TECHS).map(([k, t]) => {
          mark('tech', k);
          const books = G.BOOKS.filter(b => b[1] === k).map(b => { mark('item', b[0]); return `${b[2]}重《${b[5]}》${b[3]} · ${b[4] <= -100 ? '—' : b[4]}`; });
          return [`**${t.name}**`, t.machines.map(m => ref('machine', m)).join('、') || '—', t.max, t.desc, books.join('；') || '—'];
        }));
    },

    actions() {
      return table(['行动', '体力', '精神'], Object.entries(G.ACTION_COST).map(([k, [st, sp]]) => [ref('action', k), st, sp]));
    },

    restores() {
      return table(['服下', '体力', '精神'], Object.entries(G.RESTORE).filter(([, r]) => r[0] || r[1]).map(([id, [st, sp]]) => [itemName(id), `+${st}`, `+${sp}`]));
    },

    locations() {
      return G.LOCATIONS.map(l => {
        mark('loc', l.id);
        const hz = l.hazard, w = l.loot.reduce((s, [, x]) => s + x, 0);
        return `### ${l.name}\n\n${l.desc}\n\n- 可翻找 ${l.tries} 次；每次找到东西 ${pct(l.find)}；初始遇险 ${pct(l.danger)}，每翻一次再高 ${pct(0.04)}\n`
          + `- 遇险：${hz.text}${hz.cond ? `（可能${ref('cond', hz.cond[0])}）` : ''}${hz.cost ? `，丢 ${hz.cost} 灵石` : ''}${hz.heat ? `，执法堂关注 +${hz.heat}` : ''}\n`
          + `- 常见：${l.loot.slice().sort((a, b) => b[1] - a[1]).map(([id, x]) => `${itemName(id)} ${pct(x / w)}`).join('、')}`
          + (l.warLoot ? `\n- 开战以后还能翻到：${l.warLoot.map(([id]) => itemName(id)).join('、')}` : '');
      }).join('\n\n');
    },

    realms() {
      return table(['境界', '冲关要攒的修为', '破境之物'], G.REALMS.map((r, i) => [i, r]).filter(([i]) => i).map(([i, r]) => {
        mark('realm', i);
        return [`**${r.name}**`, r.need || '已到顶', r.key ? itemName(r.key) : '—'];
      }));
    },

    cultXp() {
      return table(['服炼', '修为', '损善名'], Object.entries(G.CULT_XP).map(([id, [xp, evil]]) => [itemName(id), xp, evil ? '是' : '']));
    },

    conds() {
      return table(['状态', '三重', '比斗每重', '自然恢复', '恶化', '致命', '可治'], Object.entries(G.CONDS).map(([k, c]) => {
        mark('cond', k);
        return [`**${c.name}**`, c.grade.join(' → '), `-${c.combat}`, c.heal ? `每 ${c.heal} 天降一重` : (k === 'poisoned' ? '只有微毒会自己退' : '不会'), c.worsen ? `每 ${c.worsen} 天加一重` : '—',
          c.lethal ? `第三重每夜 ${pct(c.lethal)}，再添一重当场毙命` : '—', c.cure.map(itemName).join('、')];
      }));
    },

    healers() {
      return table(['医者', '身份', '族', '大约第几日登场', '治', '诊金底价/重'], Object.values(G.CAST).filter(d => d.healer).map(d => {
        mark('healer', d.id); mark('char', d.id);
        return [`**${d.name}**`, d.title, ref('faction', d.faction), d.start.day || 1, d.healer.heals.map(k => ref('cond', k)).join('、'), d.healer.fee];
      }));
    },

    // 诊金：在新开一局里摆好伤势与交情，直接问游戏要价
    healFees(ids, sev = { injured: 3 }) {
      const moods = [['仇视', -60], ['冷淡', -20], ['平平', 0], ['友善', 30], ['亲厚', 70]];
      return table(['医者', ...moods.map(m => m[0])], [].concat(ids).map(id => [`**${ref('char', id)}**`, ...moods.map(([, aff]) => {
        h.fresh();
        G.startStory(id, id, G.CAST[id].start.node || Object.keys(G.CAST[id].nodes)[0], 99);
        const p = G.S.people[id];
        Object.assign(p, G.CAST[id].traits || {}); p.visits = 1; p.aff = aff;
        for (const [k, s] of Object.entries(sev)) G.addCond('me', k, s);
        const f = G.healFee(p);
        return f == null ? '不肯治' : f;
      })]));
    },

    // 分档：把 f(-100..100) 扫一遍，连续同名的一段算一档
    bands(f, lo = -100, hi = 100) {
      const out = [];
      for (let x = lo; x <= hi; x++) { const v = f(x); if (!out.length || out[out.length - 1].v !== v) out.push({ v, from: x, to: x }); else out[out.length - 1].to = x; }
      return table(['档', '范围'], out.map(b => [`**${b.v}**`, b.from === lo ? `${b.to} 及以下` : b.to === hi ? `${b.from} 及以上` : `${b.from} ～ ${b.to}`]));
    },

    // 因果：作到第几桩、在第几日，若败露要赔多少（在新开的一局里照游戏的算法逐桩记账）
    fateStakes(w = 2, days = [10, 30, 60], upto = 8) {
      return table(['这是第几桩（分量相同）', ...days.map(d => `第 ${d} 日作恶`)], Array.from({ length: upto }, (_, k) => [`第 ${k + 1} 桩`, ...days.map(d => {
        h.fresh(); G.S.day = d;
        for (let i = 0; i < k; i++) G.commitSin('betray', { w });
        return G.fateStake(w);
      })]));
    },
    sins() {
      return table(['恶行', '报应找谁', '举例'], Object.entries(G.SINS).map(([k, s]) => { mark('sin', k); return [`**${s.name}**`, s.who, s.how.join('；')]; }));
    },
    // 口碑：善名、恶名对客人出价与来客的影响
    trust() {
      const t = G.FATE_TOLERANCE, rows = [[10, 0], [20, 0], [45, 0], [70, 0], [100, 0], [10, 4 * t], [10, 8 * t]].map(([v, inf]) => {
        h.fresh(); G.S.virtue = v; G.S.fate.infamy = inf;
        return [inf ? `恶名 ${inf}` : `善名 ${v}`, `${Math.round((G.trustMul() - 1) * 1000) / 10}%`, (G.S.virtue >= 45 ? 1 : 0) - G.fateCustomerLoss()];
      });
      return table(['', '客人出价', '每日来客（不算熟客荐来的）'], rows);
    },

    factions() {
      return table(['族', '说明'], Object.entries(G.FACTIONS).map(([k, f]) => [`**${f.name}**`, f.desc]));
    },

    cliques() {
      return table(['派系', '主事', '对头', '爱收', '眼力', '说明'], Object.entries(G.CLIQUES).map(([k, c]) => {
        mark('clique', k);
        return [`**${c.name}**`, c.head, ref('clique', c.rival), c.likes.map(x => ref('cat', x)).join('、'), c.eye, c.desc];
      }));
    },

    laces() {
      return table(['加料', '用什么', '效果', '被识破的底子'], Object.entries(G.LACE).map(([k, l]) => {
        mark('lace', k);
        const src = Object.keys(G.ITEMS).filter(id => G.ITEMS[id].additive === k).map(itemName).join('、');
        return [`**${l.name}**`, src, l.desc, pct(l.detect)];
      }));
    },

    levers() {
      return Object.keys(G.LEVERS).map(k => `**${ref('lever', k)}**`).join('、');
    },

    cast() {
      return table(['人物', '身份', '族', '大约第几日登场', '登场机会', '想要', '懂医术'], Object.values(G.CAST)
        .sort((a, b) => (a.start.day || 1) - (b.start.day || 1))
        .map(d => {
          mark('char', d.id);
          const wish = (d.traits && d.traits.wish) || d.item;
          return [`**${d.name}**`, d.title, ref('faction', d.faction), d.start.day || 1, d.start.chance != null ? pct(d.start.chance) : '必来',
            wish ? itemName(wish) : '—', d.healer ? d.healer.heals.map(k => ref('cond', k)).join('、') : ''];
        }));
    },

    tourney() {
      return table(['擂台', '报名费', '赏灵石', '可能赏的'], Object.values(G.TOURNEY_PRIZE).map(p => [`**${p.name}**`, p.fee, p.stones, p.items.map(itemName).join('、')]));
    },

    weekdays() {
      return table(['星期', '说明'], G.WEEKDAYS.map(w => [`**${w.name}**`, w.text]));
    },
    seasons() {
      return table(['季节', '灵草长得', '尸身烂得', '说明'], G.SEASONS.map(s => [`**${s.name}**`, `×${s.growth}`, `×${s.rot}`, s.text]));
    },
    annual() {
      return table(['节庆', '一年中的第几日', '说明'], G.ANNUAL.map(a => [`**${a.name}**`, `${a.from}–${a.to}`, a.text]));
    },
    wars() {
      return table(['战事', '紧张度起', '战备货涨', '奢侈货', '巡查', '货郎进价', '说明'], G.WAR_STAGES.map((w, i) => {
        mark('war', i);
        return [`**${w.name}**`, w.at, `+${pct(w.war)}×战备权重`, w.lux ? pct(w.lux) : '—', `×${w.inspect}`, `×${w.supply}`, w.text];
      }));
    },

    // 一件货从哪儿能刻意弄到：货郎、鬼市与批发处、拾荒（注明险不险）、功勋兑换
    sourcesOf(id) {
      const out = [];
      const sup = G.SUPPLY.find(s => s[0] === id);
      if (sup) out.push(sup[2] > -100 ? `货郎（魔宗声望 ${sup[2]}）` : '货郎');
      for (const d of Object.values(G.DEALERS)) if (d.sells.some(([x]) => x === id)) out.push(d.name);
      for (const l of G.LOCATIONS) if (l.loot.some(([x]) => x === id)) out.push(`拾荒·${l.name}${l.danger >= 0.1 ? '（险）' : ''}`);
      for (const l of G.LOCATIONS) if ((l.warLoot || []).some(([x]) => x === id) && !l.loot.some(([x]) => x === id)) out.push(`开战后拾荒·${l.name}`);
      for (const [f, list] of Object.entries(G.MERIT_SHOP)) { const m = list.find(([x]) => x === id); if (m) out.push(`${G.FACTIONS[f].name}功勋 ${m[1]}`); }
      return out.join('、');
    },

    // 货物图鉴：一类一张表
    catalog() {
      return Object.entries(G.CATS).map(([cat, name]) => {
        const list = Object.entries(G.ITEMS).filter(([, it]) => it.cat === cat);
        if (!list.length) return '';
        return `### ${name}\n\n` + table(['货', '底价', '占格', '标记', '刻意去弄', '说明'], list.map(([id, it]) => {
          mark('item', id);
          const flags = [it.contra ? '仙门禁物' : '', it.illicit ? '魔宗禁药' : '', it.additive ? `可${G.LACE[it.additive].verb.replace(/^掺了|^下了|^添了|^种了/, '加')}` : '', it.war ? '战时涨价' : '', it.lux ? '奢侈' : ''].filter(Boolean).join('、');
          return [`**${it.name}**`, it.base, `${it.w}×${it.h}`, flags || '—', this.sourcesOf(id) || '自己做、客人来卖或机缘', it.desc || ''];
        }));
      }).filter(Boolean).join('\n\n');
    },
  };
}
