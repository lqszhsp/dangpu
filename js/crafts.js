// 各流派的工艺：重新祭炼残器废丹、地火炉炼神兵、灵兽圈养灵宠、符案画符、灵液装瓶、赃物的烙印与封印
'use strict';

// ───────────── 阵符与丹引（一次性模组） ─────────────

const modAccepts = (it, type) => { const m = ITEMS[it.id].mod; return Array.isArray(m) ? m.includes(type) : m === type; };
const hasBoostFu = m => hasMod(m, 'zhen_fu');
function burnMod(m, id) { const it = itemsIn(gridOf(m, 'mod')).find(x => x.id === id); if (it) destroyItem(it); return !!it; }

// 闭关的夜里，诸炉出品更精
const retreatQ = () => (S.retreat ? 10 : 0);

// ───────────── 重新祭炼 ─────────────

const SALVAGE_FORGE = [['sword_std', 5], ['soul_bell', 3], ['bone_flute', 3], ['demon_charm', 2], ['soul_banner', 0.6]];

// 炼器台（器鼎）：残破法器 + 一锭玄铁 → 一件法宝，品质往往高过原物
function salvageForge(m, inputs, emit) {
  if (!countIn(inputs, 'broken_relic') || !countIn(inputs, 'iron_ingot')) return false;
  const [relic] = takeItems(inputs, 'broken_relic', 1), [ingot] = takeItems(inputs, 'iron_ingot', 1);
  const id = weighted(SALVAGE_FORGE.map(([k, w]) => [k, k === 'soul_banner' ? w * (1 + techLv('refine')) : w]));
  emit(makeItem(id, { q: clamp(Math.round((relic.q + ingot.q) / 2) + 22 + retreatQ() + techBonus('forge'), 5, 100) }));
  if (Math.random() < 0.2) emit(makeItem('xuan_essence', { q: rint(50, 80) }));
  return true;
}

// 丹炉：两颗废丹重炼；有丹引必成
function salvagePills(m, inputs, emit) {
  if (countIn(inputs, 'waste_pill') < 2) return null;
  const used = takeItems(inputs, 'waste_pill', 2);
  const guided = hasMod(m, 'dan_guide');
  if (!guided && Math.random() < 0.25) return '废丹重炼，又炸了一炉';
  const id = weighted([['pill_qi', 70], ['pill_blood', 25], ['pill_found', 5]]);
  emit(makeItem(id, { q: clamp(avgQ(used) + 10 + (guided ? 25 : 0) + retreatQ(), 5, 100) }));
  return true;
}

// ───────────── 地火炉 ─────────────

const dihuoFeed = inputs => countIn(inputs, 'iron_ingot') >= 3 || countIn(inputs, 'iron_ore') >= 6;

function dihuoCheck(m, inputs) {
  if (S.retreat && countIn(inputs, 'xuan_essence') >= 4) return { ok: true, msg: '闭关坐镇：今夜炼神兵胚料' };
  if (!dihuoFeed(inputs)) return { ok: false, msg: S.retreat ? '缺料：四块玄铁精，或六块玄铁矿、三锭玄铁' : '缺料：六块玄铁矿或三锭玄铁（四块玄铁精须当夜闭关）' };
  if (!outputHasRoom(m, 'xuan_essence')) return { ok: false, msg: '产出格与地面皆满' };
  return { ok: true, msg: `熬玄铁精 ${hasBoostFu(m) ? 4 : 2} 炉` };
}

function dihuoRun(m, inputs, emit) {
  if (S.retreat && countIn(inputs, 'xuan_essence') >= 4) {
    const used = takeItems(inputs, 'xuan_essence', 4);
    emit(makeItem('god_blank', { q: clamp(avgQ(used) + 15 + techBonus('forge'), 5, 100) }));
    burnMod(m, 'zhen_fu');
    return;
  }
  for (let b = 0; b < (hasBoostFu(m) ? 4 : 2); b++) {
    if (!dihuoFeed(inputs)) break;
    const used = countIn(inputs, 'iron_ingot') >= 3 ? takeItems(inputs, 'iron_ingot', 3) : takeItems(inputs, 'iron_ore', 6);
    emit(makeItem('xuan_essence', { q: clamp(avgQ(used) + 10 + retreatQ() + techBonus('furnace'), 5, 100) }));
  }
  burnMod(m, 'zhen_fu');
}

// ───────────── 灵兽圈 ─────────────

const RAT_FOOD = ['waste_pill', 'bones', 'spirit_fruit', 'beast_feed'];
const BUG_FOOD = ['scrap_sword', 'broken_relic', 'broken_bowl', 'iron_ore', 'bones'];
const RAT_LOOT = [['iron_ore', 4], ['herb_dew', 3], ['spirit_fruit', 3], ['bones', 3], ['broken_relic', 1.5], ['waste_pill', 2], ['spirit_crystal', 0.8], ['jade_pendant', 0.3]];

function penCheck(m, inputs) {
  const pets = itemsIn(gridOf(m, 'out')).filter(it => ITEMS[it.id].cat === 'chong');
  if (!pets.length) return { ok: false, msg: '圈里没有灵宠' };
  const food = inputs.length;
  return { ok: true, msg: food < pets.length ? `饲料不够（${food}/${pets.length}）` : `${pets.length} 只灵宠` };
}

function penRun(m, inputs) {
  const notes = [], out = gridOf(m, 'out'), bq = techLv('beast') * 10;
  const place = it => {
    if (autoPlace(it, [out]) || autoPlace(it, ['floor'])) { notes.push(itemName(it)); return; }
    destroyItem(it);
  };
  // 每只灵宠每夜吃 1 + 御兽重数 份
  for (const pet of itemsIn(out).filter(it => ITEMS[it.id].cat === 'chong')) for (let bite = 0; bite <= techLv('beast'); bite++) {
    const menu = pet.id === 'gold_bug' ? BUG_FOOD : RAT_FOOD;
    const food = inputs.find(it => menu.includes(it.id));
    if (!food) { if (!bite) pet.growth = Math.max(0, (pet.growth || 0) - 5); break; }
    destroyItem(food); inputs.splice(inputs.indexOf(food), 1);
    // 灵兽饲料一份顶两份
    pet.growth = Math.min(100, (pet.growth || 0) + (25 + 10 * techLv('beast')) * (food.id === 'beast_feed' ? 2 : 1));
    if (pet.growth < 50) continue;
    if (pet.id === 'gold_bug') {
      place(makeItem(food.id === 'bones' ? 'beast_feed' : 'spirit_sand', { q: clamp(food.q + 15 + bq, 5, 100) }));
    } else {
      if (food.id === 'waste_pill' && Math.random() < 0.35) place(makeItem('dan_guide', { q: 60 + bq }));
      if (Math.random() < 0.45 + 0.1 * techLv('beast')) {
        const id = weighted(RAT_LOOT.map(([k, w]) => [k, k === 'spirit_crystal' || k === 'jade_pendant' ? w * (1 + techLv('beast')) : w]));
        place(makeItem(id, { q: rint(30, 70) + bq }));
      }
    }
  }
  // 两只成年的同类，可能添丁
  for (const kind of ['treasure_rat', 'gold_bug']) {
    const adults = itemsIn(out).filter(it => it.id === kind && it.growth >= 100);
    if (adults.length >= 2 && Math.random() < 0.3 + 0.1 * techLv('beast')) {
      const baby = makeItem(kind, { growth: 0, q: 50 });
      if (autoPlace(baby, [out])) notes.push(`一只小${ITEMS[kind].name}`); else destroyItem(baby);
    }
  }
  return notes.length ? `产出：${notes.join('、')}` : '灵宠们吃饱了，正在长';
}

// ───────────── 符案 ─────────────

function fuRecipe(inputs) {
  const has = (id, n = 1) => countIn(inputs, id) >= n;
  if (!has('fu_paper') || !has('cinnabar')) return null;
  const t = techLv('talisman');
  if (t >= 3 && has('xian_talisman')) return { out: 'seal_xian', n: 2, use: [['fu_paper', 1], ['cinnabar', 1], ['xian_talisman', 1]] };
  if (t >= 2 && has('spirit_crystal')) return { out: 'zhen_fu', n: 1, use: [['fu_paper', 1], ['cinnabar', 1], ['spirit_crystal', 1]] };
  if (has('soul_wisp')) return { out: 'fu_shehun', n: 1, use: [['fu_paper', 1], ['cinnabar', 1], ['soul_wisp', 1]] };
  if (has('bones')) return { out: 'demon_charm', n: 1, use: [['fu_paper', 1], ['cinnabar', 1], ['bones', 1]] };
  return { out: 'fu_jingang', n: 1, use: [['fu_paper', 1], ['cinnabar', 1]] };
}

function fudeskCheck(m, inputs) {
  const r = fuRecipe(inputs);
  if (!r) return { ok: false, msg: '缺料：符纸与朱砂' };
  if (!findSpot(gridOf(m, 'out'), { id: r.out })) return { ok: false, msg: '产出格已满' };
  return { ok: true, msg: `画${ITEMS[r.out].name}，至多 ${1 + techLv('talisman')} 张` };
}

function fudeskRun(m, inputs, emit) {
  const made = [];
  for (let b = 0; b < 1 + techLv('talisman'); b++) {
    const r = fuRecipe(inputs);
    if (!r || !findSpot(gridOf(m, 'out'), { id: r.out })) break;
    const used = r.use.flatMap(([id, n]) => takeItems(inputs, id, n));
    for (let i = 0; i < r.n; i++) emit(makeItem(r.out, { q: clamp(avgQ(used) + 8 * techLv('talisman') + retreatQ(), 5, 100) }));
    made.push(r.out);
  }
  return made.length;
}

// ───────────── 灵液 ─────────────

function waterTier(p) { return p >= 99.9 ? '琼浆玉露' : p >= 99 ? '无根灵水' : p >= 80 ? '清灵水' : '浊灵水'; }

function waterValue(p) {
  const v = 3 + 70 * Math.pow(Math.max(0, p - 40) / 59.01, 2);
  return Math.round(p >= 99.9 ? v * 4 : p >= 99 ? v * 1.5 : v);
}

// 装瓶：修士只认玉净瓶装的好灵液
const bottleMul = it => (it.bottled ? (it.purity >= 99 ? 1.8 : 1.15) : 1);
function canBottle(it) { return it.id === 'water' && !it.bottled && !!owns('jade_bottle'); }
function bottle(it) {
  if (!canBottle(it)) return '没有玉净瓶了';
  const err = exert('bottle');
  if (err) return err;
  destroyItem(owns('jade_bottle'));
  it.bottled = true;
  return null;
}

// ───────────── 烙印、抹印、封印 ─────────────

// 赃物上原主留下的神识烙印：几重
function stampMark(it, ownerFaction = 'mo') {
  const owner = newPerson(ownerFaction);
  it.mark = { owner: owner.pid, str: +weighted([[1, 50], [2, 35], [3, 15]]) };
}

const markVisible = it => !!it.mark && appraiseLevel() >= it.mark.str;

function canErase(it) { return !!it.mark && markVisible(it) && techLv('erase') >= it.mark.str; }

function eraseMark(it) {
  if (!canErase(it)) return '抹印术不够，抹不掉这道烙印';
  const err = exert('erase', it.mark.str);
  if (err) return err;
  const owner = S.people[it.mark.owner];
  if (Math.random() < 0.12) {
    log(`抹印时烙印反噬，${owner ? owner.name : '原主'}有所感应！`, 'loss');
    if (owner) startStory(`tr_${it.uid}`, 'tracker', 'claim', 1, { pid: owner.pid, uid: it.uid, name: itemName(it) });
    return '烙印反噬，没抹干净——原主有所感应，怕是要找上门来。';
  }
  it.mark = null;
  it.stolen = 0;
  log(`你抹净了${itemName(it)}上的原主烙印，来路从此干干净净。`, 'gold');
  return null;
}

const SEALABLE = ['qi', 'wan', 'dan', 'fu'];
function canSeal(it) {
  return !!owns('seal_xian') && SEALABLE.includes(ITEMS[it.id].cat) && !ITEMS[it.id].tool && !it.sealed && !it.mark && !(it.stolen > 0) && !ITEMS[it.id].contra && it.id !== 'seal_xian';
}

function sealItem(it) {
  if (!canSeal(it)) return owns('seal_xian') ? '这件东西贴不了封印' : '手上没有正派封印符了';
  const err = exert('seal');
  if (err) return err;
  destroyItem(owns('seal_xian'));
  it.sealed = true;
  // 封印是真的，假的是来历：要看穿得认得名门的出品，做工至少二重，作伪越精越难看穿
  it.grade = Math.max(it.grade || 0, Math.min(4, 2 + Math.floor(techLv('forgery') / 2)));
  it.forged = true;
  log(`你给${itemName(it)}贴上了正派封印，看着像名门所出。`, 'warn');
  return null;
}

// 未抹的烙印：原主循迹追来；卖出去的，原主顺着买主也能找回来
function markTick() {
  S.markedSold = (S.markedSold || []).filter(e => {
    if (S.day - e.day > 12) return false;
    if (Math.random() >= 0.05 * e.str + 0.03) return true;
    startStory(`tr_sold_${e.owner}_${S.day}`, 'tracker', 'claim', 1, { pid: e.owner, uid: -1, name: e.name });
    return false;
  });
  for (const it of Object.values(S.items)) {
    if (!it.mark || !HELD(it) || S.story[`tr_${it.uid}`]) continue;
    const ch = 0.04 * it.mark.str + (it.pos.g === 'display' ? 0.05 : 0) - (it.pos.g === 'hidden' ? 0.03 : 0);
    if (Math.random() < ch) startStory(`tr_${it.uid}`, 'tracker', 'claim', 1, { pid: it.mark.owner, uid: it.uid, name: itemName(it) });
  }
}

Object.assign(STORIES, {
  tracker: {
    nodes: {
      claim: {
        when: 'day',
        who: st => { const p = S.people[st.flags.pid]; return { name: p.name, portrait: p.portrait, title: '循迹而来', faction: p.faction, pid: p.pid }; },
        cond: st => S.people[st.flags.pid] && S.people[st.flags.pid].status === 'alive',
        text: st => {
          const p = S.people[st.flags.pid], held = S.items[st.flags.uid] && HELD(S.items[st.flags.uid]);
          return held
            ? `一个${p.title}径直走到柜前，掌心一翻，一缕神识探向你的库房：“我的${st.flags.name}，上头还有我的烙印。”\n“东西是谁偷的，我不管。我只问你——还，还是不还？”`
            : `一个${p.title}找上门来：“我的${st.flags.name}上有我的烙印，我一路循着找到了买主，买主说是从你这儿买的。”\n“这笔账，你得给我个交代。”`;
        },
        choices: st => {
          const p = S.people[st.flags.pid], it = S.items[st.flags.uid], held = it && HELD(it);
          const val = held ? Math.round(claimedValue(it) * priceMul(it.id)) : 150;
          const pay = Math.round(val * 0.4 / 10) * 10;
          const list = [];
          if (held) list.push({ label: '物归原主', hint: '失去这件货', run: () => {
            destroyItem(it); remember(p, '你把他被偷的东西还给了他。', 20, 'helped');
            return { text: '他收回东西，点点头：“你是个明白人。”', end: true };
          } });
          list.push({ label: `赔钱了事（${pay}）`, hint: costHint(pay), req: needStones(pay), run: () => {
            spend(pay, `赔给失主${p.name} ${pay} 灵石。`); remember(p, `你赔了他 ${pay} 灵石。`, 8);
            if (it) { it.mark = null; it.stolen = 0; }
            return { text: '他收了灵石，抹去了自己的烙印：“这东西，从此归你了。”', end: true };
          } });
          list.push({ label: '以势压人', hint: `成算 ${Math.round(overpowerOdds(p) * 100)}%（你的势力 ${playerPower()}，他 ${npcPower(p)}）`, run: () => {
            if (Math.random() < overpowerOdds(p)) { remember(p, '你仗势压了下来。', -15, 'swallowed'); return { text: '他盯着你看了半晌，冷哼一声走了。', end: true }; }
            if (held) destroyItem(it);
            const dmg = retaliate(p, 50); remember(p, '你仗势欺人，没压住。', -20);
            return { text: `“好大的口气。”他一把夺回东西走了。\n没两天——${dmg}`, end: true };
          } });
          list.push({ label: '抵赖', hint: '他未必信', run: () => {
            if (lieCaught(p.savvy + 0.2)) {
              if (held) destroyItem(it);
              addHeat(10); remember(p, '你当面抵赖，被他用烙印戳穿。', -25, 'lied');
              return { text: '他冷笑着引动烙印，那件东西在你库房里发出微光。他当场取走，还告到了执法堂。', end: true };
            }
            remember(p, '你说没见过。', -5);
            return { text: '他狐疑地扫了一圈，没找到，悻悻走了。', end: true };
          } });
          return list;
        },
      },
    },
  },
});
