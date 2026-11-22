// 界面：渲染、拖放、弹窗与交互流程
'use strict';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const icon = (name, cls = 'ic') => `<img class="${cls}" src="${asset('ui', name)}" alt="" draggable="false">`;
const stoneTxt = n => `${icon('ic_stone')}<b>${n}</b>`;
const pct = p => `${Math.round(p * 100)}%`;

let scale = 1;
let tab = 'display';
let sel = null;        // 选中物品 uid
let modal = null;      // 当前弹窗渲染函数
let toastTimer = null;

// ───────────── 舞台缩放 ─────────────

// 两种排版：wide（电脑、平板横屏、手机横屏）宽 1280；tall（手机、平板竖屏）宽 480/640。高度随屏幕
let LAYOUT = 'wide', STAGE = { w: 1280, h: 760 };

function fitStage() {
  const ar = innerWidth / innerHeight, before = `${LAYOUT}${CELL}`;
  if (ar < 0.9) {
    LAYOUT = 'tall';
    const w = innerWidth >= 600 ? 640 : 480;
    STAGE = { w, h: clamp(Math.round(w / ar), Math.round(w * 1.3), Math.round(w * 2.3)) };
    CELL = w === 480 ? 36 : 44;
  } else {
    LAYOUT = 'wide';
    STAGE = { w: 1280, h: clamp(Math.round(1280 / ar), 740, 960) };
    CELL = 40;
  }
  scale = Math.min(innerWidth / STAGE.w, innerHeight / STAGE.h);
  const st = $('#stage');
  st.style.width = `${STAGE.w}px`; st.style.height = `${STAGE.h}px`;
  st.style.transform = `scale(${scale})`;
  st.style.left = `${(innerWidth - STAGE.w * scale) / 2}px`;
  st.style.top = `${(innerHeight - STAGE.h * scale) / 2}px`;
  document.body.classList.toggle('tall', LAYOUT === 'tall');
  document.body.classList.toggle('wide', LAYOUT === 'wide');
  // 手机横过来时字太小：提醒竖着拿
  const hint = LAYOUT === 'wide' && innerHeight < 500 && 'ontouchstart' in window;
  let h = $('.rotate-hint');
  if (hint && !h) document.body.insertAdjacentHTML('beforeend', '<div class="rotate-hint">竖屏体验更佳</div>');
  else if (!hint && h) h.remove();
  if (S && !$('#game').classList.contains('hidden')) before !== `${LAYOUT}${CELL}` ? renderAll() : layoutDock();
}

function toast(text, cls = '') {
  const el = $('#toast');
  el.className = `show ${cls}`;
  el.innerHTML = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

// ───────────── 物品与格子 ─────────────

function itemTags(it) {
  const tags = [];
  if (ITEMS[it.id].contra) tags.push(['contra', '仙门禁物']);
  if (ITEMS[it.id].illicit) tags.push(['stolen', '魔宗禁药']);
  if (lacedKnown(it)) tags.push(['laced', it.lacedBy === 'me' ? `暗中${LACE[it.laced].verb}` : `被人${LACE[it.laced].verb}（验出来了）`]);
  if (it.mark) tags.push(['stolen', markVisible(it) ? `原主烙印 · ${cn(it.mark.str)}重` : '似有残存神识，看不真切']);
  if (it.sealed) tags.push(['laced', `贴了正派封印 · 做工${GRADE_NAMES[it.grade]}`]);
  if (it.bottled) tags.push(['real', '玉净瓶装']);
  if (restoreOf(seemOf(it))) { const r = restoreOf(seemOf(it)); tags.push(['', `可服用：${r[0] ? `体力+${r[0]} ` : ''}${r[1] ? `精神+${r[1]}` : ''}`]); }
  const cures = Object.entries(CONDS).filter(([, C]) => C.cure.includes(bodyOf(seemOf(it)).id)).map(([, C]) => C.name);
  if (cures.length && it.id !== 'water') tags.push(['', `治${cures.join('、')}：${CURE_TEXT[cureGrades(it)]}`]);
  if (it.forged) tags.push(['laced', `你做的${it.fake ? '赝品' : '以次充好'} · ${GRADE_NAMES[it.grade]}`]);
  else if (isDressed(it) && knownFlaw(it)) tags.push(['fake', `以次充好 · 做工${GRADE_NAMES[it.grade]}`]);
  else if (dressable(it) && it.seen != null) tags.push(['', `已验货（${LENS_NAMES[it.seen]}）`]);
  if (it.fake && knownFlaw(it) && it.grade && !it.forged) tags.push(['', `做工${GRADE_NAMES[it.grade]}`]);
  if (ITEMS[it.id].additive) tags.push(['laced', `可作料：${LACE[ITEMS[it.id].additive].name}`]);
  if ((ITEMS[it.id].war || 0) >= 0.5) tags.push(['', '战备']);
  if (it.stolen > 0) tags.push(['stolen', `来路不明 · 余 ${it.stolen} 日`]);
  if (it.revealed) tags.push(['fake', '赝品（已识破）']);
  else if (it.verdict === 'fake') tags.push(['fake', '你判为赝品']);
  else if (it.verdict === 'real') tags.push(['real', '你判为真品']);
  else if (ITEMS[it.id].appraise) tags.push(['', '未鉴定']);
  return tags;
}

function itemStats(it) {
  const rows = [];
  if (hasQuality(it)) {
    if (isDressed(it) && knownFlaw(it)) rows.push(['表面品质', `${qualityName(it.sq)} · ${it.sq}`], ['实际品质', `${qualityName(it.q)} · ${it.q}`]);
    else rows.push(['品质', `${qualityName(shownQ(it))} · ${shownQ(it)}`]);
  }
  if (ITEMS[it.id].tool) rows.push(['鉴定术', `第${cn(ITEMS[it.id].tool)}重`]);
  if (ITEMS[it.id].book) { const b = ITEMS[it.id].book; rows.push(['当前造诣', `${TECHS[b.tech].name}第${cn(techLv(b.tech) || 0) || '零'}重`]); }
  if (it.id === 'water') rows.push(['纯度', `${it.purity}%`]);
  if (it.id === 'gu') rows.push(['成长', `${it.growth}/100`], ['毒性', it.tox], ...(it.eat ? [['吞噬', `${it.eat} 只`]] : []), ['进化', guNext(it)]);
  if (it.id === 'gu_egg' || it.id === 'gu_venom') rows.push(['毒性', it.tox]);
  if (it.id === 'spirit_crystal') rows.push(['充能', `${it.charge || 0}/${CRYSTAL_CAP}`]);
  if (isSeed(it) && it.growth) rows.push(['生长', `${it.growth}%`]);
  if (it.id === 'corpse') rows.push(['新鲜', `还能放 ${Math.max(0, Math.ceil(it.fresh / seasonOf().rot))} 日`]);
  if (it.cost != null) rows.push(['购入价', `${it.cost}`]);
  return rows;
}

function itemTip(it) {
  const d = ITEMS[it.id];
  const v = Math.round(knownValue(it) * priceMul(it.id));
  return `<h4>${esc(itemName(it))}</h4>
    <div class="tip-sub">${CATS[d.cat]} · ${d.w}×${d.h}</div>
    ${pileLine(it)}
    <div class="tip-val">估值 ${stoneTxt(v)}${Math.abs(priceMul(it.id) - 1) > 0.005 ? `<span class="${priceMul(it.id) > 1 ? 'good' : 'bad'}">行情 ×${priceMul(it.id).toFixed(2)}</span>` : ''}</div>
    ${priceBreakdown(it.id).map(([k, x]) => `<div class="tip-row small muted"><span>· ${k}</span><span>${x > 0 ? '+' : ''}${Math.round(x * 100)}%</span></div>`).join('')}
    ${itemStats(it).map(([k, val]) => `<div class="tip-row"><span>${k}</span><span>${val}</span></div>`).join('')}
    <div class="tags">${itemTags(it).map(([c, t]) => `<span class="tag ${c}">${t}</span>`).join('')}</div>
    <p>${esc(it.info ? it.info.text : d.desc)}</p>`;
}

// 一摞饲料：几份、各是什么品相或毒性——叠在一起，每份仍记着自己的
function pileLine(it) {
  const pile = stackOf(it);
  if (pile.length < 2) return '';
  const each = pile.map(o => hasQuality(o) ? qualityName(o.q) : o.tox != null ? `毒${o.tox}` : '').filter(Boolean);
  const kinds = Object.entries(each.reduce((c, k) => (c[k] = (c[k] || 0) + 1, c), {})).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ''}`);
  return `<div class="tip-row small"><span>这一格叠着 ${pile.length} 份</span><span>${kinds.join('、')}</span></div>`;
}

function itemHTML(it, extraCls = '', attrs = '') {
  const d = ITEMS[it.id];
  const badges = [];
  if (ITEMS[it.id].contra) badges.push(`<img class="badge b-tr" src="${asset('ui', 'ic_contraband')}" alt="">`);
  if (it.stolen > 0) badges.push(`<img class="badge b-tl" src="${asset('ui', 'ic_stolen')}" alt="">`);
  if (it.mark && markVisible(it)) badges.push(`<img class="badge b-bl" src="${asset('ui', 'ic_mark')}" alt="">`);
  if (it.sealed) badges.push(`<img class="badge b-br" src="${asset('ui', 'ic_seal')}" alt="">`);
  if (it.revealed || it.verdict === 'fake' || (it.forged && it.fake)) badges.push(`<span class="stamp">赝</span>`);
  else if (isDressed(it) && knownFlaw(it)) badges.push(`<span class="stamp dressed">次</span>`);
  if (it.id === 'water') badges.push(`<span class="num">${Math.floor(it.purity)}%</span>`);
  if (it.id === 'gu' && it.growth < 100) badges.push(`<span class="bar"><i style="width:${it.growth}%"></i></span>`);
  if (isSeed(it) && it.growth) badges.push(`<span class="bar"><i style="width:${it.growth}%"></i></span>`);
  if (it.id === 'corpse') badges.push(`<span class="bar rot"><i style="width:${clamp(it.fresh / 6 * 100, 0, 100)}%"></i></span>`);
  if (lacedKnown(it)) badges.push(`<span class="laced-dot" title="${LACE[it.laced].verb}"></span>`);
  if (it.id === 'spirit_crystal') badges.push(`<span class="bar power"><i style="width:${(it.charge || 0) / CRYSTAL_CAP * 100}%"></i></span>`);
  const pile = stackOf(it).length;
  if (pile > 1) badges.push(`<span class="stack-n">×${pile}</span>`);
  if (hasQuality(it) && it.q >= 85) extraCls += ' q-top';
  const style = it.pos && !extraCls.includes('preview') ? `left:${it.pos.x * CELL}px;top:${it.pos.y * CELL}px;` : 'position:relative;';
  return `<div class="item ${sel === it.uid ? 'sel' : ''} ${extraCls}" data-uid="${it.uid}" ${attrs}
      style="${style}width:${d.w * CELL}px;height:${d.h * CELL}px">
      <span class="fallback">${esc(itemName(it))}</span>
      <img src="${asset('items', itemIcon(it))}" alt="" draggable="false" onerror="this.previousElementSibling.style.display='flex'">${badges.join('')}</div>`;
}

function gridHTML(gid, label, cls = '') {
  const g = S.grids[gid];
  if (!g) return '';
  return `<div class="grid-wrap ${cls}">${label ? `<div class="grid-label">${label}</div>` : ''}
    <div class="grid" data-gid="${gid}" style="width:${g.w * CELL}px;height:${g.h * CELL}px;background-size:${CELL}px ${CELL}px">
      ${pileTops(gid).map(it => gid !== 'counter' ? itemHTML(it) : itemHTML(it, `locked ${counterCls(it)}`, tradeCustomer() ? 'data-act="good"' : '')).join('')}</div></div>`;
}

// 饲料格里叠成一摞的，只画最上面那件：选中的那件，否则最后放上去的那件；拖走的也是它
function pileTops(gid) {
  const list = itemsIn(gid);
  if (!stackCap(gid)) return list;
  const top = {};
  for (const it of list) { const k = `${it.pos.x},${it.pos.y}`; if (!top[k] || top[k].uid !== sel) top[k] = it; }
  return Object.values(top);
}

const tradeCustomer = () => S.customer && ['sell', 'buy'].includes(S.customer.kind);
function counterCls(it) {
  const c = S.customer;
  if (!tradeCustomer()) return '';
  return `${c.item === it.uid ? 'focus' : ''} ${(c.take || []).includes(it.uid) ? 'take' : ''}`;
}

// ───────────── 顶栏 ─────────────

const PHASE_NAME = { morning: '晨 · 开铺前', day: '昼 · 营业中', night: '夜 · 已打烊' };

function renderTopbar() {
  const due = S.grace > 0 ? `<span class="bad">欠租 ${S.rentOwed} · 宽限 ${S.grace} 日</span>`
    : `租金 ${rentAmount()} · 第 ${S.rentDue} 日（${S.rentDue - S.day} 日后）`;
  const plan = powerPlan();
  const deedP = clamp(S.stones / deedPrice() * 100, 0, 100);
  $('#topbar').innerHTML = `
    <div class="tb-day" title="${calendar().yearText}">${icon(S.phase === 'night' ? 'ic_night' : 'ic_day')}<b>第 ${S.day} 日</b>
      <span class="tb-cal">${calendar().text}${annualOf() ? ` · <em>${annualOf().name}</em>` : ''}<br>${PHASE_NAME[S.phase]}</span></div>
    ${S.plan && S.plan.inspect && S.plan.tipped && S.plan.day === S.day ? `<div class="tb-cell tipchip" title="${esc(S.plan.tipped)}捎来的风声">${icon('ic_heat')}今日巡查</div>` : ''}
    <div class="tb-cell dao" data-act="dao" title="修为：服炼丹药魂魄，破境要钥匙。点开查看">${icon('ic_dao')}<span>${realmName()}<br><small>${realm().need ? `${S.cult.xp}/${realm().need}` : '圆满'}</small></span></div>
    ${S.fate && (S.fate.n || S.fate.debts.length || S.fate.infamy) ? `<div class="tb-cell fate" data-act="fate-open" title="因果：点开查看孽债">孽<b>${S.fate.debts.length}</b>${S.fate.infamy ? `<small>恶名${S.fate.infamy}</small>` : ''}</div>` : ''}
    <div class="tb-cell" title="善名 ${S.virtue}：做好人要掏钱，善名太盛还会被人当软柿子捏；但你帮过的人，偶尔会回来报答">善<b>${VIRTUE_NAME(S.virtue)}</b></div>
    ${condList('me').map(c => CONDS[c.kind] ? `<div class="tb-cell cond" data-act="heal-open" title="${esc(CONDS[c.kind].desc)}点开求医">${c.label}</div>`
      : `<div class="tb-cell cond" title="体力或精神见底：比斗、动手吃亏，说谎易露馅">${c.label}</div>`).join('')}
    <div class="tb-cell power" title="你在杂役区的势力：${powerParts().map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('，')}">势 <b>${playerPower()}</b></div>
    <div class="tb-cell war st${S.world.stage}" title="四方紧张 ${tension()}：${warStage().text}">${icon('ic_war')}<span>${warStage().name}</span></div>
    <div class="tb-cell big">${stoneTxt(S.stones)}</div>
    <div class="tb-cell vit" title="体力：搬运、翻找、开炉都要力气">${icon('ic_stamina')}<span class="meter st"><i style="width:${S.vit.st}%"></i></span><span>${S.vit.st}</span></div>
    <div class="tb-cell vit" title="精神：鉴定、探查、画符、炼丹、议价都耗神">${icon('ic_spirit')}<span class="meter sp"><i style="width:${S.vit.sp}%"></i></span><span>${S.vit.sp}</span></div>
    <div class="tb-cell rent">${icon('ic_ledger')}<span>${due}</span></div>

    <div class="tb-cell heat" title="执法堂关注：越高越容易被巡查；满一百即被锁拿">${icon('ic_heat')}
      <span class="meter"><i style="width:${S.heat}%"></i></span><span>${S.heat}</span></div>
    <div class="tb-cell" title="铺契 ${deedPrice()} 灵石">${icon('ic_deed')}<span class="meter gold"><i style="width:${deedP}%"></i></span></div>
    <div class="tb-spacer"></div>
    <button class="btn small ghost" data-act="menu">卷宗</button>`;
}

// ───────────── 场景与柜台 ─────────────

function speechFor(c) {
  if (!c) {
    if (S.phase === 'morning') return `晨钟响过三遍。${todayText()}${S.market.text}${tipText()}`;
    if (S.phase === 'night') return '血月当空，杂役区只剩几盏灯笼。去拾些破烂，还是早些歇息？';
    // 门口自有“请下一位”的牌子，人走光了才提醒去点打烊牌
    return S.queue.length ? '' : `今日的客人都走了。${LAYOUT === 'tall' ? '点左边的「打烊」' : '点门上那块打烊牌'}，就算打烊。`;
  }
  const it = customerItem();
  const sig = [c.kind, c.told, c.afterAppraisal, it && it.disputed].join('|');
  if (c.lineSig !== sig) { c.line = speechAs(personOf(c), composeLine(c)); c.lineSig = sig; }
  return c.line;
}

// 开铺前收到的巡查风声：原先写在柜台窗口里，现在由晨间独白说出来
function tipText() {
  if (!(S.plan && S.plan.inspect && S.plan.tipped && S.plan.day === S.day)) return '';
  const banned = bannedShown();
  return `${S.plan.tipped}捎来话：今日执法堂要来巡查（${S.plan.reason}）。${banned.length ? `陈列柜里还摆着${banned.map(itemName).join('、')}！` : ''}趁开门前把禁物、赃物撤下，藏进暗格。`;
}

function composeLine(c) {
  const it = customerItem(), f = c.faction, addr = ADDRESS[f];
  const brought = c.kind === 'buy' && goodsOf().length ? `另外，这${goodsOf().map(itemName).join('、')}也想出手。` : '';
  const peek = c.reporting ? `（${ta(personOf(c))}盯着你的陈列柜看了半天，脸色有些古怪。）` : '';
  if (c.kind === 'inspect') return '执法堂巡查！柜台里外，都给我打开。';
  if (c.kind === 'story') return `（${c.name}似乎有话要说。）`;
  if (c.refuse) return voice(f, 'refuse');
  if (c.offended) return '你柜里摆着我族人的妖丹、妖皮？呸！这种铺子，不进也罢。';
  if (c.kind === 'plea') return greeting(c) + pleaLine(c);
  if (c.kind === 'sell' && it) {
    if (c.afterAppraisal) return c.told === 'fake' ? `既是赝品，留着也是占地方。${it.ask} 灵石，${addr}收了吧。`
      : `既然是真品……${it.ask} 灵石，${addr}要不要？`;
    if (it.disputed === 'ok') return `啊？……罢了罢了，这${itemName(it)}${it.ask} 灵石，${addr}收了吧。`;
    if (it.disputed === 'caught') return `少来这套！我这${itemName(it)}是正经货，${it.ask} 灵石，一个子儿不能少。`;
    const goods = goodsOf();
    const vars = { item: goods.map(itemName).join('、'), ask: goods.reduce((s, g) => s + g.ask, 0) };
    let line = goods.some(g => ITEMS[g.id].contra) ? voice(f, 'contra', vars) : lineOf(c, 'sell', vars);
    if (goods.some(g => g.stolen)) line += voice(f, 'stolen');
    if (c.wantId) line += `顺便……有${ITEMS[c.wantId].name}的话，我也要${needCn(c.need || 1)}${needUnit(c)}。`;
    return peek + greeting(c) + line;
  }
  if (c.noble) return nobleLine(c);
  if (c.craving) return gx(personOf(c), voice(f, 'crave') + needLine(c));
  if (c.wishId) return greeting(c) + voice(f, c.wishSeen ? 'wish' : 'wishAsk', { item: ITEMS[c.wishId].name });
  if (c.forGift) return greeting(c) + `（压低声音）${addr}，在下要备一份${CATS[c.wantCat]}送人。不必是真的——只要做得够像，收礼的人看不出来便好。价钱嘛，自然不能按真货算。`;
  if (c.wantFake) return greeting(c) + `（压低声音）${addr}，上回那种“好东西”还有么？就是看着像真的那种。`;
  if (c.kind === 'buy') return peek + greeting(c) + lineOf(c, c.attracted ? 'attracted' : 'buy', { cat: c.wantId ? ITEMS[c.wantId].name : CATS[c.wantCat] }) + needLine(c) + brought;
  return greeting(c) + voice(f, 'appraise', { item: itemName(it), fee: c.fee });
}

// 掌柜视角：隔着自家柜台望向店门与街面。来客从门口走进来，有的只站在门口、门外
let shown = null;   // 正在场上的来客：{ key, src, stage }
// 刚送走、脸上还带着神情的来客：弹窗开着就一直留在柜台前，弹窗关了再停一会儿才转身走——不然神情换上的那一刻正被弹窗挡着
let parting = null;
const PART_MS = 1300;

const visitorKey = c => c.pid || c.key || c.name;
const sceneArt = name => ART_SET.has(`scene/${name}`);

function renderScene() {
  const c = S.customer;
  const night = S.phase === 'night';
  const front = sceneArt('shop_front');
  $('#scene .bg').src = night ? asset('scene', 'night_street') : front ? asset('scene', 'shop_front') : asset('scene', 'shop_back');
  $('#scene .fg').src = front ? asset('scene', 'counter_top') : asset('scene', 'shop_counter');
  $('#scene .fg').style.display = night ? 'none' : '';
  $('#scene').classList.toggle('realistic', front);
  $('#scene').classList.toggle('night', night);
  const p = $('#portrait');
  if (night || (c && parting && parting.c !== c)) parting = null;
  if (parting && !parting.until && !$('#modal-layer').classList.contains('on')) {
    parting.until = Date.now() + PART_MS;
    setTimeout(renderScene, PART_MS + 20);
  }
  if (parting && parting.until && Date.now() >= parting.until) parting = null;
  const v = c || (parting && parting.c);
  if (v && v.portrait) {
    const src = asset('chars', portraitOf(v)), key = visitorKey(v), st = stageOf(v);
    if (!shown || shown.key !== key) {
      // 新来的：先出现在门口，再走到该站的地方
      p.className = 'st-door arriving';
      p.src = src;
      void p.offsetWidth;
      p.className = `st-${st}`;
    } else {
      if (!p.src.endsWith(src)) p.src = src;
      p.className = `st-${st}`;
    }
    p.style.display = '';
    shown = { key, src, stage: st };
  } else if (shown) {
    // 送客：转身走回门口，消失在街上
    p.className = 'st-door leaving';
    shown = null;
    setTimeout(() => { if (!shown) p.style.display = 'none'; }, 650);
  } else p.style.display = 'none';
  // 门外候着的人：下两位来客的暗影
  const waiting = S.phase === 'day' ? S.queue.slice(0, 2).filter(q => q.portrait) : [];
  $('#crowd').innerHTML = waiting.map((q, i) => `<img class="w${i}" src="${asset('chars', `${q.portrait}~neutral`)}" alt="">`).join('');
  const f = c ? FACTIONS[c.faction] : null;
  $('#nameplate').innerHTML = c ? `${icon(f.icon)}<b>${esc(c.name)}</b><span>${f.name} · ${esc(c.title || '')}</span>
     ${c.wanted ? `<span class="tag stolen">通缉 · 赏 ${c.wanted}</span>` : ''}
     ${c.attracted ? `<span class="tag real">慕陈列而来</span>` : ''}
     ${c.savvy != null && c.kind !== 'story' ? `<span class="tag">神色·${demeanor(c)}</span>` : ''}
     ${personTags(c)}` : '';
  $('#nameplate').style.display = c ? '' : 'none';
  renderSpeech(speechFor(c));
  // 点门口开门迎客、请下一位；门上的打烊牌白天点得动，客人走光了就亮一亮
  const door = $('#door'), act = S.phase === 'morning' ? 'open' : S.phase === 'day' && !c && S.queue.length ? 'next' : '';
  door.style.display = act ? '' : 'none';
  door.dataset.act = act;
  door.firstChild.textContent = act === 'open' ? '开门迎客' : `请下一位 · 门外 ${S.queue.length} 位`;
  const sign = $('#closesign');
  sign.style.display = S.phase === 'day' ? '' : 'none';
  sign.classList.toggle('due', !c && !S.queue.length);
}

// 竖屏的话按字幕显示：长了就分段，点一下看下一段；换了一句话从头开始
let talk = { text: '', i: 0 };

function speechParts(text) {
  if (LAYOUT !== 'tall' || !text) return text ? [text] : [];
  const max = Math.max(24, Math.floor(($('#scene').clientWidth - 112) / 18) * 2 - 1);   // 18px 字两行，末尾留一格给 ▼
  const out = [];
  const bits = text.match(/[^。！？!?…]+(?:[。！？!?…]+[」”’）)]*)?/g) || [text];
  bits.flatMap(b => b.length > max ? b.match(/[^，、；]+[，、；]?/g) : [b]).forEach(b => {
    if (out.length && out[out.length - 1].length + b.length <= max) out[out.length - 1] += b;
    else out.push(b);
  });
  return out;
}

// 对白里的要紧字眼：货名、品类与数目，长的先配
let kwRe = null;
function keywords(html) {
  if (!kwRe) {
    const names = [...new Set([...Object.values(ITEMS).map(d => d.name), ...Object.values(CATS)])].filter(Boolean)
      .sort((a, b) => b.length - a.length).map(n => esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    kwRe = new RegExp(`${names.join('|')}|\\d+(?:[–-]\\d+)?(?:\\s?灵石)?`, 'g');
  }
  return html.replace(kwRe, m => `<b class="kw">${m}</b>`);
}

function renderSpeech(text) {
  if (talk.text !== text) talk = { text, i: 0 };
  const parts = speechParts(text), sp = $('#speech');
  talk.i = Math.min(talk.i, Math.max(0, parts.length - 1));
  const more = talk.i < parts.length - 1;
  sp.innerHTML = parts.length ? keywords(esc(parts[talk.i])) + (more ? '<i class="more">▼</i>' : '') : '';
  if (more) sp.dataset.act = 'speech-more'; else delete sp.dataset.act;
}

function personTags(c) {
  const p = personOf(c);
  if (!p) return '';
  const m = mood(p.aff);
  return `<span class="tag mood-${m}" title="好感 ${p.aff}">${MOOD_NAME[m]}</span>${p.visits > 1 ? `<span class="tag">第 ${p.visits} 回来</span>` : '<span class="tag">初见</span>'}`;
}

function patienceHTML(c) {
  return `<span class="patience" title="耐心">${'●'.repeat(Math.max(0, c.patience))}${'○'.repeat(Math.max(0, 4 - c.patience))}</span>`;
}

function renderCounter() {
  const el = $('#counter-panel');
  const c = S.customer;
  // 开铺前、柜台前没人时不占窗口：开门、请客、打烊都点画面里的门口与牌子
  if (S.phase === 'morning' || (S.phase === 'day' && !c)) { el.innerHTML = ''; return; }
  if (S.phase === 'night') {
    el.innerHTML = `<div class="cp-col wide">
        <h3>夜</h3>
        <p>设备在你入定时运转，按「工坊」页的顺序取用灵力，也要耗你的体力与精神——精力不济的设备会停工。歇息后恢复。</p>
        <p class="muted small">${S.scavenged ? '今夜已出去过了。' : `今夜可出门一趟：拾荒（每翻一次 ${costText('dig')}），或去鬼市（${costText('market')}${isGhostNight() ? '，今夜鬼市开张，货多且不惹执法堂' : '，非鬼市夜，执法堂关注 +2'}）。`}
          ${S.retreat ? '<b class="good">今夜闭关：</b>诸炉出品更精，地火炉可炼神兵胚料；歇息恢复得少。' : `闭关（${costText('retreat')}）：今夜亲自坐镇炉火。`}</p>
      </div>
      <div class="cp-actions">
        <button class="btn" data-act="scavenge" ${S.scavenged ? 'disabled' : ''}>${icon('ic_scavenge')}外出拾荒</button>
        <button class="btn" data-act="market" ${S.scavenged ? 'disabled' : ''}>鬼市${isGhostNight() ? '（开张）' : ''}</button>
        <button class="btn ${S.retreat ? 'danger' : ''}" data-act="retreat">${S.retreat ? '取消闭关' : '闭关'}</button>
        <button class="btn primary big" data-act="sleep">入定歇息</button></div>`;
    return;
  }
  const f = FACTIONS[c.faction];
  let mid = '', acts = '';
  const pp = personOf(c), secretKnown = pp && pp.secret && pp.secret.known && pp.status === 'alive';
  const intel = !pp || pp.story || pp.official || ['story', 'inspect'].includes(c.kind) ? ''
    : secretKnown ? `<div class="intel">${icon('ic_secret')}<b>${esc(pp.secret.type)}</b>${c.confided ? `（${ta(pp)}自己向你吐露的）` : ''}——
        向${CHANNEL_NAME[pp.secret.to]}举报可得赏金约 ${pp.secret.bounty}、${FACTIONS[pp.secret.to].name}功勋 ${pp.secret.merit}${channelOpen(pp.secret.to) ? '' : `（尚未搭上线：${channelHint(pp.secret.to)}）`}
        ${c.reportedSecret ? `<span class="intel-acts muted small">已暗中递了信，等${ta(pp)}出门</span>` : `<span class="intel-acts"><button class="btn tiny danger" data-act="secret-report" title="${esc(sinHint(['betray', 2]))}" ${channelOpen(pp.secret.to) ? '' : 'disabled'}>举报</button>
        <button class="btn tiny" data-act="secret-blackmail" title="${esc(sinHint(['betray', 2]))}">要挟 ${Math.round(Math.min(0.95, overpowerOdds(pp) + 0.1) * 100)}%</button>
        ${pp.owes ? `<span class="muted small">${ta(pp)}欠你人情</span>` : '<button class="btn tiny" data-act="secret-keep">守口如瓶</button>'}</span>`}</div>`
      : !c.probed && !pp.cleared ? `<div class="intel muted small">${icon('ic_secret')}<button class="btn tiny" data-act="probe" title="${costText('probe')}，看透约 ${Math.round(probeOdds(pp) * 100)}%">神识探查 ${Math.round(probeOdds(pp) * 100)}%</button></div>` : '';
  const dark = pp && !pp.story && ['sell', 'buy', 'plea'].includes(c.kind) && !c.refuse && killable(pp) ? `<div class="intel small">
      ${icon('ic_dao')}<span class="muted">${esc(c.name)}是${realmName(npcLevel(pp))}，你是${realmName()}。</span>
      <button class="btn tiny danger" data-act="kill" ${canKill(pp) ? `disabled title="${esc(canKill(pp))}"` : `title="成算 ${pct(killOdds(pp, false))}，${costText('kill')}${deathWarn('injured')}"`}>关门打狗${canKill(pp) ? '' : ` ${pct(killOdds(pp, false))}`}</button>
      ${canSoulMark(pp) ? '' : `<button class="btn tiny danger" data-act="soulmark">种魂印 ${pct(soulMarkOdds(pp))}</button>`}</div>` : '';
  if (c.kind === 'story') {
    const node = storyNode(S.story[c.key]);
    mid = `${customerItem() ? `<div class="cp-item">${gridHTML('counter', '柜台')}<div>` : '<div>'}
      <p><b>${esc(c.name)}</b>有话要说。</p><p class="muted">${esc(S.story[c.key].summary || '')}</p></div>${customerItem() ? '</div>' : ''}`;
    acts = `<button class="btn primary" data-act="story-talk">交谈</button>`;
  } else if (c.refuse) {
    const p = personOf(c);
    mid = `<p>${esc(c.name)}还记着你：</p><p class="muted">“${esc((salientMemory(p) || p.mem[p.mem.length - 1] || { t: '……' }).t)}”</p>
      <p class="muted small">好感跌到这个地步，对方不肯再与你做买卖。</p>`;
    acts = `<button class="btn primary" data-act="dismiss">送客</button>`;
  } else if (c.kind === 'inspect') {
    const e = official('enforcer'), stake = inspectionStake(), price = bribePrice(e, stake);
    const tiers = [...new Set([0.6, 1, 1.6].map(k => Math.max(10, Math.round(price * k / 10) * 10)))];
    mid = `<p>${esc(e.name)}会翻检陈列柜、库房、地面与货摊。<b>禁物</b>、<b>禁药</b>与<b>来路不明</b>的货一经搜出即充公并罚款；暗格里的东西搜不到。</p>
      <p class="muted small">他估摸能从你这儿抄到约 ${stake} 灵石的油水。规矩有价：给够了，就什么也没看见；给少了，他会觉得受了侮辱。
        ${S.flags.enforcerOwned ? '<b class="good">他是你的人。</b>' : ''}</p>`;
    acts = `<button class="btn primary" data-act="inspect">配合搜查</button>
      ${tiers.map(n => `<button class="btn small" data-act="bribe" data-n="${n}" ${S.stones < n ? 'disabled' : ''}>打点 ${n}<small>&nbsp;成算 ${Math.round((S.flags.enforcerOwned ? 1 : bribeOdds(e, stake, n)) * 100)}%</small></button>`).join('')}`;
  } else if (c.offended) {
    mid = `<p>${f.name}客人看见陈列柜里的妖族遗物，拂袖而去。<span class="bad">妖族声望 -3</span></p>`;
    acts = `<button class="btn primary" data-act="dismiss">送客</button>`;
  } else if (c.kind === 'plea') {
    ({ mid, acts } = pleaPanel(c));
  } else if (c.kind === 'sell' || c.kind === 'buy') {
    ({ mid, acts } = tradePanel(c));
  } else {
    mid = `<div class="cp-item">${gridHTML('counter', '柜台')}
      <div><p>鉴定委托，酬金 ${stoneTxt(c.fee)}</p><p class="muted">看清真伪后，告诉${ta(personOf(c))}什么由你定。如实相告可得声望；
        把真品说成赝品，对方多半会贱卖给你——但精明的人未必骗得过，当场识破要丢声望，事后也可能翻出旧账。</p></div></div>`;
    acts = `<button class="btn primary" data-act="appraise-commission">${icon('ic_appraise')}照妖镜鉴定</button>
      <button class="btn ghost" data-act="dismiss">婉拒</button>`;
  }
  el.innerHTML = `<div class="cp-col wide">${mid}${intel}${dark}</div><div class="cp-actions">${acts}</div>`;
}

// 求助：接济、放贷、收作苦力，或者撵走
function pleaPanel(c) {
  const amt = c.need * 3, TA = ta(personOf(c));
  const mid = gx(personOf(c), `<p>${esc(c.name)}求你：${esc(c.plea)}。</p>
    <p class="small muted">接济他，他会记着你，往后在街头巷尾替你听消息——这世道，好心多半换不回什么，偶尔却换得回一条命。
      放贷利厚，还不上就由你处置；收作苦力，他替你烧炉搬货，干到死为止。</p>`);
  const acts = `<button class="btn small" data-act="plea-help" ${S.stones < c.need ? 'disabled' : ''}>接济 ${c.need}</button>
    <button class="btn small" data-act="plea-lend" ${S.stones < amt ? 'disabled' : ''} title="七日还 ${Math.round(amt * 1.5)}">借${TA} ${amt}</button>
    <button class="btn small danger" data-act="plea-labor">收作苦力</button>
    <button class="btn ghost small" data-act="plea-away">撵走</button>`;
  return { mid, acts };
}

// 修为：服炼、破境、杀伐的规矩
// 面上看得出的药力：看不出毛病的赝品、以次充好的，照它装出来的样子算；吃下去才见真章（见 bodyOf、potency）
const seemOf = it => knownFlaw(it) || !(it.fake || isDressed(it)) ? it : Object.assign({}, it, { fake: false, q: it.sq != null ? it.sq : it.q });

function openDao() {
  const r = realm(), why = canBreak();
  const goods = Object.values(S.items).filter(it => HELD(it) && cultXp(seemOf(it))).sort((a, b) => cultXp(seemOf(b)) - cultXp(seemOf(a)));
  openModal(() => { const pg = pager(goods.filter(it => S.items[it.uid]), 6, 'dao'); modalHTML(`<h3>${icon('ic_dao')}修为 · ${realmName()}</h3>
    <p>${r.need ? `修为 <b>${S.cult.xp}</b> / ${r.need}，破入${realmName(S.cult.lv + 1)}还要一件<b>${ITEMS[r.key].name}</b>作钥匙。成算约 ${pct(breakOdds())}${S.retreat ? '（今夜闭关，加一成五）' : '（夜里闭关时冲关更稳）'}。` : '你已至此界尽头。'}</p>
    <p class="small muted">境界越高，势力越大、夜里恢复越多、说谎越不易被识破。修为高过对方，就能在柜台上“关门打狗”或夜里截杀，夺他的货、灵石、尸身与魂魄；也能以修为威压、种魂印叫人听话。
      吞魂饮血也能涨修为，只是越炼越不像人。</p>
    <div class="gift-list">${pg.items.map(it => `<div class="gift-row" data-act="cultivate" data-uid="${it.uid}">${itemHTML(Object.assign({}, it, { pos: null }), 'preview mini')}
      <span>${esc(itemName(it))}${it.id === r.key ? '<em class="laced-txt">（破境之物）</em>' : ''}</span><span class="good">修为 +${cultXp(seemOf(it))}</span>${(CULT_XP[it.id] || [])[1] ? '<span class="bad small">损阴德</span>' : ''}</div>`).join('') || '<p class="muted">手头没有能服炼的东西：丹药、魂魄、妖丹、精血、琼浆玉露……</p>'}</div>${pg.nav}
    <div class="h-btns"><button class="btn danger" data-act="breakthrough" ${why ? `disabled title="${esc(why)}"` : ''}>冲关破境（${costText('breakthrough')}）</button>
      <button class="btn primary" data-act="modal-close">合上</button></div>`, 'm-gift'); });
}

// ───────────── 派系 ─────────────

const OPP_NAME = { order: '订单', auction: '抄没拍卖', launder: '赃物过明路', captive: '战俘发卖', license: '丹药包销', supply: '珍材配给', salon: '雅集请柬', tip: '内线消息' };

function oppHTML(o) {
  const C = CLIQUES[o.cid], left = `<span class="muted small">至第 ${o.until} 日</span>`;
  const head = `<b style="color:${o.cid === 'law' ? '#8fd3ff' : '#e0524a'}">${C.name}</b> · ${OPP_NAME[o.type]}`;
  if (o.type === 'order' || o.type === 'license') {
    const goods = oppGoods(o);
    const what = o.type === 'order' ? `${ITEMS[o.id].name} ×${o.left}，每件约 ${o.unit}（市价 ${marketPrice(o.id)}）` : `丹药按行情 ×${o.mul.toFixed(2)} 收，还收 ${o.left} 件`;
    return `<div class="opp">${head} ${left}<p class="small">${what}</p>
      <div class="merit-goods">${goods.slice(0, 6).map(it => `<button class="btn tiny" data-act="opp-deliver" data-key="${o.key}" data-uid="${it.uid}">交${esc(itemName(it))} ${oppUnit(o, it)}</button>`).join('') || '<span class="muted small">手头没有对口的货</span>'}</div></div>`;
  }
  const desc = ({
    auction: () => `一批抄家抄来的货（${o.items.map(id => ITEMS[id].name).join('、')}），市价约 ${o.value}，一口价 ${o.price}，来路干净。`,
    launder: () => `给你手里的赃物补上执法堂勘合，抹去烙印，按货值收 ${Math.round(o.rate * 100)}% 的辛苦钱。`,
    captive: () => `一名仙门战俘，${o.price} 灵石。处置之后得修士遗蜕、生魂与精血。（还剩 ${o.left} 名）`,
    supply: () => `${ITEMS[o.id].name}按配给价每件 ${o.unit}（市价 ${marketPrice(o.id)}），还有 ${o.left} 件。`,
    salon: () => `少宗主的雅集请柬：${o.guests} 位权贵会上门“赏玩”。他们阔绰、傲慢、眼力平平。`,
    tip: () => '少宗主身边的人肯透个口风——一份行情密报。',
  })[o.type]();
  const price = o.type === 'auction' || o.type === 'captive' ? o.price : o.type === 'supply' ? o.unit : 0;
  return `<div class="opp">${head} ${left}<p class="small">${desc}</p>
    <button class="btn tiny" data-act="opp-take" data-key="${o.key}" ${price && S.stones < price ? 'disabled' : ''}>${price ? `${price} 灵石` : '接下'}</button></div>`;
}

function tabClique() {
  const J = S.cliques.joined, s = sel && S.items[sel];
  const offer = s && HELD(s) ? s : null;
  const dirt = offer && offer.id === 'intel' && !intelExpired(offer) && offer.info.kind === 'clique' ? offer : null;
  const rows = Object.entries(CLIQUES).map(([k, C]) => {
    const c = S.cliques[k], t = tierOf(k);
    return `<div class="clique ${J === k ? 'joined' : ''}"><img src="${asset('chars', C.portrait)}" alt="">
      <div class="cq-body"><div><b>${C.name}</b> <span class="muted small">${C.head} · 对头：${CLIQUES[C.rival].name}</span>
        <span class="tag ${t >= 1 ? 'real' : ''}">${TIER_NAME[t]}</span></div>
        <div class="pc-aff"><span class="small">好感</span><span class="aff-bar"><i class="${c.st >= 0 ? 'pos' : 'neg'}" style="width:${Math.abs(c.st) / 2}%"></i></span><b>${c.st}</b>
          <span class="small">权势</span><span class="meter"><i style="width:${c.pw}%"></i></span><b class="${c.pw <= 30 ? 'bad' : ''}">${Math.round(c.pw)}</b></div>
        <p class="small muted">${C.desc} 看重：${C.likes.map(x => CATS[x]).join('、')}。</p>
        <div class="merit-goods">${[100, 300].map(n => `<button class="btn tiny" data-act="cq-tribute" data-k="${k}" data-n="${n}" ${S.stones < n ? 'disabled' : ''}>孝敬 ${n}</button>`).join('')}
          ${offer && !dirt ? `<button class="btn tiny" data-act="cq-offer" data-k="${k}">进献${esc(itemName(offer))}（+${Math.round(cliqueGiftValue(k, offer) / (20 + Math.max(0, c.st) / 2))}）</button>` : ''}
          ${dirt && dirt.info.cid !== k ? `<button class="btn tiny danger" data-act="cq-leak" data-k="${k}" ${CLIQUES[dirt.info.cid].rival === k ? '' : 'disabled title="只有对头一系才要"'}>递上${esc(itemName(dirt))}</button>` : ''}
          ${!J ? `<button class="btn tiny ${c.st >= 30 ? 'primary' : ''}" data-act="cq-join" data-k="${k}" ${c.st >= 30 ? '' : 'disabled title="好感 30 才肯收"'}>投靠</button>` : ''}</div></div></div>`;
  });
  const opps = liveOpps();
  const sub = subtabs('clique', [['four', '四系'], ['opps', `独家买卖${opps.length ? `（${opps.length}）` : ''}`]]);
  const pg = pager(sub.cur === 'four' ? rows : opps.map(oppHTML), sub.cur === 'four' ? (LAYOUT === 'tall' ? 2 : 2) : rowsFit(70, 1), `clique-${sub.cur}`);
  return `<div class="clique-tab">${sub.html}
    ${sub.cur === 'four' ? `<p class="small muted">四股势力明争暗斗。攀上一系，换来别人拿不到的买卖；投到谁门下，谁倒台你也跟着被清算。权势跌破二十就被清洗。${offer ? '' : '选中一件货可以拿去进献。'}</p>` : ''}
    ${pg.items.join('') || '<p class="muted small">还没有哪一系肯给你机会。好感到 10 才有往来。</p>'}${pg.nav}</div>`;
}

// 货盘上的货凑得怎样：要的凑了几件、急需的药、顺带的、多出来压价的
function trayTally(c, d) {
  const n = r => d.give.filter(g => g.role === r).length, u = needUnit(c), extra = n('extra');
  if (!c.wantCat) return `货盘上${ta(personOf(c))}收 ${d.give.length} 件`;
  return `货盘上凑了 <b class="${d.got >= d.need ? 'good' : ''}">${Math.min(d.got, d.need)}/${d.need}</b>`
    + (n('cure') ? `，急需的药 ${n('cure')} ${u}` : '') + (n('side') ? `，顺带 ${n('side')} 样` : '')
    + (extra ? `，<span class="bad">多出 ${extra} 件只肯出五成</span>` : '');
}

// 交易盘：他的货在柜台上，你的货摆在货盘上，一并谈价
function tradePanel(c) {
  const it = customerItem(), d = dealOf(c), goods = goodsOf();
  const lo = Math.round(c.budget * 0.85 / 10) * 10, hi = Math.round(c.budget * 1.15 / 10) * 10;
  const taking = it && (c.take || []).includes(it.uid);
  const flawSeen = it && isDressed(it) && (it.seen || 0) >= it.grade;
  const s = sel && S.items[sel], canTray = s && HELD(s) && s.pos.g !== 'tray';
  let info = c.wantCat ? `<p>${c.attracted ? '冲着陈列柜里的' : '想要'} <b class="cat">${esc(wantText(c))}</b> <b class="need">要 ${needText(c)}</b>${c.noble ? '' : '，别的对口的也肯顺带捎上两样（只出六五成）；多出来的只肯出五成'}，预算约 ${stoneTxt(`${lo}–${hi}`)} ${patienceHTML(c)}</p>`
    : `<p>只想出手，不买什么。${patienceHTML(c)}</p>`;
  if (c.noble) info += `<p class="small laced-txt">权贵眼高于顶：嫌便宜货寒碜，眼力却不怎么样；捧得越高，看得越马虎。${c.flatter ? `（已捧了 ${c.flatter} 回）` : ''}</p>`;
  if (it) {
    info += `<p class="small"><b>${esc(itemName(it))}</b> 开价 ${stoneTxt(it.ask)} ${taking ? '<span class="tag real">要收</span>' : ''}
      ${ITEMS[it.id].appraise && !it.told ? '<span class="muted">· 可用照妖镜鉴定，当面指为赝品压价</span>' : ''}</p>`;
    if (dressable(it) && it.seen != null) info += `<p class="small ${flawSeen ? 'bad' : 'muted'}">${flawSeen ? `验出来了：以次充好，表面${it.sq}，实际只有${it.q}。` : `以你的眼力（${LENS_NAMES[it.seen]}）看不出毛病。`}</p>`;
  }
  if (d.give.length || d.take.length || d.reject.length) info += `<p class="small muted">${trayTally(c, d)}（心理价约 ${Math.round(d.V)}）${d.reject.length ? `，<span class="bad">不要${d.reject.map(itemName).join('、')}</span>` : ''}${d.take.length ? `；你要收 ${d.take.length} 件（开价 ${d.A}）` : ''}。</p>`;
  const mid = `<div class="trade">${goods.length ? gridHTML('counter', `${ta(personOf(c))}的货 · 点选`) : ''}${gridHTML('tray', '你的货盘 · 拖货上来')}</div>${info}`;
  const acts = `${it && ITEMS[it.id].appraise && !it.told ? `<button class="btn small" data-act="appraise-counter">${icon('ic_appraise')}照妖镜</button>` : ''}
    ${it && (dressable(it) || isLaceable(it.id)) && it.seen == null ? `<button class="btn small" data-act="inspect-item">${icon('ic_appraise')}验货</button>` : ''}
    ${it && dressable(it) && !it.disputed ? `<button class="btn small" data-act="dispute-flaw" title="${flawSeen ? '揭穿以次充好，压价' : '挑毛病压价'}">${flawSeen ? '揭穿' : '压价'}</button>` : ''}
    ${it ? `<button class="btn small" data-act="take-toggle">${taking ? '不收' : '收下'}</button>` : ''}
    ${canTray ? `<button class="btn small wide-only" data-act="to-tray">选中的放上货盘</button>` : ''}
    ${c.noble ? `<button class="btn small" data-act="flatter" title="${costText('flatter')}">吹捧</button>` : ''}
    <button class="btn primary" data-act="deal" ${d.give.length || d.take.length ? '' : 'disabled'}>谈价成交</button>
    ${c.wanted ? c.reportedWanted ? `<span class="muted small">已暗中报官，等${ta(personOf(c))}出门</span>` : `<button class="btn small danger" data-act="report" title="${esc(sinHint(['betray', 1]))}">暗中举报 赏${c.wanted}</button>` : ''}
    <button class="btn ghost small" data-act="dismiss">送客</button>`;
  return { mid, acts };
}

// ───────────── 侧栏分页 ─────────────

const TABS = [['display', '陈列'], ['workshop', '工坊'], ['broker', '货郎'], ['people', '人物'], ['clique', '派系'], ['rep', '时局'], ['ledger', '账本']];
// 竖屏侧栏：五个常用页，其余收进“更多”；白天最后一颗是打烊
const NAV = [['store', '库房', 'ic_ledger'], ['display', '陈列', 'ic_appraise'], ['workshop', '工坊', 'ic_power'], ['people', '人物', 'ic_gift'], ['more', '更多', 'ic_war']];
const MORE = ['broker', 'clique', 'rep', 'ledger'];
let lastMore = 'broker';

function renderSide() {
  if (LAYOUT === 'wide' && tab === 'store') tab = 'display';
  if (MORE.includes(tab)) lastMore = tab;
  const group = LAYOUT === 'tall' && MORE.includes(tab);
  const list = LAYOUT === 'tall' ? TABS.filter(([id]) => MORE.includes(id)) : TABS;
  $('#tabs').innerHTML = list.map(([id, name]) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${name}</button>`).join('');
  document.body.classList.toggle('tab-store', tab === 'store');
  document.body.classList.toggle('tab-more', group);
  $('#nav').innerHTML = NAV.map(([id, name, ic]) => `<button class="${tab === id || (id === 'more' && group) ? 'on' : ''}" data-act="tab" data-tab="${id === 'more' ? lastMore : id}">${icon(ic)}${name}</button>`).join('')
    + (S.phase === 'day' ? `<button class="closing ${S.customer || S.queue.length ? '' : 'due'}" data-act="close">${icon('ic_night')}打烊</button>` : '');
  if (tab !== 'store') $('#tab-body').innerHTML = { display: tabDisplay, workshop: tabWorkshop, broker: tabBroker, people: tabPeople, clique: tabClique, rep: tabRep, ledger: tabLedger }[tab]();
  layoutDock();
}

// ───────────── 分页与子页签：用横向翻页代替上下滚动 ─────────────

const pages = {}, subs = {};

function pager(list, per, key) {
  const n = Math.max(1, Math.ceil(list.length / per));
  const i = pages[key] = clamp(pages[key] || 0, 0, n - 1);
  const nav = n > 1 ? `<div class="pager"><button class="btn tiny" data-act="page" data-key="${key}" data-d="-1" ${i ? '' : 'disabled'}>‹</button>
    <span>${i + 1} / ${n}</span><button class="btn tiny" data-act="page" data-key="${key}" data-d="1" ${i < n - 1 ? '' : 'disabled'}>›</button></div>` : '';
  return { items: list.slice(i * per, i * per + per), nav };
}

function subtabs(key, list) {
  const cur = subs[key] && list.some(x => x[0] === subs[key]) ? subs[key] : list[0][0];
  subs[key] = cur;
  return { cur, html: `<div class="subtabs">${list.map(([id, name]) => `<button class="${cur === id ? 'on' : ''}" data-act="sub" data-key="${key}" data-id="${id}">${name}</button>`).join('')}</div>` };
}

// 一屏放得下几行：按面板高度估
const rowsFit = (px, per) => Math.max(2, Math.floor((LAYOUT === 'tall' ? STAGE.h * 0.3 : STAGE.h - 430) / px) * per);

function tabDisplay() {
  const fc = forecast();
  const fn = f => `<span style="color:${FACTIONS[f].color}">${FACTIONS[f].name}</span>`;
  return `<div class="display-tab">
    <div>${gridHTML('display', '陈列柜')}
      <p class="muted small fc-note">摆上陈列柜的货，很可能招来正想要它的买家，出价也更爽快；没摆出来的，只能等客人碰巧问起。仙门禁物、魔宗禁药不该摆在明处——除非管事肯视而不见。</p></div>
    <div class="forecast paper">
      <h4>顾客群体 <span class="muted">预计 ${fc.n} 位</span></h4>
      <div class="fc-sec">陈列所吸引的买家 <b>${pct(fc.pDisp)}</b></div>
      <div class="fc-list">${fc.buyers.length ? fc.buyers.map(b => `<div class="fc-row"><span>求购 · ${CATS[b.cat]}</span><span>${pct(b.p)}</span></div>`).join('')
        : '<div class="fc-row muted">陈列柜空空，无人慕名而来</div>'}</div>
      <div class="fc-sec">普通顾客</div>
      <div class="fc-list two">${fc.generic.map(g => `<div class="fc-row"><span>${fn(g.faction)}</span><span>${pct(g.p)}</span></div>`).join('')}</div>
      ${fc.angryYao ? '<div class="fc-warn">陈列中有妖丹/妖兽皮：妖族客人会拂袖而去</div>' : ''}
      ${fc.contra ? `<div class="fc-warn">陈列违禁品 ${fc.contra} 件：仙门客人心动；管事${esc(fc.overseer.name)}看见了多半会<b>${TOLERANCE_NAME[fc.overseer.t]}</b>，和你交情差的客人也可能去举报</div>` : ''}
    </div></div>`;
}

// 工坊：设备排成卡片，点开一台才摊开它的格子，免得一长串往下翻
let openMid = 'array';

function tabWorkshop() {
  const plan = powerPlan();
  if (openMid !== 'array' && !S.machines.some(m => m.mid === openMid)) openMid = 'array';
  const status = ({ chk, powered }) => !chk.ok ? `<span class="chip warn">${esc(chk.msg)}</span>`
    : powered ? `<span class="chip ok">${esc(chk.msg)}</span>` : '<span class="chip bad">灵力不足</span>';
  const cards = [`<div class="m-card ${openMid === 'array' ? 'on' : ''}" data-act="m-open" data-mid="array"><img src="${asset('machines', 'm_array')}" alt="">
      <div><b>聚灵阵</b><span class="chip ${plan.demand > plan.supply + plan.bank ? 'bad' : 'ok'}">需 ${plan.demand} / 有 ${plan.supply + plan.bank}</span></div></div>`]
    .concat(plan.rows.map(r => `<div class="m-card ${openMid === r.m.mid ? 'on' : ''} ${r.m.on ? '' : 'off'}" data-act="m-open" data-mid="${r.m.mid}">
      <img src="${asset('machines', `${MACHINES[r.m.type].icon}~${r.chk.ok && r.powered ? 'running' : 'idle'}`)}" alt=""><div><b>${MACHINES[r.m.type].name}</b>${status(r)}</div></div>`));
  let detail;
  if (openMid === 'array') detail = `<div class="machine array">
      <div class="m-head"><img class="m-icon" src="${asset('machines', 'm_array')}" alt="">
        <div class="m-title"><b>聚灵阵</b><span class="muted">基础灵力 ${plan.supply}${S.upgrades.hijack ? '（含私接灵脉 6）' : ''} · 灵晶储备 ${plan.bank}</span></div></div>
      <div class="m-grids">${gridHTML('power', '阵眼')}</div>
      <div class="m-desc muted small">设备按卡片顺序取用灵力：先用基础灵力，不足时抽取灵晶。剩余的基础灵力会存进灵晶（每块上限 ${CRYSTAL_CAP}）。</div></div>`;
  else {
    const r = plan.rows.find(x => x.m.mid === openMid), m = r.m, def = MACHINES[m.type];
    const grids = def.stalls ? stallsHTML(m, r.chk.ok && r.powered) : def.pot ? potHTML(m, r.chk.ok && r.powered) : [
      def.in ? gridHTML(gridOf(m, 'in'), def.inLabel || '输入') : '',
      def.mod ? gridHTML(gridOf(m, 'mod'), def.modLabel || '模组', 'mod') : '',
      def.out ? gridHTML(gridOf(m, 'out'), def.outLabel || '产出', 'out') : '',
    ].join('');
    const extra = m.type === 'puppet' ? `<div class="m-extra">钱匣 ${stoneTxt(m.cash)} <button class="btn small" data-act="collect" data-mid="${m.mid}" ${m.cash ? '' : 'disabled'}>取出</button></div>`
      : def.pot ? `<div class="m-extra"><span>${m.seal ? '<b class="bad">封盅斗蛊</b>：不喂不孵，今夜最凶的一只吞掉最弱的一只' : '<b>开盅喂养</b>：幼蛊食骨长大、成蛊产卵，万毒蛊与蛊王吐毒'}</span>
          <button class="btn small" data-act="gu-seal" data-mid="${m.mid}">${m.seal ? '开盅喂养' : '封盅斗蛊'}</button></div>` : '';
    detail = `<div class="machine ${m.on ? '' : 'off'}">
      <div class="m-head"><img class="m-icon" src="${asset('machines', `${def.icon}~${r.chk.ok && r.powered ? 'running' : 'idle'}`)}" alt="">
        <div class="m-title"><b>${def.name}</b><span class="muted">${icon('ic_power')}${def.power}/夜</span> ${status(r)}</div>
        <div class="m-ctrl">
          <button class="btn tiny" data-act="m-up" data-mid="${m.mid}" title="提前运转（优先用灵力）">↑</button>
          <button class="btn tiny" data-act="m-down" data-mid="${m.mid}" title="延后运转">↓</button>
          <button class="btn tiny" data-act="m-toggle" data-mid="${m.mid}">${m.on ? '停用' : '启用'}</button>
          <button class="btn tiny ghost" data-act="m-remove" data-mid="${m.mid}" title="拆除，退回三成">拆</button></div></div>
      <div class="m-grids${def.stalls ? ' stalls' : def.pot ? ' pot' : ''}">${grids}</div>${extra}
      <div class="m-desc muted small" data-act="m-desc">${def.desc}</div></div>`;
  }
  const known = Object.entries(S.forgeKnown).filter(x => x[1]).map(([id, g]) => `${ITEMS[id].name}（${GRADE_NAMES[g]}）`);
  return `<div class="workshop">
    <div class="techs">${Object.entries(TECHS).filter(([k]) => techLv(k)).map(([k, t]) => `<span class="tech on" title="${t.desc}">
      <img src="${asset('items', t.icon)}" alt="">${t.name}<b>${cn(techLv(k))}重</b>${k === 'gumaster' && guXpNext() ? `<small class="muted">${S.guXp || 0}/${guXpNext()}</small>` : ''}</span>`).join('')}
      <span class="muted small">鉴定术：${LENS_NAMES[appraiseLevel()]}${known.length ? ` · 会仿造：${known.join('、')}` : ''}</span></div>
    <div class="m-cards">${cards.join('')}</div>
    ${S.machines.length ? detail : `${detail}<p class="muted">后院空空如也。到「货郎」处购置设备。</p>`}</div>`;
}

const STALLS_PER_PAGE = { tall: 1, wide: 2 };
// 灵兽圈：一栏一行，饲料 → 灵宠。饲料对口、今夜设备转得起来，箭头才亮着往灵宠那边流；否则暗着不动
function stallsHTML(m, running) {
  const def = MACHINES[m.type], n = stallCount(m);
  const rows = [...Array(n).keys()].map(i => {
    const st = stallState(m, i), g = stallGrids(m, i), live = st.matched && running;
    const what = st.species ? `${ITEMS[st.species].name} ×${st.pets}` : '空栏';
    const why = !st.species ? '放进一种灵宠' : !st.fit ? `缺对口饲料：${ITEMS[st.species].name}吃${petMenu(st.species).map(id => ITEMS[id].name).join('、')}`
      : !m.on ? '设备已停用' : !running ? '灵力不足，今夜不转' : `今夜吃 ${Math.min(st.fit, st.need)}/${st.need} 份`;
    return `<div class="stall ${live ? 'live' : ''}">
      <div class="stall-head"><b>兽栏${cn(i + 1)}</b><span>${what}</span><span class="${live ? 'ok' : 'muted'}">${esc(why)}</span></div>
      <div class="stall-row">${gridHTML(g.feed, '', 'feed')}
        <div class="flow-to"><div class="stall-flow ${live ? 'on' : ''}" title="${esc(why)}"><i></i><i></i><i></i></div>
        ${gridHTML(g.pen, '', 'pen')}</div></div></div>`;
  });
  const more = n < def.stallMax
    ? `<button class="btn small" data-act="buy-stall" data-mid="${m.mid}" ${S.stones >= stallPrice(m) ? '' : 'disabled'}>加盖兽栏（${stoneTxt(stallPrice(m))}）</button>`
    : '<span class="muted small">兽栏已加盖到头</span>';
  // 一屏放不下四栏：竖屏一栏一页、电脑两栏一页横着翻，翻页钮挤在“兽栏 n/4”那一行，不另占一行
  const pg = pager(rows, STALLS_PER_PAGE[LAYOUT], `stalls-${m.mid}`);
  // 列头“灵宠”对准灵宠格：饲料格宽 + 箭头宽（与 .stall-flow 一致）+ 栏的内边距
  const flowW = LAYOUT === 'tall' ? 20 : 56, padW = LAYOUT === 'tall' ? 4 : 6;
  return `<div class="stall-list"><div class="stall-cols muted small"><span style="width:${def.stallSize * CELL + flowW + padW}px">饲料</span><span>灵宠</span></div>${pg.items.join('')}
    <div class="stall-foot"><span class="muted small">兽栏 ${n}/${def.stallMax}</span>${pg.nav}${more}</div></div>
    ${gridHTML(gridOf(m, 'out'), def.outLabel || '产出', 'out')}`;
}

// 蛊盅：原料 → 蛊虫 → 产物，三栏一行；今夜转得起来，箭头才亮着流
function potHTML(m, running) {
  const def = MACHINES[m.type], flow = on => `<div class="stall-flow ${on ? 'on' : ''}" style="height:${S.grids[gridOf(m, 'pot')].h * CELL}px"><i></i><i></i><i></i></div>`;
  return `<div class="pot-row">${gridHTML(gridOf(m, 'in'), def.inLabel, 'feed')}
    <div class="flow-to">${flow(running && !m.seal)}${gridHTML(gridOf(m, 'pot'), def.potLabel, `pen${m.seal ? ' sealed' : ''}`)}</div>
    <div class="flow-to">${flow(running)}${gridHTML(gridOf(m, 'out'), def.outLabel, 'out')}</div></div>`;
}

// 功勋页的秘籍只摆你眼下读得懂的那一重，免得一排书挤满窗口
const meritShown = id => !ITEMS[id].book || ITEMS[id].book.lv === techLv(ITEMS[id].book.tech) + 1;
function tabBroker() {
  const goods = S.supply.map((e, i) => `<div class="shop-row">
      <img src="${asset('items', e.id === 'water' ? 'water_murky' : e.id)}" alt=""><b>${ITEMS[e.id].name}</b>
      <span class="muted">${CATS[ITEMS[e.id].cat]} · 余 ${e.stock}</span>${stoneTxt(e.price)}
      <button class="btn small" data-act="buy-supply" data-i="${i}" ${e.stock && S.stones >= e.price ? '' : 'disabled'}>买</button></div>`);
  const locked = SUPPLY.filter(s => S.rep.mo < s[2]).map(s => `${ITEMS[s[0]].name}（魔宗声望 ${s[2]}）`);
  const machines = Object.entries(MACHINES).map(([type, d]) => `<div class="shop-row">
      <img src="${asset('machines', d.icon)}" alt=""><b>${d.name}</b><span class="muted">${icon('ic_power')}${d.power}/夜</span>${stoneTxt(machinePrice(type))}
      <button class="btn small" data-act="buy-machine" data-type="${type}" ${S.stones >= machinePrice(type) ? '' : 'disabled'}>购置</button></div>`);
  const ups = UPGRADES.filter(u => !u.need || S.upgrades[u.need]).map(u => `<div class="shop-row">
      <b>${u.name}</b><span class="muted grow">${u.desc}</span>
      ${S.upgrades[u.id] ? '<span class="chip ok">已有</span>' : `${stoneTxt(u.price)}<button class="btn small" data-act="buy-upgrade" data-id="${u.id}" ${S.stones >= u.price ? '' : 'disabled'}>置办</button>`}</div>`);
  const sub = subtabs('broker', [['goods', '货品'], ['machines', '设备'], ['books', '秘籍'], ['intel', '消息'], ['ups', '铺面'], ['merit', '功勋']]);
  const books = BOOKS.filter(([, tech, lv, , rep]) => lv === techLv(tech) + 1 && (lv > BOOK_SHOP_MAX || S.rep.mo >= rep)).map(([id, tech, lv, price]) => {
    const head = `<div class="shop-row"><img src="${asset('items', ITEMS[id].icon)}" alt=""><b>${ITEMS[id].name}</b>
      <span class="muted">${TECHS[tech].name}第${cn(lv)}重</span>`;
    // 三四重不卖：告诉你去哪儿换、谁肯教
    if (lv > BOOK_SHOP_MAX) {
      const [f, list] = Object.entries(MERIT_SHOP).find(([, l]) => l.some(([x]) => x === id)), cost = list.find(([x]) => x === id)[1];
      const who = TEACHERS[tech].who.map(pid => CAST[pid] ? CAST[pid].name : pid).join('、');
      return `${head}<span class="muted small grow">不卖。${CHANNEL_NAME[f]} ${cost} 点功勋可换；或等机遇：与${who}亲厚，等人登门传艺，拾荒也偶尔翻得到</span></div>`;
    }
    const p = Math.round(price * (1 + diff().markup) * warStage().supply);
    return `${head}${stoneTxt(p)}
      <button class="btn small" data-act="buy-book" data-id="${id}" data-p="${p}" ${S.stones >= p ? '' : 'disabled'}>买</button></div>`;
  });
  const intel = intelShop().map((k, i) => {
    const p = Math.round(INTEL_PRICE[k] * (1 + diff().markup));
    return `<div class="shop-row"><img src="${asset('items', 'intel')}" alt=""><b>${{ market: '行情密报', treasure: '藏宝图', clique: '派系内幕' }[k]}</b>
      <span class="muted small">买了才知道写的什么</span>${stoneTxt(p)}<button class="btn small" data-act="buy-intel" data-i="${i}" ${S.stones >= p ? '' : 'disabled'}>买</button></div>`;
  });
  const merit = Object.keys(MERIT_SHOP).map(f => `<div class="merit-row">
      <b style="color:${FACTIONS[f].color}">${CHANNEL_NAME[f]}</b><span class="muted small">${FACTIONS[f].name}功勋 ${S.merit[f]}${channelOpen(f) ? '' : ` · 未搭上线（${channelHint(f)}）`}</span>
      <div class="merit-goods">${MERIT_SHOP[f].map(([id, cost], i) => meritShown(id) ? `<button class="btn tiny" data-act="redeem" data-f="${f}" data-i="${i}"
        ${channelOpen(f) && S.merit[f] >= cost ? '' : 'disabled'} title="${esc(ITEMS[id].desc)}"><img src="${asset('items', ITEMS[id].icon || id)}" alt="">${ITEMS[id].name} ${cost}</button>` : '').join('')}</div></div>`);
  const rows = { goods, machines, books, intel, ups, merit }[sub.cur];
  const pg = pager(rows, sub.cur === 'merit' ? 4 : rowsFit(40, 1), `broker-${sub.cur}`);
  return `<div class="broker">
    <div class="broker-head"><img src="${asset('chars', 'broker')}" alt=""><p>“客官要些什么？鬼市里没有买不到的东西……只有出不起的价。”<br>
      <span class="muted small">魔宗声望越高，货价越低、货色越全。选中库房物品后，可以把它折价卖给我。</span></p></div>
    ${sub.html}${pg.items.join('') || '<p class="muted small">没有。</p>'}${pg.nav}
    ${sub.cur === 'goods' && locked.length ? `<p class="muted small">尚未供货：${locked.join('、')}</p>` : ''}</div>`;
}

function tabRep() {
  const st = warStage(), t = tension(), cal = calendar(), na = nextAnnual();
  const rels = Object.entries(RELATIONS).map(([k, r]) => `<div class="rel-row" title="${r.desc}"><span>${r.name}</span>
    <span class="meter wide"><i style="width:${S.world.rel[k]}%"></i></span><b>${Math.round(S.world.rel[k])}</b></div>`).join('');
  const cats = Object.keys(CATS).map(cat => {
    const sample = Object.keys(ITEMS).filter(id => ITEMS[id].cat === cat).sort((a, b) => (ITEMS[b].war || 0) - (ITEMS[a].war || 0))[0];
    const k = priceMul(sample);
    return [cat, k, sample];
  }).sort((a, b) => b[1] - a[1]);
  const news = S.world.news.slice(-5).reverse().map(n => `<li class="${n.cls}"><span class="muted">第${n.d}日</span> ${esc(n.t)}</li>`).join('');
  const sub = subtabs('rep', [['world', '大势'], ['market', '行情与历法'], ['power', '势力'], ['rep', '声望']]);
  const body = {
    world: () => `<div class="world-head paper"><div><h4>${icon('ic_war')}天下大势 · <span class="stage st${S.world.stage}">${st.name}</span></h4>
      <p class="small">${st.text}</p>
      <div class="stage-track">${WAR_STAGES.map((w, i) => `<span class="${i <= S.world.stage ? 'on' : ''}" style="left:${w.at}%">${w.name}</span>`).join('')}
        <i style="width:${t}%"></i></div>
      <p class="small muted">四方紧张 ${t}/100 · 客人手头 ×${st.econ} · 货郎进价 ×${st.supply}${st.levy ? ` · 战时捐每周 ${levyAmount()}` : ''}</p></div>
      <div class="rels">${rels}</div></div>
      <h4>世事</h4><ul class="log">${news || '<li class="muted">尚无大事</li>'}</ul>`,
    market: () => `<div class="world-cols">
      <div><h4>历法</h4><p class="small">${cal.yearText} · ${cal.text}</p><p class="small muted">${seasonOf().text}</p>
        <p class="small muted">${weekdayOf().text}${annualOf() ? `<br><b>${annualOf().name}</b>：${annualOf().text}` : `<br>${na.d} 日后${na.a.name}`}</p></div>
      <div><h4>行情</h4><table class="quotes">${cats.map(([cat, k, sample]) => `<tr title="以${ITEMS[sample].name}为例"><td>${CATS[cat]}</td>
        <td class="${k > 1.02 ? 'good' : k < 0.98 ? 'bad' : ''}">${k > 1.02 ? '▲' : k < 0.98 ? '▼' : '—'} ×${k.toFixed(2)}</td></tr>`).join('')}</table></div></div>`,
    power: () => `<h4>势力 · ${playerPower()}</h4><div class="power-parts">${powerParts().map(([k, v]) => `<span class="${v > 0 ? 'good' : 'bad'}">${k} ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>
      <p class="small muted">吃了你亏的人，大多见风使舵：你势大，他们忍气吞声；你势弱，他们讨说法、报复。交情深的，也更肯放你一马。</p>
      <h4>${icon('ic_merit')}功勋</h4><div class="power-parts">${Object.keys(S.merit).map(f => `<span>${FACTIONS[f].name} ${S.merit[f]}</span>`).join('')}</div>
      <h4>善名 · ${VIRTUE_NAME(S.virtue)}（${S.virtue}）</h4>
      <p class="small muted">如实相告、公道买卖、接济弱者都会涨善名，可这世道不讲理：老实人开的铺子，卖货的人敢多要价，善名太盛又没修为撑腰，人人当你好欺负（势力 -${softPenalty()}）。
        只是你帮过的人记着你——极少时候，那份回报大得能救你的命。${S.flags.savior ? `<b class="good">你手里有 ${S.flags.savior} 道护身符。</b>` : ''}</p>`,
    rep: () => repSection(),
  }[sub.cur]();
  return `<div class="world-tab">${sub.html}${body}</div>`;
}

function repSection() {
  const bars = Object.entries(FACTIONS).map(([k, f]) => {
    const v = S.rep[k];
    return `<div class="rep-col">
      <img src="${asset('ui', f.icon)}" alt=""><b style="color:${f.color}">${f.name}</b>
      <div class="rep-bar"><i class="${v >= 0 ? 'pos' : 'neg'}" style="${v >= 0 ? `bottom:50%;height:${v / 2}%` : `top:50%;height:${-v / 2}%`};background:${f.color}"></i><span class="mid"></span></div>
      <span class="rep-v">${v > 0 ? '+' : ''}${v}</span><p class="small muted">${f.desc}</p></div>`;
  }).join('');
  return `<div class="rep-tab"><div class="rep-cols">${bars}</div>
    <div class="heat-box">${icon('ic_heat')}<b>执法堂关注 ${S.heat}/100</b><span class="meter wide"><i style="width:${S.heat}%"></i></span>
    <p class="small muted">与仙门交易、收售禁物、陈列禁物、私接灵脉都会招来关注；关注越高，越常被巡查，满一百即被锁拿。每夜自然消退，魔宗声望越高消退越快。</p></div></div>`;
}

function tabLedger() {
  const days = S.stats.days.slice(-4).reverse().map(d => `<tr><td>第 ${d.day} 日</td><td class="good">+${d.income}</td><td class="bad">-${d.expense}</td><td>${d.stones}</td></tr>`).join('');
  const lg = pager(S.log.slice().reverse(), rowsFit(22, 1) - 8, 'log');
  const logs = lg.items.map(l => `<li class="${l.cls}"><span class="muted">第${l.day}日</span> ${esc(l.text)}</li>`).join('');
  const canDeed = S.stones >= deedPrice() && S.phase !== 'day';
  return `<div class="ledger">
    <div class="ledger-top paper">
      <div><h4>${icon('ic_ledger')}租约</h4>
        <p>${S.grace > 0 ? `<span class="bad">欠租 ${S.rentOwed} 灵石，宽限 ${S.grace} 日</span>` : `下期 ${rentAmount()} 灵石，第 ${S.rentDue} 日到期`}</p>
        <p class="muted small">每七日一缴，每期涨近三成。</p>
        <button class="btn small" data-act="pay-rent" ${S.stones >= (S.grace ? S.rentOwed : rentAmount()) ? '' : 'disabled'}>${S.grace ? '补缴' : '提前缴纳'}</button></div>
      <div><h4>${icon('ic_deed')}铺契</h4>
        <p>${deedPrice()} 灵石 · 已有 ${Math.floor(clamp(S.stones / deedPrice() * 100, 0, 100))}%</p>
        <p class="muted small">库存不能抵现，只认灵石。</p>
        <button class="btn small primary" data-act="buy-deed" ${canDeed ? '' : 'disabled'}>买下铺契</button></div>
      <div><h4>家底</h4><p>现银 ${S.stones}</p><p class="muted">连货估 ${netWorth()}</p></div></div>
    <table class="days"><tr><th>日</th><th>进</th><th>出</th><th>余</th></tr>${days || '<tr><td colspan="4" class="muted">尚无记录</td></tr>'}</table>
    <ul class="log">${logs}</ul>${lg.nav}</div>`;
}

// ───────────── 库房 ─────────────

// 选中一件货能做的事：挪去别处（触屏上代替拖拽）与各种处置
function selActions(s, inCard = false) {
  const g = s.pos.g, out = [];
  const mv = (gid, label) => { if (S.grids[gid] && g !== gid && !rejectReason(gid, s) && findSpot(gid, s)) out.push(`<button class="btn tiny" data-act="move-to" data-g="${gid}">${label}</button>`); };
  // 饲料格能叠：同一处还有同种的，多给一个“全放进去”
  const mvAll = (gid, label) => {
    if (!stackCap(gid) || !S.grids[gid] || g === gid || rejectReason(gid, s) || !findSpot(gid, s)) return;
    const n = itemsIn(g).filter(o => o.id === s.id).length;
    if (n > 1) out.push(`<button class="btn tiny" data-act="move-all" data-g="${gid}" title="${label}：同一处的 ${n} 份一并放进去，叠在一格">全部 ×${n}</button>`);
  };
  if (tradeOpen()) mv('tray', '上货盘');
  mv('display', '摆上陈列');
  if (!['store', 'floor'].includes(g)) mv('store', '收回库房');
  if (stackOf(s).length > 1) out.push(`<button class="btn tiny" data-act="unpile" title="这一格叠着的 ${stackOf(s).length} 份都收回库房，各占一格，品相照旧">整摞收回 ×${stackOf(s).length}</button>`);
  if (g === 'hand') mv('floor', '放在地上');
  mv('hidden', '藏进暗格');
  // 灵晶：嵌进聚灵阵眼；阵眼满了，就和里面最空的一块对调（手机上阵眼在工坊页，拖不过去）
  if (s.id === 'spirit_crystal' && g !== 'power') {
    const low = weakestCrystal();
    if (findSpot('power', s)) mv('power', '嵌入阵眼');
    else if (low && (low.charge || 0) < (s.charge || 0)) out.push(`<button class="btn tiny" data-act="power-swap">换下阵眼里最空的一块（充能 ${low.charge || 0}）</button>`);
  }
  S.machines.filter(m => MACHINES[m.type].in).slice(0, 12).forEach(m => { if (out.length < 7) { mv(gridOf(m, 'in'), `放进${MACHINES[m.type].name}`); mvAll(gridOf(m, 'in'), `放进${MACHINES[m.type].name}`); } });
  // 蛊、蛊卵放进蛊盅的蛊虫格
  S.machines.filter(m => MACHINES[m.type].pot).forEach(m => mv(gridOf(m, 'pot'), `放进${MACHINES[m.type].name}养`));
  // 灵兽圈：灵宠放进同种或空的栏；饲料只喂吃它的那几栏
  S.machines.filter(m => MACHINES[m.type].stalls).forEach(m => [...Array(stallCount(m)).keys()].forEach(i => {
    if (out.length >= 7) return;
    const sp = stallSpecies(m, i), g = stallGrids(m, i);
    if (isPet(s)) mv(g.pen, `放进兽栏${cn(i + 1)}`);
    else if (sp && petMenu(sp).includes(s.id)) { mv(g.feed, `喂兽栏${cn(i + 1)}（${ITEMS[sp].name}）`); mvAll(g.feed, `喂兽栏${cn(i + 1)}`); }
  }));
  S.machines.filter(m => MACHINES[m.type].mod && modAccepts(s, m.type)).forEach(m => mv(gridOf(m, 'mod'), `装进${MACHINES[m.type].name}`));
  if (ITEMS[s.id].appraise) out.push(`<button class="btn tiny" data-act="appraise-own">${icon('ic_appraise')}鉴定</button>`);
  if (canLace(s) && additives().length) out.push(`<button class="btn tiny" data-act="lace">${icon('ic_lace')}加料</button>`);
  if (ITEMS[s.id].book) out.push('<button class="btn tiny" data-act="read-book">研读</button>');
  const seem = seemOf(s);
  if (restoreOf(seem) || cureBy(seem)) out.push(`<button class="btn tiny" data-act="consume">服用${cureBy(seem) ? `（治${CONDS[cureBy(seem)].name}）` : ''}</button>`);
  if (cultXp(seem)) out.push(`<button class="btn tiny" data-act="cultivate" data-uid="${s.uid}">服炼 +${cultXp(seem)}</button>`);
  if (canBottle(s)) out.push('<button class="btn tiny" data-act="bottle">装瓶</button>');
  if (s.mark && markVisible(s)) out.push(`<button class="btn tiny" data-act="erase" ${canErase(s) ? '' : `disabled title="须抹印术${cn(s.mark.str)}重"`}>抹印（${costText('erase', s.mark.str)}）</button>`);
  if (canSeal(s)) out.push('<button class="btn tiny" data-act="seal">贴封印</button>');
  if ((dressable(s) || isLaceable(s.id)) && !s.forged && s.lacedBy !== 'me' && !s.lacedSeen) out.push('<button class="btn tiny" data-act="inspect-own">验货</button>');
  if (knownFlaw(s) && !s.forged && (s.fake ? COUNTERFEITS[s.id] : isDressed(s))) out.push('<button class="btn tiny" data-act="study">拆解研究</button>');
  // 验出了别人掺的料：吃下这个亏、贱卖给货郎、当好货转手骗人（谈价时照常卖）、或者拆开学他的手法
  if (s.laced && s.lacedSeen && s.lacedBy !== 'me' && !laceSkill(s.laced)) out.push(`<button class="btn tiny" data-act="study">尝出手法（学会${LACE[s.laced].name}的掺法）</button>`);
  out.push(`<button class="btn tiny" data-act="sell-broker">卖给货郎 ${brokerPrice(s)}</button>`);
  if (inCard) out.push('<button class="btn tiny ghost" data-act="trash-sel">丢弃</button>');
  return out.join('');
}

const selectable = s => s && s.pos && !['counter', 'basket'].includes(s.pos.g);
const weakestCrystal = () => itemsIn('power').reduce((m, it) => !m || (it.charge || 0) < (m.charge || 0) ? it : m, null);

function renderStorage() {
  const s = sel && S.items[sel];
  const canSell = selectable(s) && LAYOUT === 'wide';
  $('#storage').innerHTML = `
    <div class="st-head"><b>库房</b>
      ${canSell ? `<span class="st-sel">选中 <b>${esc(itemName(s))}</b>${selActions(s)}</span>`
        : `<span class="muted small">${LAYOUT === 'tall' ? '点货看详情与操作，按住拖动挪位置' : '拖动整理；点选查看与出售'}</span>`}
      <button class="btn tiny" data-act="tidy" title="大件先摆，尽量把地上的货收进库房">整理</button>
      <span class="st-tool" title="鉴宝台：放照妖镜，决定你的鉴定术">${gridHTML('tool', '', 'mod')}<small>${LENS_NAMES[appraiseLevel()]}</small></span>
      <span class="trash" data-drop="trash" title="拖到这里丢弃">弃</span></div>
    ${handItems().length ? `<div class="st-hand">${gridHTML('hand', '手上：铺里放不下了。拖进空处，或点开服用、摆出、放进设备、卖掉、丢弃腾地方；收拾好才能接着做事')}</div>` : ''}
    <div class="st-body ${storeFit.cls || 'beside-row'}">${gridHTML('store', '')}
      <div class="st-side">${gridHTML('floor', '地上（夜里遭贼）')}${S.grids.hidden ? gridHTML('hidden', '夹层暗格', 'stash') : ''}</div></div>`;
  fitStorage();
}

// 地上与暗格摆在哪：库房旁边横排、旁边竖排、库房下面横排，挑横向不撑出、又最矮的那种。
// 排法只随屏幕和格子尺寸变，记下来，同样的尺寸不再量
const storeFit = { key: null, cls: null };
function fitStorage() {
  const st = $('#storage'), body = st && st.querySelector('.st-body');
  const key = [LAYOUT, CELL, ...['store', 'floor', 'hidden'].map(g => S.grids[g] ? `${S.grids[g].w}x${S.grids[g].h}` : '-')].join(' ');
  if (!body || !st.clientWidth || storeFit.key === key) return;
  let best = null;
  for (const cls of ['beside-row', 'beside-col', 'below-row']) {
    body.className = `st-body ${cls}`;
    const over = st.scrollWidth > st.clientWidth + 1, h = st.scrollHeight;
    if (!best || (!over && (best.over || h < best.h))) best = { cls, over, h };
  }
  body.className = `st-body ${best.cls}`;
  Object.assign(storeFit, { key, cls: best.cls });
}

// 触屏点一件货：立刻弹出详情卡，能做的事也在卡上；点别处收起并取消选中
let peek = null;       // 详情卡上的货 uid
let touchy = false;    // 最近一次按下是不是手指

function renderCard() {
  const it = peek && S.items[peek], el = $('#itemcard');
  if (!it || (selectable(it) && sel !== it.uid)) { peek = null; el.innerHTML = ''; return; }
  const take = it.pos && it.pos.g === 'counter' && tradeCustomer() && S.customer.item === it.uid
    ? `<button class="btn tiny" data-act="take-toggle">${(S.customer.take || []).includes(it.uid) ? '不收' : '收下'}</button>` : '';
  el.innerHTML = `${itemTip(it)}<div class="ic-acts">${selectable(it) ? selActions(it, true) : take}</div>`;
}

// ───────────── 竖屏窗口：当前分页靠左、柜台靠右，宽窄高矮随内容，放不下就左右互相压住 ─────────────

let front = 'main';    // 叠放时压在上面的窗口：counter（柜台）/ main（库房或当前分页）
const DOCK_PEEK = 56;  // 被压住的窗口至少露出这么宽，好点到它

function layoutDock() {
  const cw = $('#counter-panel'), mw = tab === 'store' ? $('#storage') : $('#side');
  const wins = [cw, $('#side'), $('#storage')];
  if (LAYOUT !== 'tall') {
    wins.forEach(w => { w.style.maxHeight = w.style.maxWidth = ''; w.classList.remove('front'); });
    $('#dock').style.height = $('#dock').style.marginLeft = '';
    return;
  }
  const g = $('#game'), dock = $('#dock'), solo = !cw.childElementCount, nav = $('#nav');
  g.style.setProperty('--top-h', `${$('#topbar').offsetHeight}px`);
  const sh = $('#scene').clientHeight, cap = Math.round(sh * 0.5), free = sh - nav.offsetTop - nav.offsetHeight - 6;
  const fit = left => {
    dock.style.marginLeft = `${left}px`;
    const room = dock.clientWidth - 8 - (solo ? 0 : DOCK_PEEK);
    [cw, mw].forEach(w => { w.style.maxHeight = `${cap}px`; w.style.maxWidth = `${room}px`; });
    return Math.max(mw.offsetHeight, solo ? 0 : cw.offsetHeight);
  };
  let h = fit(0);
  if (h > free) h = fit(nav.offsetWidth);
  dock.style.height = `${h}px`;
  g.style.setProperty('--dock-h', `${h}px`);
  cw.classList.toggle('front', front === 'counter');
  mw.classList.toggle('front', front !== 'counter' || solo);
}

function raise(win) {
  if (front === win) return;
  front = win;
  layoutDock();
}

// 点到被压住的窗口：翻到上面来；顺带记下是手指还是鼠标
document.addEventListener('pointerdown', e => {
  touchy = e.pointerType !== 'mouse';
  const w = LAYOUT === 'tall' && e.target.closest && e.target.closest('#dock .win');
  if (w) raise(w.dataset.win);
}, true);

let handSeen = 0;       // 上回重绘时手上有几件货

function renderAll() {
  if (!S) return;
  layoutHand();
  const held = handItems().length;
  if (held > handSeen) { toast('铺里放不下了，多出的货先拿在手上', 'bad'); tab = 'store'; front = 'main'; }
  handSeen = held;
  renderTopbar(); renderScene(); renderCounter(); renderSide(); renderStorage(); renderCard();
  if (modal) modal();
  // 暗中举报的人出了门：赏金送到
  if (NOTICES.length) { const n = NOTICES.splice(0); toast(n.map(x => x.text.split('\n').join('<br>')).join('<br>'), n.some(x => x.cls === 'bad') ? 'bad' : 'good'); }
}

// ───────────── 弹窗 ─────────────

function openModal(fn) { modal = fn; fn(); }
function closeModal() { modal = null; $('#modal-layer').innerHTML = ''; $('#modal-layer').className = ''; }
function modalHTML(html, cls = '') { $('#modal-layer').className = 'on'; $('#modal-layer').innerHTML = `<div class="modal paper ${cls}">${html}</div>`; }

// 拂袖的机会小的时候差一点都要紧：一成以下精确到千分
const leavePct = p => p > 0 && p < 0.1 ? `${(Math.floor(p * 1000) / 10).toFixed(1)}%` : pct(p);

function oddsBar(o) {
  return `<div class="odds"><i class="a" style="width:${o.accept * 100}%"></i><i class="c" style="width:${o.counter * 100}%"></i><i class="l" style="width:${o.leave * 100}%"></i></div>
    <div class="odds-txt"><span class="good">成交 ${pct(o.accept)}</span><span>还价 ${pct(o.counter)}</span><span class="bad">拂袖 ${leavePct(o.leave)}</span></div>`;
}

// 货盘上每件货在这笔买卖里算什么
const ROLE_TXT = { cure: '急需', want: '正中下怀', side: '顺带', extra: '多余' };
const ROLE_CLS = { cure: 'good', want: 'good', side: 'muted', extra: 'bad' };

// 谈价：货盘上的货卖给他、柜台上点中的货收下来，谈一个总价
function openDeal() {
  const c = S.customer;
  const h = { counter: null, result: null };
  let d = dealOf(c);
  const range = () => dealRange(c, d);
  // 滑杆先停在“小赚”：他几乎不会翻脸的最高价
  const safe = () => dealPresets(c, d, range())[2][1];
  h.net = safe();
  const TA = ta(personOf(c));
  const netTxt = n => n >= 0 ? `${TA}付你 <b>${n}</b>` : `你付${TA} <b>${-n}</b>`;
  const giveRow = g => {
    const it = g.it, canLie = knownFlaw(it) && !c.wantFake;
    return `<div class="d-row">${itemHTML(Object.assign({}, it, { pos: null }), 'preview mini')}<span>${esc(itemName(it))}
      <small class="${ROLE_CLS[g.role]}">${ROLE_TXT[g.role]}</small></span><span class="muted">${g.role === 'extra' ? '压价收' : '心理价'} ${Math.round(g.v)}</span>
      ${canLie ? `<span class="d-claim"><label class="${claimOf(c, it) !== 'honest' ? 'on' : ''}" data-act="d-claim" data-uid="${it.uid}" data-v="genuine">当真货</label><label class="${claimOf(c, it) === 'honest' ? 'on' : ''}" data-act="d-claim" data-uid="${it.uid}" data-v="honest">告知实情</label></span>` : ''}</div>`;
  };
  let gp, tp;
  const render = () => {
    const [lo, hi] = range();
    let body;
    if (h.result) body = `<div class="h-result ${h.result.cls}">${c.portrait ? `<img class="h-face" src="${asset('chars', portraitOf(c))}" alt="">` : ''}<span>${h.result.text}</span></div><div class="h-btns"><button class="btn primary" data-act="haggle-close">好</button></div>`;
    else if (h.counter != null) body = `<div class="h-result">“${voice(c.faction, h.counter >= 0 ? 'counterSell' : 'counterBuy', { n: Math.abs(h.counter) })}”<br><small>（${netTxt(h.counter)}）</small></div>
        <div class="h-btns"><button class="btn primary" data-act="h-accept">接受</button>
        <button class="btn" data-act="h-again" ${c.patience > 0 ? '' : 'disabled'}>再议</button>
        <button class="btn ghost" data-act="h-quit">作罢</button></div>`;
    else body = `<div class="h-presets">${dealPresets(c, d, [lo, hi]).map(([n, v]) => `<button class="btn small" data-act="h-preset" data-v="${v}">${n} ${v}</button>`).join('')}</div>
        <div class="h-slider"><input type="range" id="h-range" min="${lo}" max="${hi}" value="${clamp(h.net, lo, hi)}"><b id="h-price">${netTxt(h.net)}</b></div>
        <div id="h-odds">${oddsBar(dealOdds(c, d, h.net))}</div>
        <div class="h-btns"><span class="muted small">每回报价 ${costText('haggle', dealEffort(d))}</span><button class="btn primary" data-act="h-offer">报价</button><button class="btn ghost" data-act="haggle-close">再想想</button></div>`;
    modalHTML(`<h3>谈价 · ${esc(c.name)} <span class="muted small">${FACTIONS[c.faction].name} ${patienceHTML(c)}</span></h3>
      <div class="deal"><div class="d-col"><h4>卖给${TA}</h4>${(gp = pager(d.give, 4, 'deal-give')).items.map(giveRow).join('') || '<p class="muted small">货盘上没有他要的。</p>'}${gp.nav}
          ${d.reject.length ? `<p class="muted small">${TA}不要：${d.reject.map(itemName).join('、')}</p>` : ''}</div>
        <div class="d-col"><h4>收下${TA}的</h4>${(tp = pager(d.take, 4, 'deal-take')).items.map(t => `<div class="d-row">${itemHTML(Object.assign({}, t.it, { pos: null }), 'preview mini')}<span>${esc(itemName(t.it))}</span>
          <span class="muted">开价 ${t.a} · 你估 ${Math.round(knownValue(t.it) * priceMul(t.it.id))}</span></div>`).join('') || '<p class="muted small">不收他的货。</p>'}${tp.nav}</div></div>
      ${c.wantCat ? `<div class="tip-row"><span>${TA}要 ${needText(c)}</span><span>${trayTally(c, d)}</span></div>` : ''}
      ${compliant(c) ? `<div class="tip-row laced-txt"><span>${TA}由你摆布</span><span>开什么价都认，只是掏不出钱袋里没有的</span></div>` : ''}
      <div class="tip-row"><span>${TA}心里的公道差价</span><span>${netTxt(d.N0)}</span></div>
      ${d.give.length ? `<div class="tip-row"><span>对方预算</span><span>约 ${Math.round(c.budget * 0.85 / 10) * 10}–${Math.round(c.budget * 1.15 / 10) * 10}${d.N0 > c.budget * PURSE_OFFER ? '<span class="bad">，掏不出公道价</span>' : ''}</span></div>` : ''}
      <hr>${body}`, 'm-deal');
    const r = $('#h-range');
    if (r) r.oninput = () => { h.net = +r.value; $('#h-price').innerHTML = netTxt(h.net); $('#h-odds').innerHTML = oddsBar(dealOdds(c, d, h.net)); };
  };
  const ready = net => {
    if (net < 0 && S.stones < -net) { toast('灵石不够', 'bad'); return false; }
    return true;
  };
  const finish = net => {
    const out = settleDeal(c, d, net);
    h.result = out.caught === 'stolen' ? { cls: 'bad', text: '对方认出了货里有同门失窃之物，当场收走，余下的买卖也不做了！' }
      : out.caught === 'laced' ? { cls: 'bad', text: `“你在这里头动了手脚！”${esc(c.name)}把东西摔回柜上，扬长而去。这事不会就这么算了。` }
        : { cls: 'good', text: `成交！${out.sold.length ? `卖出${out.sold.join('、')}，进账 ${out.income}` : ''}${out.sold.length && out.bought.length ? '；' : ''}${out.bought.length ? `收下${out.bought.join('、')}，付出 ${out.paid}` : ''}。` };
    if (sel && !S.items[sel]) sel = null;
    // 被你狠宰了一刀还是买了：心里不痛快
    const k = (net - d.N0) / d.scale;
    feel(c, out.caught ? 'angry' : compliant(c) ? null : k > 0.2 ? 'angry' : k > 0.12 ? null : 'pleased');
    dismissCustomer(false);
  };
  const respond = () => {
    if (!ready(h.net)) return;
    // 由你摆布的人看出货不对也不敢声张
    const caught = !compliant(c) && dealInspect(c, d);
    if (caught) {
      h.result = { cls: 'bad', text: `“拿${esc(itemName(caught))}糊弄我？”对方一眼看穿，拂袖而去。` };
      feel(c, 'angry');
      dismissCustomer(false);
      return;
    }
    const out = roll(dealOdds(c, d, h.net));
    if (out === 'accept') finish(h.net);
    else if (out === 'counter') { if (!compliant(c)) c.patience--; h.counter = dealCounter(c, d, h.net); }
    else { h.result = { cls: 'bad', text: `“${voice(c.faction, 'leave')}”对方转身走了。` }; feel(c, 'angry'); dismissCustomer(true); }
  };
  modal = render;
  render();
  HANDLERS['d-claim'] = el => { S.items[el.dataset.uid].claim = el.dataset.v; d = dealOf(c); h.net = safe(); render(); };
  HANDLERS['h-preset'] = el => { h.net = +el.dataset.v; render(); };
  HANDLERS['h-offer'] = () => tiredOr('haggle', () => { respond(); render(); renderAll(); }, dealEffort(d));
  HANDLERS['h-accept'] = () => { if (!ready(h.counter)) return; finish(h.counter); h.counter = null; render(); renderAll(); };
  HANDLERS['h-again'] = () => { h.net = h.counter; h.counter = null; render(); };
  HANDLERS['h-quit'] = () => { h.counter = null; h.result = { cls: 'bad', text: '谈崩了，对方悻悻离去。' }; feel(c, 'angry'); dismissCustomer(true); render(); renderAll(); };
}

// 来客此刻的神情：换上表情（null 为不变）；随后被送走的，带着这副神情在柜台前留一会儿
function feel(c, mood) { if (c) { if (mood) c.mood = mood; parting = { c }; renderScene(); } }

// 鉴定：mode 'commission' 委托、'counter' 看顾客的货、'own' 看自己的货。
// 台上只摆这一件；照妖镜像一盏紫外灯，作伪的痕迹在镜里发出荧光
function openAppraise(mode, uid) {
  const it = S.items[uid], kind = ITEMS[it.id].appraise, spec = APPRAISE[kind];
  const lv = appraiseLevel(), zoom = 1.6 + 0.4 * lv;
  const seen = visibleFeats(it, lv);
  const c = S.customer;
  // 照妖镜：手指（鼠标）按在镜柄上，镜片在指尖上方，不被手指挡住；松手镜子留在原处。
  // 拖动时镜子随手平移；松手后镜柄摆向台心一侧（镜片在台左时柄朝右下，在台右时朝左下），下回按住也够得着台边
  const V = LAYOUT === 'tall' ? Math.min(STAGE.w - 56, 440) : 380, g = Math.round(V * 0.2);
  const TILT = 28 * Math.PI / 180, tiltAt = lx => TILT * (2 * clamp(lx / V, 0, 1) - 1);
  let pos = [V * 0.45, V * 0.4], grip = 2.4 * g, tilt = tiltAt(pos[0]);
  const loupe = `<div class="lens" id="ap-lens" style="--g:${g}px">
      <div class="lens-in${lv ? ' uv' : ''}"><div id="lens-content" style="width:${V * zoom}px;height:${V * zoom}px">${appraiseImg(kind, seen, it.flip, lv > 0)}</div></div>
      <div class="lens-arm" id="lens-arm">
        <img src="assets/appraise/loupe.webp" alt="" draggable="false" style="left:${-LOUPE.cx * g}px;top:${-LOUPE.cy * g}px;width:${LOUPE.w * g}px">
        <div class="lens-grip" style="top:${1.25 * g}px;height:${(LOUPE.end - 1.25) * g}px"></div></div></div>`;
  const buttons = () => {
    if (mode === 'own') return `<button class="btn" data-act="ap-real">判为真品</button><button class="btn danger" data-act="ap-fake">判为赝品</button>
      <button class="btn ghost" data-act="modal-close">放下</button>`;
    if (mode === 'story') return `<button class="btn" data-act="ap-mark-real">心中有数：真品</button><button class="btn danger" data-act="ap-mark-fake">心中有数：赝品</button>
      <button class="btn ghost" data-act="story-reopen">放下</button>`;
    if (mode === 'commission') return `<button class="btn" data-act="ap-real">告诉${ta(personOf(c))}：真品</button><button class="btn danger" data-act="ap-fake">告诉${ta(personOf(c))}：赝品</button>
      <button class="btn ghost" data-act="modal-close">再想想</button>`;
    return `${it.told ? '' : `<button class="btn danger" data-act="ap-dispute">指为赝品，压价</button>`}
      <button class="btn ghost" data-act="modal-close">不动声色</button>`;
  };
  const render = () => {
    modalHTML(`<h3>${icon('ic_appraise')}照妖镜 · ${spec.name}</h3>
      <div class="appraise">
        <div class="ap-stage" id="ap-stage" style="width:${V}px;height:${V}px">
          <div class="ap-view">${appraiseImg(kind, [], it.flip)}</div>${loupe}</div>
        <div class="viewer">
          <p class="ap-tip">${lv ? '按住镜柄挪动照妖镜，把整件东西照一遍。镜下一片幽紫，作伪的地方会<b class="uv-txt">泛出荧光</b>；真品通体一色，没有一处发亮。'
            : '鉴宝台上没有照妖镜，手里只是一面放大镜：看得清纹路，照不出作伪。'}</p>
          <p class="muted small">你的鉴定术：<b>${LENS_NAMES[lv]}</b>（第${cn(lv) || '零'}重）——做工高过它的作伪不会发光。</p>
          ${mode === 'own' || mode === 'story' ? '' : talkHTML(c)}
          <div class="h-btns">${buttons()}</div></div></div>`, 'm-appraise');
    const stage = $('#ap-stage'), lens = $('#ap-lens'), arm = $('#lens-arm'), content = $('#lens-content');
    const place = () => {
      lens.style.left = `${pos[0]}px`; lens.style.top = `${pos[1]}px`;
      arm.style.transform = `rotate(${tilt}rad)`;
      content.style.transform = `translate(${1.02 * g - pos[0] * zoom}px, ${1.02 * g - pos[1] * zoom}px)`;
    };
    // 指下是镜柄上离镜心 grip 远的一点：由指尖反推镜心
    const at = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; };
    const follow = e => {
      const [x, y] = at(e);
      pos = [clamp(x + grip * Math.sin(tilt), 0, V), clamp(y - grip * Math.cos(tilt), 0, V)];
      place();
    };
    // 按在镜柄上：从按住的那一点起拖；按在台面上：镜子挪过来，让镜柄落在指下
    let drag = null;
    stage.onpointerdown = e => {
      const [x, y] = at(e);
      grip = e.target.closest('.lens-grip') ? clamp(Math.hypot(x - pos[0], y - pos[1]), 1.5 * g, LOUPE.end * g) : 2.4 * g;
      drag = e.pointerId;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 合成的事件没有真指针 */ }
      follow(e); e.preventDefault();
    };
    stage.onpointermove = e => { if (drag === e.pointerId || (drag == null && e.pointerType === 'mouse')) follow(e); };
    stage.onpointerup = stage.onpointercancel = e => { if (drag === e.pointerId) { drag = null; tilt = tiltAt(pos[0]); place(); } };
    place();
  };
  const verdict = fake => {
    if (mode === 'own') { it.verdict = fake ? 'fake' : 'real'; closeModal(); renderAll(); return; }
    const fee = c.fee, res = finishAppraisal(c, fake);
    modal = null;
    if (res.caught) {
      modalHTML(`<h3>被识破了</h3><p>${esc(c.name)}冷笑一声：“糊弄谁呢？”甩袖而去，酬金分文未给。
        <span class="bad">${FACTIONS[c.faction].name}声望 -6</span></p>
        <div class="h-btns"><button class="btn primary" data-act="ap-done">送客</button></div>`);
    } else {
      const offer = !res.ask ? '' : fake ? `<p>“既是赝品，留着也是占地方。<b>${res.ask}</b> 灵石，掌柜的收了吧？”</p>`
        : `<p>“原来是真品……掌柜的若有意，<b>${res.ask}</b> 灵石出让给你。”</p>`;
      modalHTML(`<h3>鉴定已毕</h3><p>你告诉${esc(c.name)}：此物是<b>${fake ? '赝品' : '真品'}</b>。对方信了，付了 ${fee} 灵石酬金。</p>${offer}
        <div class="h-btns">${res.ask ? `<button class="btn primary" data-act="ap-buyback">回收（议价）</button>` : ''}
        <button class="btn ${res.ask ? 'ghost' : 'primary'}" data-act="ap-done">${res.ask ? '不收，送客' : '送客'}</button></div>`);
    }
    renderAll();
  };
  modal = render;
  render();
  HANDLERS['ap-real'] = () => verdict(false);
  HANDLERS['ap-fake'] = () => verdict(true);
  HANDLERS['ap-mark-real'] = () => { it.verdict = 'real'; HANDLERS['story-reopen'](); };
  HANDLERS['ap-mark-fake'] = () => { it.verdict = 'fake'; HANDLERS['story-reopen'](); };
  HANDLERS['ap-dispute'] = () => {
    const { caught } = disputeAsFake(c);
    feel(c, caught ? 'angry' : 'afraid');
    closeModal();
    if (caught && c.patience <= 0) { dismissCustomer(false); toast(`${c.name}识破了你的伎俩，拂袖而去`, 'bad'); }
    else if (caught) toast(`被识破了！${FACTIONS[c.faction].name}声望 -6，对方反而加价`, 'bad');
    else toast(`对方信了，开价降到 ${customerItem().ask} 灵石`, 'good');
    renderAll();
  };
}

// 说出鉴定结论前的察言观色
function talkHTML(c) {
  return `<div class="ap-talk"><span>${esc(c.name)} · 神色<b>${demeanor(c)}</b></span>
    <span>若所言与真相不符，当场被识破约 <b class="bad">${pct(lieDetectChance(c))}</b></span></div>`;
}

function showReport(rep) {
  openModal(() => modalHTML(`<h3>${icon('ic_night')}夜间报告 · 第 ${S.day - 1} 夜</h3>
    <div class="report">${rep.map(r => `<div class="rp-row ${r.cls || ''}">
      <img src="${asset(r.icon.startsWith('m_') ? 'machines' : 'ui', r.icon)}" alt=""><b>${r.title}</b><span>${esc(r.text)}</span></div>`).join('')}</div>
    <div class="h-btns"><button class="btn primary" data-act="report-ok">迎接第 ${S.day} 日</button></div>`, 'm-report'));
}

function showLandlord() {
  const owed = S.grace > 0, sun = S.flags.landlord === 'sun';
  const qianMood = mood(S.people.qian ? S.people.qian.aff : 0);
  const line = sun
    ? owed ? `“欠租 <b>${S.rentOwed}</b> 灵石。宗门规矩，宽限两日。两日后交不上，按规矩收铺。”她在账册上记了一笔，“我不会多收你一文，也不会少收一文。”`
      : `“租子收讫。下期 <b>${rentAmount()}</b> 灵石，第 ${S.rentDue} 日。”她头也不抬，“账目清楚，就不必多说。”`
    : owed ? `“哟，交不起？宗门规矩，宽限两日，连本带罚 <b>${S.rentOwed}</b> 灵石。两日后再拿不出来……嘿嘿，这铺子可就换人了。”`
      : qianMood === 'close' || qianMood === 'warm' ? `“自己人，租子收到了。下回 <b>${rentAmount()}</b> 灵石，第 ${S.rentDue} 日来取。”他笑眯眯地拍拍你，“有好事，记得想着老钱。”`
        : qianMood === 'hostile' || qianMood === 'cold' ? `“租子收到了。”他皮笑肉不笑，“下回 <b>${rentAmount()}</b> 灵石，第 ${S.rentDue} 日。年轻人，杂役区的铺面，可不是谁都租得起的。”`
          : `“租子收到了。下回是 <b>${rentAmount()}</b> 灵石，第 ${S.rentDue} 日来取。杂役区的铺面，可是一年比一年金贵喽。”`;
  openModal(() => modalHTML(`<div class="npc-talk"><img src="${asset('chars', landlordPerson().portrait)}" alt="">
    <div><h3>${landlordName()}</h3><p>${line}</p>
    <p class="muted small">想买断铺契？${deedPrice()} 灵石，一个子儿不能少。</p>
    <div class="h-btns"><button class="btn primary" data-act="modal-close">知道了</button></div></div></div>`, 'm-npc'));
}

// ───────────── 故事对话 ─────────────

let storyDone = null;   // 对话结束后的去处（白天送客 / 夜里继续入定）

function openStory(key, onDone) {
  const st = S.story[key], node = storyNode(st), p = storyPerson(st);
  const c = S.customer && S.customer.key === key ? S.customer : storyVisitor(key);
  storyDone = onDone;
  const f = FACTIONS[c.faction];
  const chs = node.choices(st, p);
  const it = customerItem();
  // 泛泛之辈的故事模板里，“他”指的就是这个人，随性别改；有名有姓的故事各自写好了
  const G = GENERIC_STORY.has(st.tpl) && p ? t => gx(p, t) : t => t;
  openModal(() => modalHTML(`<div class="story">
    <div class="st-portrait"><img src="${asset('chars', portraitOf(c))}" alt=""></div>
    <div class="st-body">
      <h3>${icon(f.icon)}${esc(c.name)}<span class="muted">${esc(c.title || '')}</span>${p && !node.who ? personTags({ pid: p.pid }) : ''}</h3>
      <div class="st-text">${G(node.text(st, p)).split('\n').map(t => `<p>${esc(t)}</p>`).join('')}</div>
      ${it ? `<div class="st-item">${itemHTML(Object.assign({}, it, { pos: null }), 'preview')}<span class="muted">${esc(itemName(it))}</span>
        ${ITEMS[it.id].appraise ? `<button class="btn small" data-act="story-appraise">${icon('ic_appraise')}照妖镜细看</button>` : ''}</div>` : ''}
      <div class="st-choices">${chs.map((ch, i) => {
        const why = choiceState(ch, st, p);
        return `<button class="btn st-choice" data-act="story-choose" data-i="${i}" ${why ? `disabled title="${esc(why)}"` : ''}>
          <span>${esc(G(ch.label))}</span>${ch.hint || why || ch.sin ? `<small>${esc(G(why || [ch.hint, ch.sin && sinHint(ch.sin)].filter(Boolean).join('；')))}</small>` : ''}</button>`;
      }).join('')}</div></div></div>`, 'm-story'));
  HANDLERS['story-choose'] = el => {
    const pv = personOf(c) || p;
    const before = { stones: S.stones, heat: S.heat, rep: Object.assign({}, S.rep), aff: pv ? pv.aff : null };
    const res = resolveChoice(key, +el.dataset.i);
    if (res.mood) c.mood = res.mood;
    if (S.customer === c) feel(c, null);
    modal = null;
    modalHTML(`<div class="story">
      <div class="st-portrait"><img src="${asset('chars', storyResultPortrait(key, c))}" alt=""></div>
      <div class="st-body"><h3>${icon(f.icon)}${esc(c.name)}</h3>
        <div class="st-text">${G(res.text || '').split('\n').map(t => `<p>${esc(t)}</p>`).join('')}</div>
        <div class="st-delta">${deltaHTML(before, pv)}</div>
        <div class="h-btns"><button class="btn primary" data-act="story-done">继续</button></div></div></div>`, 'm-story');
    renderTopbar();
  };
  HANDLERS['story-appraise'] = () => openAppraise('story', it.uid);
  HANDLERS['story-reopen'] = () => openStory(key, onDone);
}

const GENERIC_STORY = new Set(['grudge', 'scandal', 'tracker', 'legacy']);

// 结果里可能换了样貌（如老乞丐恢复修为）
function storyResultPortrait(key, c) {
  const p = storyPerson(S.story[key]);
  return `${p && c.pid === p.pid ? p.portrait : c.portrait}~${moodOf(c, personOf(c))}`;
}

// 一次抉择带来的变化
function deltaHTML(before, p) {
  const out = [];
  const d = S.stones - before.stones;
  if (d) out.push(`<span class="${d > 0 ? 'good' : 'bad'}">灵石 ${d > 0 ? '+' : ''}${d}</span>`);
  if (S.heat !== before.heat) out.push(`<span class="${S.heat > before.heat ? 'bad' : 'good'}">执法堂关注 ${S.heat > before.heat ? '+' : ''}${S.heat - before.heat}</span>`);
  for (const k in FACTIONS) {
    const r = S.rep[k] - before.rep[k];
    if (r) out.push(`<span class="${r > 0 ? 'good' : 'bad'}">${FACTIONS[k].name}声望 ${r > 0 ? '+' : ''}${r}</span>`);
  }
  if (p && before.aff != null && p.aff !== before.aff) out.push(`<span class="${p.aff > before.aff ? 'good' : 'bad'}">${esc(p.name)}好感 ${p.aff > before.aff ? '+' : ''}${p.aff - before.aff}</span>`);
  return out.join('');
}

// ───────────── 人物 ─────────────

const STATUS_NAME = { alive: '在世', gone: '离去', dead: '亡故', jailed: '入狱' };

function knownPeople() {
  return Object.values(S.people).filter(p => p.visits || p.mem.length || p.life.length)
    .sort((a, b) => (!!b.story - !!a.story) || (b.lastDay - a.lastDay) || (b.visits - a.visits));
}

function tabPeople() {
  const list = knownPeople();
  if (!list.length) return '<p class="muted">还没有结识任何人。开门迎客吧。</p>';
  const pg = pager(list, LAYOUT === 'tall' ? 4 : 6, 'people');
  return `<div class="people">${pg.items.map(p => {
    const m = mood(p.aff), f = FACTIONS[p.faction];
    const st = p.story && S.story[p.story];
    const last = [...p.mem, ...p.life].sort((a, b) => b.d - a.d)[0];
    return `<div class="pcard ${p.status}" data-act="person" data-pid="${p.pid}">
      <div class="pc-face"><img src="${asset('chars', personFace(p))}" alt=""></div>
      <div class="pc-info"><div><b>${esc(p.name)}</b> <span class="muted small">${esc(p.title || '')}</span>
        ${p.story && !p.official ? '<span class="tag gold">有故事</span>' : ''}${p.official ? '<span class="tag">官差</span>' : ''}${p.status !== 'alive' ? `<span class="tag fake">${STATUS_NAME[p.status]}</span>` : ''}
        ${p.status === 'alive' && p.addict ? '<span class="tag fake">成瘾</span>' : ''}${p.status === 'alive' && guBound(p) ? '<span class="tag laced">中蛊</span>' : ''}${p.status === 'alive' && p.soulBound ? '<span class="tag laced">受控</span>' : ''}${p.status === 'alive' && p.loveGu ? '<span class="tag love">情蛊</span>' : ''}${p.status === 'alive' && p.wish ? `<span class="tag real">求${ITEMS[p.wish].name}</span>` : ''}
        ${p.status === 'alive' ? condList(p).filter(c => CONDS[c.kind]).map(c => `<span class="tag fake">${c.label}</span>`).join('') : ''}${isHealer(p) && p.status === 'alive' ? '<span class="tag real">懂医术</span>' : ''}</div>
        <div class="pc-aff"><span style="color:${f.color}">${f.name}</span><span class="aff-bar"><i class="${p.aff >= 0 ? 'pos' : 'neg'}" style="width:${Math.abs(p.aff) / 2}%"></i></span>
          <span class="mood-${m}">${MOOD_NAME[m]}</span></div>
        <div class="muted small pc-last">${st && st.summary ? esc(st.summary) : last ? `第${last.d}日 · ${esc(last.t)}` : esc(p.bio)}</div></div></div>`;
  }).join('')}</div>${pg.nav}`;
}

function openPerson(pid) {
  const p = S.people[pid], m = mood(p.aff), f = FACTIONS[p.faction];
  const st = p.story && S.story[p.story];
  const rows = [...p.mem.map(e => ({ ...e, type: 'mem' })), ...p.life.map(e => ({ ...e, type: 'life' }))].sort((a, b) => a.d - b.d);
  openModal(() => { const pg = pager(rows.slice().reverse(), LAYOUT === 'tall' ? 4 : 6, `mem-${pid}`); modalHTML(`<div class="story">
    <div class="st-portrait"><img src="${asset('chars', personFace(p))}" alt=""></div>
    <div class="st-body"><h3>${icon(f.icon)}${esc(p.name)}<span class="muted">${esc(p.title || '')} · ${STATUS_NAME[p.status]}</span></h3>
      <p class="muted">${esc(p.bio)}</p>
      <p>好感 <b class="mood-${m}">${p.aff}（${MOOD_NAME[m]}）</b> · 来过 ${p.visits} 回 · 神色${demeanor(p)}</p>
      <p class="p-traits">${personTraits(p)}</p>
      ${st && st.summary ? `<p class="st-sum">${esc(st.summary)}</p>` : ''}
      ${p.status === 'alive' ? personActions(p) : ''}
      ${p.status === 'alive' && p.visits > 0 ? loreHTML(p) : ''}
      <ul class="timeline">${rows.length ? pg.items.map(r => `<li class="${r.type}"><span class="muted">第${r.d}日</span>${esc(r.t)}
        ${r.a ? `<span class="${r.a > 0 ? 'good' : 'bad'}">${r.a > 0 ? '+' : ''}${r.a}</span>` : ''}</li>`).join('') : '<li class="muted">尚无往来</li>'}</ul>${pg.nav}
      <div class="h-btns"><button class="btn primary" data-act="modal-close">合上</button></div></div></div>`, 'm-story'); });
}

// 打听门道：他像是懂哪些行当的门道、肯不肯说、要价多少
function loreHTML(p) {
  const tips = loreKnown(p).filter(t => !loreLearned(t.id));
  if (!tips.length) return loreKnown(p).length ? '<p class="small muted">他懂的门道你都知道了。</p>' : '';
  const asked = p.loreDay === S.day;
  return `<div class="p-lore"><b>打听门道</b>${asked ? '<span class="muted small">（今天已打听过）</span>' : `<span class="muted small">（${costText('talk')}；一天一回）</span>`}
    ${tips.map(t => { const o = loreOffer(p, t);
      const tag = `${t.topic}<em class="muted">·${LORE_TIER[t.tier]}${t.evil ? '·偏门' : ''}</em>`;
      if (o.kind === 'refuse') return `<div class="lore-row"><span>${tag}</span><span class="muted small">${esc(o.why)}</span></div>`;
      return `<div class="lore-row"><span>${tag}</span><button class="btn tiny${o.kind === 'sell' ? ' danger' : ''}" data-act="ask-lore" data-pid="${p.pid}" data-id="${t.id}" ${asked ? 'disabled' : ''}>${o.kind === 'sell' ? `出 ${o.price} 灵石请教` : '请教'}</button></div>`;
    }).join('')}</div>`
    .replace(/他/g, ta(p));
}

// 见闻录：打听来的门道
function openLoreBook() {
  const got = Object.entries(S.lore || {}).sort((a, b) => a[1].day - b[1].day);
  modalHTML(`<h3>${icon('ic_ledger')}见闻录</h3>
    <p class="muted small">从杂役区各色人等嘴里打听来的门道。懂哪行的人、交情多深、肯不肯说，都在「人物」页里看。</p>
    <ul class="timeline">${got.length ? got.map(([id, x]) => { const t = loreTip(id); return t ? `<li><span class="muted">第${x.day}日 · ${esc(x.from)}</span><b>${t.topic}</b>${esc(t.text)}</li>` : ''; }).join('') : '<li class="muted">还没打听到什么。</li>'}</ul>
    <div class="h-btns"><button class="btn primary" data-act="modal-close">合上</button></div>`, 'm-gift');
}

function personTraits(p) {
  const t = [];
  for (const c of condList(p)) t.push(`<b class="bad" title="比斗 -${c.combat}">${c.label}</b>`);
  t.push(`<span title="体魄">体魄 ${Math.max(0, Math.round(p.health))}</span>`);
  t.push(`<span>手头${p.budgetMul >= 1.3 ? '宽裕' : p.budgetMul < 0.6 ? '拮据' : '寻常'}</span>`);
  t.push(`<span>贪念${p.greed > 0.65 ? '重' : p.greed < 0.35 ? '淡' : '中'}</span>`);
  t.push(`<span title="你的势力 ${playerPower()}">势力 ${npcPower(p)}</span>`, `<span title="你是${realmName()}">境界·${realmName(npcLevel(p))}</span>`, `<span>眼力${['全无', '粗浅', '寻常', '老道', '毒辣'][p.eye || 0]}</span>`);
  if (p.noble) t.push('<span class="laced-txt">权贵 · 好面子</span>');
  if (isWeak(p)) t.push('<span class="muted">弱者</span>');
  if (p.informant) t.push('<span class="good">你的耳目</span>');
  if (p.owed >= 2) t.push('<span class="good">欠你人情</span>');
  if (p.soulBound) t.push('<span class="laced-txt">受控：识海里种着你的魂印，难违你意</span>');
  if (p.wantsFakes) t.push('<span class="laced-txt">爱收假货转手</span>');
  if (p.official || p.integrity > 0.5) t.push(`<span>守规矩${p.integrity > 0.7 ? '极严' : p.integrity > 0.4 ? '尚严' : '松'}</span>`);
  if (p.wish) t.push(`<span class="good">所求：${ITEMS[p.wish].name}</span>`);
  if (isHealer(p)) t.push(`<span class="good">懂医术：治${CAST[p.pid].healer.heals.map(k => CONDS[k].name).join('、')}</span>`);
  if (p.desperate) t.push('<span class="bad">走投无路</span>');
  if (p.addict) t.push(`<span class="bad">成瘾 ${p.addict}</span>`);
  if (guBound(p)) t.push(`<span class="laced-txt">中蛊：吃下了你的${GU_STAGES[p.controlled.stage || 0].name}，不从就蛊噬其心</span>`);
  if (p.loveGu) t.push(`<span class="love-txt">中了你的情蛊：${ta(p)}死你也活不成</span>`);
  return t.join('');
}

function personActions(p) {
  const out = [];
  if (canGift(p)) out.push(`<button class="btn small" data-act="gift-open" data-pid="${p.pid}">${icon('ic_gift')}送礼</button>`,
    ...[50, 150, 400].map(n => `<button class="btn small" data-act="gift-stones" data-pid="${p.pid}" data-n="${n}" ${S.stones < n ? 'disabled' : ''}>送 ${n} 灵石</button>`));
  else if (p.giftedDay === S.day) out.push('<span class="muted small">今日已送过礼</span>');
  if (p.secret && p.secret.known && !p.secret.filed) out.push(`<button class="btn small" data-act="file-secret" data-pid="${p.pid}">${icon('ic_secret')}录成密报</button>`);
  if (isHealer(p) && p.status === 'alive') out.push(healButton(p));
  if (p.status === 'alive') out.push(...treatButtons(p));
  if (guBound(p)) out.push(`<button class="btn small ghost" data-act="uncontrol" data-pid="${p.pid}">解蛊</button>`);
  if (p.indentured) out.push(`<span class="small bad">在你后院做苦力</span><button class="btn small" data-act="release" data-pid="${p.pid}">放${ta(p)}走</button>`);
  if (S.phase === 'night' && killable(p) && p.pid !== 'beggar') {
    const why = canKill(p);
    out.push(`<button class="btn small danger" data-act="ambush" data-pid="${p.pid}" ${why || S.scavenged ? `disabled title="${esc(why || '今夜已出过门')}"` : ''}>夜里截杀${why ? '' : `（成算 ${pct(killOdds(p, true))}）`}</button>`);
  }
  const l = loanOf(p);
  const debt = l && l.defaulted ? `<div class="p-lever"><b class="bad">欠你 ${l.owe} 灵石还不上</b>
      <button class="btn tiny danger" data-act="debt" data-pid="${p.pid}" data-how="mine">卖去矿上</button>
      <button class="btn tiny danger" data-act="debt" data-pid="${p.pid}" data-how="labor">收作苦力</button>
      <button class="btn tiny" data-act="debt" data-pid="${p.pid}" data-how="extend">宽限七日（利滚利）</button>
      <button class="btn tiny" data-act="debt" data-pid="${p.pid}" data-how="forgive">一笔勾销</button></div>`
    : l ? `<p class="small muted">欠你 ${l.owe} 灵石，第 ${l.due} 日到期。</p>` : '';
  const levers = leversOf(p).map(k => {
    const L = LEVERS[k];
    return `<div class="p-lever"><span class="laced-txt">凭${L.name}</span><span class="muted small">成算 ${pct(L.odds(p))} · ${esc(gx(p, L.note(p)))}</span>
      ${commandList(p, k).map(c => `<button class="btn tiny danger" data-act="command" data-pid="${p.pid}" data-id="${c.id}" data-lever="${k}" ${c.ready ? '' : `disabled title="${c.why}"`}>${esc(c.label)}${c.ready ? '' : `（${c.why}）`}</button>`).join('')}</div>`;
  }).join('');
  return (out.length ? `<div class="p-actions">${out.join('')}</div>` : '') + debt + levers;
}

// 求诊：懂医术的人总有这颗按钮，用不了就把缘由写在旁边（手机上没有悬停提示）
function healButton(p) {
  const why = healBlock(p), can = healable(p).length, fee = can ? healFee(p) : null;
  return `<button class="btn small" data-act="seek-heal" data-pid="${p.pid}" ${why ? 'disabled' : ''}>${icon('ic_stamina')}求诊${!can ? '' : fee == null ? '（不肯治）' : `（${fee} 灵石）`}</button>${why ? `<span class="muted small">${esc(why)}</span>` : ''}`;
}

// 替他治伤毒：就是把对症的药送给他（与送礼同一回事，一天只送一回）；手里没有就说缺什么。
// 掺进来的尸毒不在此列，药治不了
function treatButtons(p) {
  const kinds = Object.keys(CONDS).filter(k => condSev(p, k));
  if (!kinds.length) return [];
  const TA = ta(p), med = Object.values(S.items).find(it => HELD(it) && cureBy(it, p) && !knownFlaw(it) && it.lacedBy !== 'me');
  if (!med) return [`<span class="small muted">${TA}${kinds.map(k => CONDS[k].name).join('、')}在身，送${[...new Set(kinds.flatMap(k => CONDS[k].cure))].map(id => ITEMS[id].name).join('、')}能治</span>`];
  const why = canGift(p) ? '' : '今日已送过东西';
  return [`<button class="btn small" data-act="treat" data-pid="${p.pid}" data-uid="${med.uid}" ${why ? 'disabled' : ''}>${icon('ic_stamina')}用${esc(itemName(med))}替${TA}治${CONDS[cureBy(med, p)].name}</button>${why ? `<span class="muted small">${why}</span>` : ''}`];
}

// 因果：未了的孽债、下一桩恶事的赌注、恶名带来的损失
function openFate() {
  const F = S.fate;
  modalHTML(`<h3>${icon('ic_heat')}因果</h3>
    <p>每做一桩恶事就欠下一笔孽债，几日后见分晓：五成风平浪静，五成报应上门。报应要赔的本金随你作的恶越滚越大，赔不起就被人打上门、抄走货、招来执法堂。
      行善能冲淡旧孽，隔一阵子不作恶，孽也会慢慢淡去。</p>
    <p>你一共作过 <b>${F.total}</b> 桩恶事：<span class="good">${F.buried} 桩没人追究</span>，<span class="bad">${F.erupted} 桩遭了报应${F.busts ? `（${F.busts} 回赔不起）` : ''}</span>。</p>
    <p>眼下再作一桩小恶，若败露约赔 <b>${fateStake(1)}</b> 灵石；出卖、销赃约 <b>${fateStake(2)}</b>；害人性命约 <b>${fateStake(3)}</b>。</p>
    ${F.infamy ? `<p class="bad">恶名 ${F.infamy}：${[fateCustomerLoss() ? `每日少来 ${fateCustomerLoss()} 位客人` : '', `客人压价 ${Math.round(infamyDiscount() * 100)}%`,
      fateTrusted() ? '' : '没人再来托付、求助', fateClean() ? '' : '好报难来'].filter(Boolean).join('；')}。</p>` : ''}
    <h4>未了的孽债</h4>
    <ul class="timeline">${F.debts.length ? F.debts.map(d => `<li><span class="muted">第${d.day}日</span>${esc(d.what || SINS[d.kind].name)}<span class="bad">若败露赔 ${d.stake}</span>
      <span class="muted">${d.due <= S.day + 1 ? '就在这一两日' : `约 ${d.due - S.day} 日内`}</span></li>`).join('') : '<li class="muted">没有未了的孽债</li>'}</ul>
    <div class="h-btns"><button class="btn primary" data-act="modal-close">合上</button></div>`, 'm-gift');
}

// 求医：点顶栏的伤毒打开。手上的药、结识的医者；一个医者也不认得，就只能靠药
function openHeal() {
  if (!Object.keys(S.conds).length) { closeModal(); return; }
  const meds = cureItems(), docs = healers().filter(p => healable(p).length);
  const cureNames = Object.entries(CONDS).filter(([k]) => condSev('me', k))
    .map(([k, C]) => `${C.name}：${C.cure.map(id => ITEMS[id].name).join('、')}`).join('；');
  modalHTML(`<h3>${icon('ic_stamina')}求医</h3>
    <p class="bad">${condText('me')}</p>
    <h4>手上的药</h4>
    <div class="gift-list">${meds.length ? meds.map(it => `<div class="gift-row">
      ${itemHTML(Object.assign({}, it, { pos: null }), 'preview mini')}<span>${esc(itemName(it))}</span>
      <span class="good">治${CONDS[cureBy(it)].name}</span><button class="btn small" data-act="heal-use" data-uid="${it.uid}">服下</button></div>`).join('')
      : `<p class="muted small">手上没有对症的药（${cureNames}）。</p>`}</div>
    <h4>结识的医者</h4>
    <div class="gift-list">${docs.length ? docs.map(p => `<div class="gift-row">
      <img class="heal-face" src="${asset('chars', personFace(p))}" alt=""><span>${esc(p.name)}<em class="muted small"> ${esc(p.title)} · ${MOOD_NAME[mood(p.aff)]}</em>
      <br><small>能治你的${healable(p).map(k => CONDS[k].name).join('、')}</small></span>${healButton(p)}</div>`).join('')
      : `<p class="muted small">${healers().length ? '结识的医者治不了你身上的毛病。' : '你还没结识懂医术的人，只能靠手上的药。轻伤、微毒静养几天也会好；毒发以上不治只会更重。'}</p>`}</div>
    <div class="h-btns"><button class="btn primary" data-act="modal-close">合上</button></div>`, 'm-gift m-heal');
}

function openGift(pid) {
  const p = S.people[pid];
  const items = Object.values(S.items).filter(it => HELD(it)).sort((a, b) => giftValue(p, b) - giftValue(p, a));
  openModal(() => { const pg = pager(items.filter(it => S.items[it.uid]), 6, `gift-${pid}`); modalHTML(`<h3>${icon('ic_gift')}送礼 · ${esc(p.name)}</h3>
    <p class="muted small">${ta(p)}看重的是对${ta(p)}的用处：${p.wish ? `最想要<b>${ITEMS[p.wish].name}</b>；` : ''}${p.addict ? '离不开忘忧散；' : ''}也看他手头是否宽裕、贪念轻重。掺了料的东西，送出去就由不得你了。</p>
    <div class="gift-list">${items.length ? pg.items.map(it => `<div class="gift-row" data-act="gift-give" data-pid="${pid}" data-uid="${it.uid}">
      ${itemHTML(Object.assign({}, it, { pos: null }), 'preview mini')}<span>${esc(itemName(it))}${lacedKnown(it) ? `<em class="laced-txt">（${LACE[it.laced].verb}）</em>` : ''}</span>
      <span class="good">好感约 +${giftAff(p, giftValue(p, it)) + (p.wish === it.id ? 10 : 0)}</span>
      ${lacedKnown(it) && LACE[it.laced].detect ? `<span class="bad small">识破 ${Math.round(laceDetectChance(p, it) * 100)}%</span>` : ''}</div>`).join('') : '<p class="muted">手头没有可送的东西。</p>'}</div>${pg.nav}
    <div class="h-btns"><button class="btn ghost" data-act="person" data-pid="${pid}">返回</button></div>`, 'm-gift'); });
}

function openLace() {
  const it = S.items[sel];
  openModal(() => modalHTML(`<h3>${icon('ic_lace')}加料 · ${esc(itemName(it))}</h3>
    <p class="muted small">加了料的货外表看不出分别，照常估价、照常出售或送人。料要吃下去才发作：买下或收下的人揣回去，自己吃了，或转送给别人——谁吃下去，谁受其害；收货时够精明的会当场识破。</p>
    <div class="lace-list">${additives().map(a => {
      const L = LACE[ITEMS[a.id].additive], why = laceBlock(it, a);
      return `<div class="lace-row"><div class="lace-ic">${itemHTML(Object.assign({}, a, { pos: null }), 'preview mini')}</div>
        <div><b>${esc(itemName(a))}</b> → ${L.verb}<p class="small">${L.desc}</p>
        <p class="small muted">${L.detect ? `被识破的基础几率 ${Math.round(L.detect * 100)}%，对方越精明、越不信你越容易识破${a.id === 'gu' ? '；蛊越毒越隐蔽' : ''}。` : '无害，不必担心被识破。'}</p>
        ${why ? `<p class="small bad">${esc(why)}</p>` : ''}</div>
        <button class="btn small ${L.detect ? 'danger' : ''}" data-act="lace-do" data-uid="${a.uid}" ${why ? 'disabled' : ''}>${L.verb.replace('了', '')}</button></div>`;
    }).join('')}</div>
    <div class="h-btns"><button class="btn ghost" data-act="modal-close">作罢</button></div>`, 'm-lace'));
}

// 精力不够就做不了
function tiredOr(key, fn, mult = 1) {
  const err = exert(key, mult);
  if (err) { toast(err, 'bad'); return; }
  renderTopbar();
  fn();
}

function showIntel(r) {
  openModal(() => modalHTML(`<h3>${icon('ic_secret')}天机</h3><div class="h-result ${r.cls || ''}">${r.text.split('\n').join('<br>')}</div>
    <div class="h-btns"><button class="btn primary" data-act="modal-close">好</button></div>`));
}

function openMarket(key) {
  const d = DEALERS[key];
  if (d.need && !d.need()) key = 'ghost';
  const dd = DEALERS[key], st = dealerStock(key);
  const tabs = Object.entries(DEALERS).map(([k, x]) => `<button class="tab ${k === key ? 'on' : ''}" data-act="mk-tab" data-k="${k}" ${x.need && !x.need() ? 'disabled title="要魔宗声望 15 或魔宗功勋 5"' : ''}>${x.name}</button>`).join('');
  const offers = st.offers.map((o, i) => {
    const unit = dealerBuyPrice(key, o.id), mk = Math.round(rawValue({ id: o.id, q: 60 }) * priceMul(o.id));
    return `<div class="shop-row" title="市价约 ${mk}/件"><img src="${asset('items', ITEMS[o.id].icon || (o.id === 'water' ? 'water_murky' : o.id))}" alt=""><b>${ITEMS[o.id].name}</b>
      <span class="muted small">${o.lot}件×${o.lots}批 · 市价${mk}</span>${stoneTxt(unit)}
      <button class="btn small" data-act="mk-buy" data-k="${key}" data-i="${i}" ${o.lots > 0 && S.stones >= unit * o.lot ? '' : 'disabled'}>进一批 ${unit * o.lot}</button></div>`;
  }).join('');
  const goods = sellable(key);
  const wants = st.wants.filter(w => w.left > 0).map(w => ITEMS[w.id].name + `（${w.left}）`).join('、');
  const sells = goods.map(it => `<div class="shop-row">${itemHTML(Object.assign({}, it, { pos: null }), 'preview mini')}<b>${esc(itemName(it))}</b>
      <span class="muted small">${it.stolen > 0 ? '赃物 · ' : ''}${isFlawed(it) && knownFlaw(it) ? '有问题 · ' : ''}</span>${stoneTxt(dealerSellPrice(key, it))}
      <button class="btn small" data-act="mk-sell" data-k="${key}" data-uid="${it.uid}">出手</button></div>`).join('');
  openModal(() => modalHTML(`<div class="market">
    <div class="mk-head"><img src="${asset('scene', 'ghost_market')}" alt=""><div class="mk-who"><img src="${asset('chars', dd.portrait)}" alt="">
      <div><h3>${dd.name}</h3><p class="small">${dd.desc}</p>
      <p class="small muted">${isGhostNight() ? '今夜鬼市开张，货多。' : ''}${st.mod < 1 ? '你今夜谈下了好价。' : st.mod > 1 ? '对方提防着你，价贵了一成。' : ''}</p>
      <button class="btn small" data-act="mk-talk" data-k="${key}" ${st.talked ? 'disabled' : ''}>话术博弈（${costText('talk')}）</button></div></div></div>
    <nav class="mk-tabs">${tabs}</nav>
    <div class="mk-cols"><div><h4>进货</h4>${offers}</div>
      <div><h4>出货</h4><p class="muted small">收：${wants || '今夜不收了'}</p>${sells || '<p class="muted small">你手里没有他要的货。</p>'}</div></div>
    <div class="h-btns"><button class="btn primary" data-act="mk-leave">回铺</button></div></div>`, 'm-market'));
}

function showInspectResult(res) {
  const e = official('enforcer');
  openModal(() => modalHTML(`<div class="npc-talk"><img src="${asset('chars', e.portrait)}" alt="">
    <div><h3>${esc(e.name)} · 执法堂巡查</h3>${res.ignored ? '<p>他在陈列柜前站了站，目光从你的货上扫过去，像什么也没看见。“……行，干干净净。”</p>'
      : res.bribed ? '<p>“……今日这铺子，干干净净。”</p>'
      : res.found.length ? `<p>“搜出${res.found.map(esc).join('、')}！充公，罚 ${res.fine} 灵石。下回再犯，提头来见。”</p>`
        : '<p>“哼，算你识相。”巡查翻检一番，一无所获地走了。</p>'}
    <div class="h-btns"><button class="btn primary" data-act="inspect-done">送走巡查</button></div></div></div>`, 'm-npc'));
}

function openScavengeSelect() {
  openModal(() => modalHTML(`<h3>${icon('ic_scavenge')}外出拾荒</h3><div class="locs">
    ${allLocations().map(l => `<div class="loc" data-act="scav-go" data-id="${l.id}"><img src="${asset('scene', l.bg)}" alt="">
      <b>${l.name}</b><p class="small">${l.desc}</p><p class="muted small">可翻找 ${l.tries} 次 · 初始遇险 ${pct(l.danger)}${l.hazard.cond ? ` · 遇险可能${CONDS[l.hazard.cond[0]].name}<b class="bad">${deathWarn(l.hazard.cond[0])}</b>` : ''}</p></div>`).join('')}</div>
    ${condText('me') ? `<p class="bad small">${condText('me')}带着伤毒去翻，更耗力、更容易出事。</p>` : ''}
    <div class="h-btns"><button class="btn ghost" data-act="modal-close">还是算了</button></div>`, 'm-locs'));
}

function renderScavenge() {
  const sc = S.scav, loc = allLocations().find(l => l.id === sc.loc), o = scavOdds();
  const pend = pendingScavItem();
  modalHTML(`<h3>${icon('ic_scavenge')}${loc.name}</h3>
    <div class="scav"><div class="scav-bg"><img src="${asset('scene', loc.bg)}" alt="">
      <div class="scav-stats"><span>剩余 ${sc.tries} 次</span><span class="good">发现 ${pct(loc.find)}</span><span class="bad">遇险 ${pct(o.danger)}</span></div></div>
      <div class="scav-side">
        ${gridHTML('basket', '背篓')}
        ${pend && !pend.pos ? `<div class="grid-label">手上（拖进背篓，或丢弃）</div><div class="hand">${itemHTML(pend)}</div>` : ''}
        <ul class="log">${sc.lines.slice(-6).reverse().map(l => `<li class="${l.cls || ''}">${esc(l.text)}</li>`).join('')}</ul>
        <div class="h-btns">
          <button class="btn primary" data-act="scav-search" ${sc.tries > 0 && !sc.ended && !(pend && !pend.pos) ? '' : 'disabled'}>翻找</button>
          <button class="btn" data-act="scav-home">回铺</button>
          <span class="trash" data-drop="trash">弃</span></div></div></div>`, 'm-scav');
}

function showEnding() {
  const st = S.stats, d = diff(), start = STARTS.find(s => s.id === S.start);
  clearSave();
  openModal(() => modalHTML(`<div class="ending ${S.over.win ? 'win' : 'lose'}${S.over.scene ? ' has-scene' : ''}">
    ${S.over.scene ? `<img class="end-scene" src="${asset('scene', S.over.scene)}" alt="" onerror="this.remove()">` : ''}
    <img class="seal" src="${asset('ui', S.over.win ? 'ic_deed' : 'seal')}" alt="">
    <h2>${S.over.title}</h2><p>${S.over.text}</p>
    <div class="stats">
      <div><span>开局</span><b>${start.name} · ${d.name}</b></div>
      <div><span>坚持</span><b>${S.day} 日</b></div>
      <div><span>总进账</span><b>${st.income}</b></div>
      <div><span>成交笔数</span><b>${st.sales}</b></div>
      <div><span>家底估值</span><b>${netWorth()}</b></div>
      <div><span>鉴定委托</span><b>${st.appraisals}</b></div>
      <div><span>遭遇巡查</span><b>${st.inspections}</b></div>
      <div><span>境界 · 善名</span><b>${realmName()} · ${VIRTUE_NAME(S.virtue)}</b></div>
      <div><span>手上人命</span><b>${st.kills || 0}</b></div>
      <div><span>靠山</span><b>${S.cliques.joined ? CLIQUES[S.cliques.joined].name : '—'}</b></div>
      <div><span>最大一笔</span><b>${st.bestSale ? `${st.bestSale.name} ${st.bestSale.price}（第${st.bestSale.day}日）` : '—'}</b></div>
      <div><span>最妙一转手</span><b>${st.bestFlip ? `${st.bestFlip.name}：${st.bestFlip.cost}→${st.bestFlip.price}` : '—'}</b></div>
    </div>
    ${profileHTML()}
    <div class="h-btns"><button class="btn primary" data-act="to-title">回到山门</button></div></div>`, 'm-ending'));
}

// ───────────── 结局画像 ─────────────

let PF = null;   // 收场时算好的画像，图上点选时取用

function profileHTML() {
  const sc = traitScores(), arc = archetype(sc), pts = wealthSeries();
  PF = { sc, pts };
  const top = sc.indexOf(arc.top);
  return `<div class="pf-sec">
    <h4>掌柜画像</h4>
    <div class="pf">
      <div class="pf-chart">${radarSVG(sc, top)}<div class="pf-read" id="pf-read">${traitRead(sc[top])}</div></div>
      <div class="pf-text">
        <b class="pf-name">${arc.name}</b>${arc.also ? `<span class="muted small">　兼有几分${arc.also.name}</span>` : ''}
        <p>${arc.text}</p>
        <ul class="pf-list">${sc.map((t, i) => `<li data-pf="${i}" class="${i === top ? 'on' : ''}"><span>${t.name}</span><b>${t.v}</b><small>${esc(t.basis)}</small></li>`).join('')}</ul>
      </div></div>
    <div class="pf">
      ${pts.length > 1 ? `<div class="pf-wealth"><h4>家底走势</h4>${wealthSVG(pts)}<div class="pf-read" id="wl-read">${wealthRead(pts)}</div>
        <details class="wl-table"><summary>逐日明细</summary><table><tr><th>日</th><th>进</th><th>出</th><th>余</th></tr>
          ${S.stats.days.map(d => `<tr><td>第 ${d.day} 日</td><td>+${d.income}</td><td>-${d.expense}</td><td>${d.stones}</td></tr>`).join('')}</table></details></div>` : ''}
      <div class="pf-text"><h4>下一局</h4>
        <ul class="pf-tips">${nextTips(sc).map(t => `<li><b>${t.head}</b>${esc(t.text)}</li>`).join('')}</ul></div></div></div>`;
}

const traitRead = t => `<b>${t.name} ${t.v}</b> · ${esc(t.basis)}`;

// 蛛网图：七样脾性一圈，四道等分环；点顶点或名字看依据
function radarSVG(sc, on) {
  const R = 84, n = sc.length;
  const at = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [+(Math.cos(a) * r).toFixed(1), +(Math.sin(a) * r).toFixed(1)]; };
  const ring = f => sc.map((_, i) => at(i, R * f).join(',')).join(' ');
  const pts = sc.map((t, i) => at(i, R * t.v / 100));
  return `<svg class="radar" viewBox="-132 -112 264 226" role="img" aria-label="${sc.map(t => `${t.name}${t.v}`).join('，')}">
    ${[0.25, 0.5, 0.75, 1].map(f => `<polygon class="rd-grid" points="${ring(f)}"/>`).join('')}
    ${sc.map((_, i) => { const [x, y] = at(i, R); return `<line class="rd-grid" x1="0" y1="0" x2="${x}" y2="${y}"/>`; }).join('')}
    <polygon class="rd-area" points="${pts.map(p => p.join(',')).join(' ')}"/>
    ${sc.map((t, i) => {
      const [x, y] = at(i, R + 17), anchor = x > 4 ? 'start' : x < -4 ? 'end' : 'middle';
      return `<text class="rd-label" data-pf="${i}" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${t.name}</text>`;
    }).join('')}
    ${pts.map(([x, y], i) => `<circle class="rd-dot" cx="${x}" cy="${y}" r="4"/><circle class="rd-hit ${i === on ? 'on' : ''}" data-pf="${i}" cx="${x}" cy="${y}" r="13"/>`).join('')}
  </svg>`;
}

// 家底走势：每夜的灵石，标出最高与收场；按住或悬停看某一日
const WL = { w: 320, h: 132, l: 40, r: 66, t: 16, b: 20 };

function wealthScale(pts) {
  const hi = Math.max(1, ...pts.map(p => p.v)), lo = Math.min(0, ...pts.map(p => p.v));
  const mag = 10 ** Math.floor(Math.log10(hi / 2)), step = [1, 2, 5, 10].map(m => m * mag).find(s => s * 2 >= hi);
  const top = step * 2, d0 = pts[0].day, d1 = pts[pts.length - 1].day;
  return {
    ticks: [0, step, top],
    x: day => WL.l + (day - d0) / Math.max(1, d1 - d0) * (WL.w - WL.l - WL.r),
    y: v => WL.t + (1 - (v - lo) / (top - lo)) * (WL.h - WL.t - WL.b),
  };
}

function wealthSVG(pts) {
  const s = wealthScale(pts), last = pts[pts.length - 1];
  const hi = pts.reduce((m, p) => p.v > m.v ? p : m, pts[0]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${s.x(p.day).toFixed(1)},${s.y(p.v).toFixed(1)}`).join('');
  const base = s.y(0).toFixed(1);
  return `<svg class="wealth" viewBox="0 0 ${WL.w} ${WL.h}" role="img" aria-label="家底走势：最高 ${hi.v} 灵石（第 ${hi.day} 日），收场 ${last.v} 灵石">
    ${s.ticks.map(v => `<line class="rd-grid" x1="${WL.l}" x2="${WL.w - WL.r}" y1="${s.y(v)}" y2="${s.y(v)}"/><text class="wl-tick" x="${WL.l - 6}" y="${s.y(v)}" text-anchor="end" dominant-baseline="middle">${v}</text>`).join('')}
    <text class="wl-tick" x="${WL.l}" y="${WL.h - 4}">第 ${pts[0].day} 日</text>
    <text class="wl-tick" x="${WL.w - WL.r}" y="${WL.h - 4}" text-anchor="end">第 ${last.day} 日</text>
    <path class="wl-area" d="${line}L${s.x(last.day).toFixed(1)},${base}L${s.x(pts[0].day).toFixed(1)},${base}Z"/>
    <path class="wl-line" d="${line}"/>
    ${hi !== last ? `<text class="wl-note" x="${s.x(hi.day)}" y="${s.y(hi.v) - 7}" text-anchor="middle">最高 ${hi.v}</text>` : ''}
    <circle class="rd-dot" cx="${s.x(last.day)}" cy="${s.y(last.v)}" r="4"/>
    <text class="wl-note" x="${s.x(last.day) + 8}" y="${s.y(last.v)}" dominant-baseline="middle">收场 ${last.v}</text>
    <line class="wl-cross" id="wl-cross" y1="${WL.t}" y2="${WL.h - WL.b}"/><circle class="rd-dot wl-cross" id="wl-dot" r="4"/>
    <rect class="wl-hit" x="${WL.l}" y="0" width="${WL.w - WL.l - WL.r}" height="${WL.h}"/>
  </svg>`;
}

function wealthRead(pts, p) {
  if (p) return `<b>第 ${p.day} 日</b> · 灵石 ${p.v}`;
  const hi = pts.reduce((m, q) => q.v > m.v ? q : m, pts[0]);
  return `最高 <b>${hi.v}</b>（第 ${hi.day} 日）· 收场 <b>${pts[pts.length - 1].v}</b>`;
}

// 点选蛛网图的顶点、名字或下面那一行：亮起这一样，读出依据
function pfPick(e) {
  const el = PF && e.target.closest && e.target.closest('.pf [data-pf]');
  if (!el) return;
  const i = +el.dataset.pf;
  document.querySelectorAll('.pf [data-pf].on').forEach(x => x.classList.remove('on'));
  document.querySelectorAll(`.pf li[data-pf="${i}"], .pf .rd-hit[data-pf="${i}"]`).forEach(x => x.classList.add('on'));
  $('#pf-read').innerHTML = traitRead(PF.sc[i]);
}

// 家底走势上按住或悬停：十字线落到最近的那一日；移开就收起
function wlTrack(e) {
  const cross = $('#wl-cross');
  if (!PF || !cross) return;
  const hit = e.target.closest && e.target.closest('.wealth'), dot = $('#wl-dot');
  if (!hit) { cross.classList.remove('on'); dot.classList.remove('on'); $('#wl-read').innerHTML = wealthRead(PF.pts); return; }
  const r = hit.getBoundingClientRect(), s = wealthScale(PF.pts), x = (e.clientX - r.left) / r.width * WL.w;
  const p = PF.pts.reduce((m, q) => Math.abs(s.x(q.day) - x) < Math.abs(s.x(m.day) - x) ? q : m, PF.pts[0]);
  cross.setAttribute('x1', s.x(p.day)); cross.setAttribute('x2', s.x(p.day));
  dot.setAttribute('cx', s.x(p.day)); dot.setAttribute('cy', s.y(p.v));
  cross.classList.add('on'); dot.classList.add('on');
  $('#wl-read').innerHTML = wealthRead(PF.pts, p);
}

document.addEventListener('pointerover', pfPick);
document.addEventListener('pointerdown', e => { pfPick(e); wlTrack(e); });
document.addEventListener('pointermove', wlTrack);

// 结束检查：任何操作后若游戏结束则弹出结局
function checkOver() {
  if (S && S.over && !$('.m-ending')) { showEnding(); return true; }
  return false;
}

// ───────────── 标题与开局 ─────────────

function showTitle() {
  S = null;
  $('#game').classList.add('hidden');
  $('#title-screen').classList.remove('hidden');
  closeModal();
  $('#title-screen').innerHTML = `<img class="title-bg" src="${asset('scene', 'title_bg')}" alt="">
    <div class="title-box"><h1>魔门当铺</h1><h2>· 来路不明 ·</h2>
      <p>人、仙、魔、妖四方争斗。你在血煞宗杂役区开了间当铺。<br>租子一涨再涨——买下铺契之前，别被执法堂锁走。</p>
      <div class="title-btns">${hasSave() ? '<button class="btn primary big" data-act="continue">续上前缘</button>' : ''}
        <button class="btn big ${hasSave() ? '' : 'primary'}" data-act="new">新开一局</button></div></div>`;
}

function showSetup() {
  const pickd = { diff: 'normal', start: 'apprentice' };
  const render = () => modalHTML(`<h3>开局</h3>
    <h4>世道</h4><div class="cards">${DIFFICULTIES.map(d => `<div class="card ${pickd.diff === d.id ? 'on' : ''}" data-act="set-diff" data-id="${d.id}">
      <b>${d.name}</b><p class="small">${d.desc}</p><p class="muted small">铺契 ${d.deed} · 租金 ×${d.rent}</p></div>`).join('')}</div>
    <h4>出身</h4><div class="cards starts">${STARTS.map(s => `<div class="card ${pickd.start === s.id ? 'on' : ''}" data-act="set-start" data-id="${s.id}">
      <b>${s.name}${s.tag ? `<span class="tag real">${s.tag}</span>` : ''}</b><p class="small">${s.desc}</p>
      <p class="muted small">起手 ${s.stones} 灵石${(s.machines || []).length ? ' · ' + s.machines.map(m => MACHINES[m].name).join('、') : ''}</p></div>`).join('')}</div>
    <div class="h-btns"><button class="btn ghost" data-act="modal-close">返回</button><button class="btn primary" data-act="start">入局</button></div>`, 'm-setup');
  openModal(render);
  HANDLERS['set-diff'] = el => { pickd.diff = el.dataset.id; render(); };
  HANDLERS['set-start'] = el => { pickd.start = el.dataset.id; render(); };
  HANDLERS.start = () => { newGame(pickd.diff, pickd.start); enterGame(); showIntro(); };
}

function showIntro() {
  openModal(() => modalHTML(`<div class="npc-talk"><img src="${asset('chars', 'landlord')}" alt="">
    <div><h3>钱执事</h3>
    <p>“新来的掌柜？老规矩：铺面是宗门的，租子七日一收，一期比一期高。攒够 <b>${deedPrice()}</b> 灵石，铺契就归你。”</p>
    <p>“还有——仙门的东西别碰，执法堂的眼睛比血月还亮。妖族那帮畜生……你自己掂量。”</p>
    <p class="muted small">提示：拖动物品整理格子；陈列柜决定客流；夜里设备按「工坊」顺序消耗灵力运转。悬停在任何货物上查看详情。<br>
      杂役区的每个人都记得你做过的事。「人物」页可查看他们与你的往来和各自的命数。</p>
    <div class="h-btns"><button class="btn primary" data-act="modal-close">接过钥匙</button></div></div></div>`, 'm-npc'));
}

function enterGame() {
  $('#title-screen').classList.add('hidden');
  $('#game').classList.remove('hidden');
  sel = null; tab = 'display';
  closeModal();
  renderAll();
}

// ───────────── 动作分发 ─────────────

// 手上还拿着放不下的货：先腾地方再往下走，把库房翻出来给你收拾
function handBusy() {
  if (!handItems().length) return false;
  toast('手上还拿着放不下的货，先腾出地方', 'bad');
  tab = 'store'; front = 'main'; renderAll();
  return true;
}

const machineById = el => S.machines.find(m => m.mid === +el.dataset.mid);

const HANDLERS = {
  tab: el => { tab = el.dataset.tab; front = 'main'; renderSide(); },
  'speech-more': () => { talk.i++; renderSpeech(talk.text); },
  'm-desc': el => el.classList.toggle('open'),
  page: el => { pages[el.dataset.key] = (pages[el.dataset.key] || 0) + +el.dataset.d; modal ? modal() : renderSide(); },
  sub: el => { subs[el.dataset.key] = el.dataset.id; modal ? modal() : renderSide(); },
  new: () => showSetup(),
  continue: () => { load(); enterGame(); },
  'to-title': () => showTitle(),
  'modal-close': () => { closeModal(); renderAll(); },
  menu: () => openModal(() => modalHTML(`<h3>卷宗</h3><p>进度会在每天清晨自动存档。</p>
    <div class="h-btns"><button class="btn" data-act="lore-book">见闻录（${Object.keys(S.lore || {}).length}）</button><button class="btn" data-act="save-quit">存档并回山门</button><button class="btn ghost" data-act="modal-close">继续经营</button></div>`)),
  'save-quit': () => { save(); showTitle(); },
  open: () => { if (handBusy()) return; openShop(); closeModal(); HANDLERS.next(); },
  next: () => {
    if (handBusy()) return;
    const c = nextCustomer();
    if (!c) toast('今日已无客人');
    if (c && c.kind === 'story') { renderAll(); HANDLERS['story-talk'](); return; }
    if (c && c.kind === 'sell' && c.wanted) toast(`此人是通缉犯，悬赏 ${c.wanted} 灵石`, 'bad');
    // 竖屏：来客谈买卖时，下方直接摊开库房，方便把货放上货盘
    if (LAYOUT === 'tall' && c && ['buy', 'sell'].includes(c.kind)) tab = 'store';
    front = 'counter';
    renderAll();
  },
  close: () => {
    if (handBusy()) return;
    if (S.customer) { toast('柜台前还有客人，先把人送走'); return; }
    if (S.queue.length && !confirm(`门外还有 ${S.queue.length} 位客人，这就打烊？`)) return;
    closeShop(); tab = 'workshop'; front = 'counter'; renderAll();
  },
  dismiss: () => { dismissCustomer(false); renderAll(); },
  deal: () => openDeal(),
  good: el => { const uid = +el.dataset.uid; S.customer.item = uid; if (touchy) peek = peek === uid ? null : uid; renderAll(); },
  'take-toggle': () => { toggleTake(S.customer, S.customer.item); renderAll(); },
  'to-tray': () => {
    const it = S.items[sel], spot = findSpot('tray', it);
    if (!spot) { toast('货盘放不下了', 'bad'); return; }
    toTray(it, spot.x, spot.y); renderAll();
  },
  flatter: () => tiredOr('flatter', () => { const r = flatter(S.customer); feel(S.customer, r.ok ? 'pleased' : 'angry'); toast(r.text, r.ok ? 'good' : 'bad'); renderAll(); }),
  'haggle-close': () => { closeModal(); renderAll(); checkOver(); },
  report: () => { reportWanted(S.customer); renderAll(); toast(`你不动声色地托人报了执法堂。买卖照做，等${ta(personOf(S.customer))}出了门，赏金自会送到`, 'warn'); },
  'appraise-counter': () => tiredOr('appraise', () => openAppraise('counter', S.customer.item)),
  'appraise-commission': () => tiredOr('appraise', () => openAppraise('commission', S.customer.item)),
  'appraise-own': () => tiredOr('appraise', () => openAppraise('own', sel)),
  'inspect-own': () => tiredOr('inspect', () => HANDLERS['inspect-own-go']()),
  'inspect-own-go': () => {
    const it = S.items[sel], r = quickInspect(it);
    toast(r.laced ? `验出来了：${itemName(it)}被人${LACE[r.laced].verb}！吃下这个亏、贱卖、当好货转手，还是拆开学他的手法，由你。`
      : r.found ? `验出来了：${itemName(it)}以次充好，表面${it.sq}，实际只有${it.q}！` : `以你的眼力（${LENS_NAMES[r.lv]}），看不出${itemName(it)}有毛病。`, r.found || r.laced ? 'bad' : '');
    renderAll();
  },
  'inspect-item': () => tiredOr('inspect', () => HANDLERS['inspect-item-go']()),
  'inspect-item-go': () => {
    const it = customerItem(), r = quickInspect(it);
    toast(r.laced ? `这货被人${LACE[r.laced].verb}！` : r.found ? `以次充好！表面${it.sq}，实际只有${it.q}。` : `以你的眼力（${LENS_NAMES[r.lv]}），看不出毛病。`, r.found || r.laced ? 'bad' : '');
    renderAll();
  },
  'dispute-flaw': () => tiredOr('dispute', () => HANDLERS['dispute-go']()),
  'dispute-go': () => {
    const c = S.customer, r = disputeFlaw(c);
    feel(c, r.angry || r.caught ? 'angry' : 'afraid');
    if (r.angry || r.caught) {
      toast(r.angry ? `${c.name}恼羞成怒：“你什么意思？”` : `${c.name}把你挑的毛病一条条驳了回去。`, 'bad');
      if (c.patience <= 0) dismissCustomer(false);
    } else toast(r.bluff ? `${c.name}被你说得心虚，让了三成价。` : `${c.name}认了，开价降到 ${customerItem().ask}。`, 'good');
    renderAll();
  },
  consume: () => { const err = consume(S.items[sel]); if (err) toast(err, 'bad'); else sel = null; renderAll(); },
  bottle: () => { const err = bottle(S.items[sel]); toast(err || '装进了玉净瓶，修士们会出个好价钱。', err ? 'bad' : 'good'); renderAll(); },
  erase: () => { const err = eraseMark(S.items[sel]); toast(err || '烙印抹净了，来路从此干干净净。', err ? 'bad' : 'good'); renderAll(); },
  seal: () => { const it = S.items[sel], err = sealItem(it); toast(err || `${itemName(it)}贴上了正派封印——眼力不到的人，只当是名门正品。`, err ? 'bad' : 'good'); renderAll(); },
  retreat: () => { const err = toggleRetreat(); if (err) toast(err, 'bad'); renderAll(); },
  market: () => { if (handBusy()) return; const err = visitMarket(); if (err) { toast(err, 'bad'); return; } openMarket('ghost'); renderTopbar(); },
  'mk-tab': el => openMarket(el.dataset.k),
  'mk-buy': el => { const err = buyLot(el.dataset.k, +el.dataset.i); if (err) toast(err, 'bad'); openMarket(el.dataset.k); renderAll(); },
  'mk-sell': el => { const r = sellToDealer(el.dataset.k, S.items[el.dataset.uid]); if (r.err) toast(r.err, 'bad'); else toast(`出手，得 ${r.price} 灵石`, 'good'); openMarket(el.dataset.k); renderAll(); },
  'mk-talk': el => { const r = talkDealer(el.dataset.k); toast(r.err || r.text, r.err || !r.ok ? 'bad' : 'good'); openMarket(el.dataset.k); renderTopbar(); },
  'mk-leave': () => { closeModal(); renderAll(); },
  redeem: el => { const err = redeemMerit(el.dataset.f, +el.dataset.i); toast(err || '兑换成功，已放进库房', err ? 'bad' : 'good'); renderAll(); },
  probe: () => { const r = probe(S.customer); if (r.err) toast(r.err, 'bad'); else showIntel(r); renderAll(); },
  'secret-report': () => { const r = reportSecret(S.customer); if (r.err) toast(r.err, 'bad'); else showIntel(r); renderAll(); },
  'secret-blackmail': () => { const c = S.customer, r = blackmail(c); feel(c, r.cls === 'good' ? 'afraid' : 'angry'); showIntel(r); renderAll(); checkOver(); },
  'secret-keep': () => { showIntel(keepSecret(S.customer)); renderAll(); },
  'read-book': () => { const it = S.items[sel], err = readBook(it); if (err) toast(err, 'bad'); else { sel = null; toast('读通了。', 'good'); } renderAll(); },
  study: () => { const it = S.items[sel], err = studyFake(it); if (err) toast(err, 'bad'); else { if (!S.items[sel]) sel = null; toast('你摸清了门道。', 'good'); } renderAll(); },
  'buy-book': el => {
    const p = +el.dataset.p;
    if (S.stones < p || ITEMS[el.dataset.id].book.lv > BOOK_SHOP_MAX) return;
    const it = giveItem(el.dataset.id);
    if (it) { spend(p, `买下${itemName(it)}。`); toast(`${itemName(it)}已放进库房，选中后可研读`, 'good'); }
    renderAll();
  },
  'ap-done': () => { dismissCustomer(false); closeModal(); renderAll(); },
  'ap-buyback': () => { S.customer.take = [S.customer.item]; openDeal(); },
  inspect: () => { const r = runInspection(0); showInspectResult(r); },
  bribe: el => { const r = runInspection(+el.dataset.n); showInspectResult(r); },
  'inspect-done': () => { dismissCustomer(false); closeModal(); renderAll(); checkOver(); },
  scavenge: () => { if (!handBusy()) openScavengeSelect(); },
  'scav-go': el => { startScavenge(el.dataset.id); openModal(renderScavenge); },
  'scav-search': () => {
    const r = scavSearch();
    if (r && r.hazard) toast(r.hazard.text, 'bad');
    if (r && r.escaped) toast('遁地符一燃，你从险地脱身了', '');
    if (r && r.tired) toast(r.tired, 'bad');
    if (checkOver()) return;
    renderScavenge(); renderTopbar();
  },
  'scav-home': () => { endScavenge(); closeModal(); renderAll(); checkOver(); },
  sleep: () => {
    if (handBusy()) return;
    const night = dueStories('night')[0];
    if (night) { openStory(night, () => HANDLERS.sleep()); return; }
    const rep = nightResolve();
    sel = null;
    renderAll();
    if (checkOver()) return;
    showReport(rep);
  },
  'story-talk': () => openStory(S.customer.key, () => { dismissCustomer(false); renderAll(); }),
  'story-done': () => {
    closeModal(); renderAll();
    if (checkOver()) return;
    const done = storyDone; storyDone = null;
    if (done) done();
  },
  person: el => openPerson(el.dataset.pid),
  dao: () => openDao(),
  cultivate: el => {
    const it = S.items[el.dataset.uid];
    if (it.id === realm().key && !(flawedKey(it) && knownFlaw(it)) && !confirm(`${itemName(it)}是你破境的钥匙，真要直接服炼？`)) return;
    const err = cultivate(it); if (err) toast(err, 'bad'); else if (!S.items[sel]) sel = null; if (modal) openDao(); renderAll(); },
  breakthrough: () => { const r = breakthrough(); if (r.err) { toast(r.err, 'bad'); return; } closeModal(); showIntel({ text: r.text, cls: r.ok ? 'good' : 'bad' }); renderAll(); },
  kill: () => {
    const c = S.customer, p = personOf(c);
    if (!confirm(`对${p.name}下手？杀人夺宝，损阴德，被人看见就是大祸。`)) return;
    feel(c, 'afraid');
    const r = killPerson(p, 'counter');
    if (r.err) { toast(r.err, 'bad'); return; }
    // 得手了就不会再从门口走出去；逃掉的才带着惊惶站一会儿
    if (r.ok) { parting = null; shown = null; $('#portrait').style.display = 'none'; }
    if (sel && !S.items[sel]) sel = null;
    showIntel({ text: r.text, cls: r.ok ? 'good' : 'bad' }); renderAll(); checkOver();
  },
  ambush: el => {
    const p = S.people[el.dataset.pid];
    if (!confirm(`今夜去截杀${p.name}？`)) return;
    const r = killPerson(p, 'night');
    if (r.err) { toast(r.err, 'bad'); return; }
    showIntel({ text: r.text, cls: r.ok ? 'good' : 'bad' }); renderAll(); checkOver();
  },
  soulmark: () => { const r = soulMark(personOf(S.customer)); if (r.err) toast(r.err, 'bad'); else showIntel({ text: r.text, cls: r.ok ? 'good' : 'bad' }); renderAll(); checkOver(); },
  'file-secret': el => { const it = makeIntel('secret', { p: S.people[el.dataset.pid] }); toast(`录成了一份${itemName(it)}，放进库房`, 'good'); openPerson(el.dataset.pid); renderAll(); },
  release: el => { release(S.people[el.dataset.pid]); openPerson(el.dataset.pid); renderAll(); },
  debt: el => { const p = S.people[el.dataset.pid]; toast(collectDebt(p, el.dataset.how)); openPerson(p.pid); renderAll(); },
  'plea-help': () => { const p = personOf(S.customer), err = helpWeak(S.customer); if (err) toast(err, 'bad'); else toast(`${ta(p)}磕了个头，千恩万谢地走了`, 'good'); renderAll(); },
  'plea-lend': () => { const err = lendTo(S.customer); if (err) toast(err, 'bad'); renderAll(); },
  'plea-labor': () => { const p = personOf(S.customer); indenture(p); toast(`${p.name}进了你的后院，往后替你烧炉搬货`); renderAll(); },
  'plea-away': () => { turnAway(S.customer); renderAll(); },
  'cq-tribute': el => { const err = cliqueTribute(el.dataset.k, +el.dataset.n); if (err) toast(err, 'bad'); renderAll(); },
  'cq-offer': el => { const r = cliqueOffer(el.dataset.k, S.items[sel]); sel = null; toast(r.text, r.bad ? 'bad' : 'good'); renderAll(); },
  'cq-join': el => { const err = joinClique(el.dataset.k); toast(err || `你投到了${CLIQUES[el.dataset.k].head}门下`, err ? 'bad' : 'good'); renderAll(); },
  'cq-leak': el => { const err = leakDirt(S.items[sel], el.dataset.k); if (err) toast(err, 'bad'); else { sel = null; toast(`${CLIQUES[el.dataset.k].head}收下了内幕，眼里有光`, 'good'); } renderAll(); },
  'opp-deliver': el => { const r = deliverOpp(findOpp(el.dataset.key), S.items[el.dataset.uid]); if (sel && !S.items[sel]) sel = null; toast(r.text, r.bad ? 'bad' : 'good'); renderAll(); },
  'opp-take': el => { const r = takeOpp(findOpp(el.dataset.key)); toast(r.err || r.text, r.err ? 'bad' : 'good'); renderAll(); },
  'power-swap': () => {
    const it = S.items[sel], low = weakestCrystal(), at = it.pos;
    placeItem(it, 'power', low.pos.x, low.pos.y); placeItem(low, at.g, at.x, at.y);
    toast(`灵晶嵌进阵眼，换下的那块（充能 ${low.charge || 0}）放回了原处`, 'good');
    sel = peek = null; renderAll();
  },
  'move-to': el => {
    const it = S.items[sel], gid = el.dataset.g, sp = findSpot(gid, it);
    if (!sp) { toast('放不下了', 'bad'); return; }
    placeMoved(it, gid, sp.x, sp.y); sel = peek = null; renderAll();
  },
  // 同一处的同种货一并放进饲料格：一份一份叠，叠满了另起一格，放不下的留在原处
  'move-all': el => {
    const it = S.items[sel], gid = el.dataset.g, list = itemsIn(it.pos.g).filter(o => o.id === it.id);
    let n = 0;
    for (const o of [it, ...list.filter(o => o !== it)]) { const sp = findSpot(gid, o); if (!sp) break; placeMoved(o, gid, sp.x, sp.y); n++; }
    toast(n < list.length ? `放进去 ${n} 份，还有 ${list.length - n} 份放不下` : `${n} 份${itemName(it)}都放进去了`, n < list.length ? 'bad' : 'good');
    sel = peek = null; renderAll();
  },
  // 整摞取出：每份各占库房一格，品相照旧；库房满了放地上，再满就留在原处
  unpile: () => {
    const pile = stackOf(S.items[sel]);
    let n = 0;
    for (const o of pile) { const gid = ['store', 'floor'].find(x => findSpot(x, o)); if (!gid) break; const sp = findSpot(gid, o); placeMoved(o, gid, sp.x, sp.y); n++; }
    toast(n < pile.length ? `取出 ${n} 份，库房和地上都满了，还剩 ${pile.length - n} 份` : `${n} 份都收回来了`, n < pile.length ? 'bad' : 'good');
    sel = peek = null; renderAll();
  },
  tidy: () => { if (!tidy()) toast('已经摆得够紧了，再要地方只能出手或丢弃', 'bad'); renderAll(); },
  'trash-sel': () => { const it = S.items[sel]; if (knownValue(it) > 30 && !confirm(`丢弃${itemName(it)}？`)) return; destroyItem(it); sel = null; renderAll(); },
  'buy-intel': el => { const err = buyIntel(+el.dataset.i); toast(err || '密报已放进库房，悬停可看写的什么', err ? 'bad' : 'good'); renderAll(); },
  'gift-open': el => openGift(el.dataset.pid),
  'heal-open': () => openModal(openHeal),
  'lore-book': () => openModal(openLoreBook),
  'ask-lore': el => {
    const p = S.people[el.dataset.pid], o = loreOffer(p, loreTip(el.dataset.id));
    if (o.kind === 'sell' && o.price > 150 && !confirm(`出 ${o.price} 灵石向${p.name}请教？`)) return;
    const r = askLore(p, el.dataset.id, o.kind === 'sell');
    if (r.err) toast(r.err, 'bad'); else if (r.text) { showIntel({ text: r.text, cls: 'good' }); }
    renderAll();
  },
  'fate-open': () => openModal(openFate),
  'heal-use': el => {
    const it = S.items[el.dataset.uid], err = consume(it);
    if (err) toast(err, 'bad'); else if (sel === it.uid) sel = null;
    renderAll();
  },
  'seek-heal': el => {
    const r = seekHealer(S.people[el.dataset.pid]);
    toast(r.err || r.text, r.err ? 'bad' : 'good'); renderAll();
  },
  treat: el => {
    const p = S.people[el.dataset.pid], it = S.items[el.dataset.uid], k = cureBy(it, p), name = itemName(it);
    if (sel === it.uid) sel = null;
    const sev0 = condSev(p, k), r = giveGift(p, it), left = condSev(p, k);
    toast(r.caught ? `${p.name}发现药里动了手脚！` : left >= sev0 ? `${p.name}服下${name}，可不见好`
      : left ? `${p.name}服下${name}，${CONDS[k].name}减轻到${CONDS[k].grade[left - 1]}（好感 +${r.gain}）` : `${p.name}服下${name}，${CONDS[k].name}好了（好感 +${r.gain}）`, r.caught || left >= sev0 ? 'bad' : left ? 'warn' : 'good');
    openPerson(p.pid); renderAll();
  },
  'gift-give': el => {
    const p = S.people[el.dataset.pid], it = S.items[el.dataset.uid];
    if (knownValue(it) > 300 && !confirm(`把${itemName(it)}送给${p.name}？`)) return;
    const r = giveGift(p, it);
    if (sel === it.uid) sel = null;
    toast(r.caught ? `${p.name}发现礼物里动了手脚！` : `${p.name}收下了，好感 +${r.gain}`, r.caught ? 'bad' : 'good');
    openPerson(p.pid); renderAll();
  },
  'gift-stones': el => {
    const p = S.people[el.dataset.pid], gain = giveStones(p, +el.dataset.n);
    toast(`${p.name}收下了灵石，好感 +${gain}`, 'good'); openPerson(p.pid); renderAll();
  },
  command: el => {
    const p = S.people[el.dataset.pid], r = runCommand(p, el.dataset.id, el.dataset.lever);
    toast(gx(p, r.text), r.exposed ? 'bad' : 'good'); openPerson(p.pid); renderAll(); checkOver();
  },
  uncontrol: el => { releaseControl(S.people[el.dataset.pid]); openPerson(el.dataset.pid); renderAll(); },
  lace: () => openLace(),
  'lace-do': el => { const err = laceWith(S.items[sel], S.items[el.dataset.uid]); if (err) { toast(err, 'bad'); return; } closeModal(); renderAll(); toast('料已下好。从外面看，什么也看不出来。'); },
  'report-ok': () => {
    closeModal();
    if (S.landlordVisit) { S.landlordVisit = false; showLandlord(); }
    tab = 'display';
    renderAll();
  },
  'm-open': el => { openMid = el.dataset.mid === 'array' ? 'array' : +el.dataset.mid; renderSide(); },
  'm-up': el => { moveMachine(machineById(el), -1); renderAll(); },
  'm-down': el => { moveMachine(machineById(el), 1); renderAll(); },
  'm-toggle': el => { const m = machineById(el); m.on = !m.on; renderAll(); },
  'm-remove': el => {
    const m = machineById(el);
    if (confirm(`拆除${MACHINES[m.type].name}？只能退回三成旧料钱。`)) { removeMachine(m); renderAll(); }
  },
  collect: el => { collectPuppetCash(machineById(el)); renderAll(); },
  'buy-supply': el => { const err = buySupply(S.supply[+el.dataset.i]); if (err) toast(err, 'bad'); renderAll(); },
  'gu-seal': el => { const m = machineById(el); m.seal = !m.seal; toast(m.seal ? '封上盅口：今夜起蛊虫相食，最凶的吞掉最弱的' : '揭开盅口：照常喂养', m.seal ? 'bad' : ''); renderAll(); },
  'buy-stall': el => { const m = S.machines.find(x => x.mid === +el.dataset.mid), err = buyStall(m); toast(err || `${MACHINES[m.type].name}加盖了一栏`, err ? 'bad' : 'good'); renderAll(); },
  'buy-machine': el => { const err = buyMachine(el.dataset.type); if (err) toast(err, 'bad'); else { tab = 'workshop'; toast('设备已安置在后院', 'good'); } renderAll(); },
  'buy-upgrade': el => { const err = buyUpgrade(el.dataset.id); if (err) toast(err, 'bad'); renderAll(); },
  'sell-broker': () => {
    const it = S.items[sel];
    if (knownValue(it) > 150 && !confirm(`只按四成折价卖给货郎，确定？`)) return;
    sellToBroker(it); sel = null; renderAll();
  },
  'pay-rent': () => { payRentEarly(); renderAll(); },
  'buy-deed': () => { if (buyDeed()) { renderAll(); checkOver(); } },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = HANDLERS[el.dataset.act];
  if (fn) fn(el);
  // 卡上的按钮打开了弹窗：卡收起，免得压在弹窗上
  if (S && peek && modal && el.closest('#itemcard')) peek = null;
  if (S) renderCard();
});

// ───────────── 拖放 ─────────────

let drag = null;

function gridAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && (el.closest('[data-gid]') || el.closest('[data-drop]'));
}

document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.item[data-uid]');
  if (!el || e.button !== 0 || el.classList.contains('locked') || el.classList.contains('preview')) return;
  const it = S.items[el.dataset.uid];
  if (!it) return;
  const r = el.getBoundingClientRect(), cell = CELL * scale;
  drag = { it, el, sx: e.clientX, sy: e.clientY, started: false, tab0: tab, front0: front,
    offX: Math.min(ITEMS[it.id].w - 1, Math.floor((e.clientX - r.left) / cell)),
    offY: Math.min(ITEMS[it.id].h - 1, Math.floor((e.clientY - r.top) / cell)) };
  e.preventDefault();
});

document.addEventListener('pointermove', e => {
  if (!drag) { moveTip(e); return; }
  const cell = CELL * scale, d = ITEMS[drag.it.id];
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.started = true;
    hideTip();
    if (peek) { peek = null; renderCard(); }
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.style.width = `${d.w * cell}px`;
    drag.ghost.style.height = `${d.h * cell}px`;
    drag.ghost.innerHTML = `<img src="${asset('items', itemIcon(drag.it))}" alt="">`;
    document.body.appendChild(drag.ghost);
    drag.el.classList.add('dragging');
  }
  drag.ghost.style.left = `${e.clientX - (drag.offX + 0.5) * cell}px`;
  drag.ghost.style.top = `${e.clientY - (drag.offY + 0.5) * cell}px`;
  dragHover(e.clientX, e.clientY);
  document.querySelectorAll('.drop-hint').forEach(h => h.remove());
  document.querySelectorAll('.trash.hot').forEach(h => h.classList.remove('hot'));
  drag.target = null;
  const tgt = gridAt(e.clientX, e.clientY);
  if (!tgt) return;
  if (tgt.dataset.drop === 'trash') { tgt.classList.add('hot'); drag.target = { trash: true }; return; }
  const gid = tgt.dataset.gid, r = tgt.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / cell) - drag.offX, y = Math.floor((e.clientY - r.top) / cell) - drag.offY;
  const why = rejectReason(gid, drag.it);
  const ok = !why && fits(gid, drag.it, x, y);
  const hint = document.createElement('div');
  hint.className = `drop-hint ${ok ? 'ok' : 'bad'}`;
  hint.style.cssText = `left:${x * CELL}px;top:${y * CELL}px;width:${d.w * CELL}px;height:${d.h * CELL}px`;
  tgt.appendChild(hint);
  drag.target = { gid, x, y, ok, why };
});

document.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag, { it, started, target } = d;
  document.querySelectorAll('.drop-hint').forEach(h => h.remove());
  clearTimeout(hoverAt && hoverAt.timer); hoverAt = null;
  drag = null;
  dragEnd = Date.now();
  if (!started) {
    // 触屏：再点一下正开着详情的货才收起；鼠标照旧点一下选中、再点取消
    d.el.classList.remove('dragging');
    sel = (touchy ? peek : sel) === it.uid ? null : it.uid;
    if (touchy) peek = sel;
    renderAll(); return;
  }
  if (!target || !(target.trash || target.ok)) { cancelDrag(d); return; }
  d.ghost.remove();
  d.el.classList.remove('dragging');
  if (target.trash) {
    if (knownValue(it) > 30 && !confirm(`丢弃${itemName(it)}？`)) { renderAll(); return; }
    if (S.scav && S.scav.pending === it.uid) S.scav.pending = null;
    destroyItem(it);
    if (sel === it.uid) sel = null;
  } else placeMoved(it, target.gid, target.x, target.y);
  renderAll();
});

// 松手处放不下：当作没拖过——货飞回原处，途中翻上来的窗口、切过的分页也还原
function cancelDrag(d) {
  if (d.target && d.target.why) toast(d.target.why, 'bad');
  front = d.front0;
  const r = d.el.isConnected && tab === d.tab0 && d.el.getBoundingClientRect();
  tab = d.tab0;
  if (!r) { d.ghost.remove(); renderAll(); return; }
  layoutDock();
  d.ghost.style.transition = 'left .18s ease-out, top .18s ease-out';
  d.ghost.style.left = `${r.left}px`; d.ghost.style.top = `${r.top}px`;
  setTimeout(() => { d.ghost.remove(); d.el.classList.remove('dragging'); }, 190);
}

// 拖着货经过被压住的窗口，稍停就翻上来；经过分页按钮，稍停就切过去
let hoverAt = null, dragEnd = 0;
function dragHover(x, y) {
  const el = document.elementFromPoint(x, y);
  const w = LAYOUT === 'tall' && el && el.closest('#dock .win:not(.front)');
  const tb = !w && el && el.closest('[data-act="tab"]');
  const key = w ? `win:${w.dataset.win}` : tb && tb.dataset.tab !== tab ? `tab:${tb.dataset.tab}` : null;
  if (hoverAt && hoverAt.key === key) return;
  clearTimeout(hoverAt && hoverAt.timer);
  hoverAt = key && { key, timer: setTimeout(() => {
    hoverAt = null;
    if (w) raise(w.dataset.win);
    else { tab = tb.dataset.tab; front = 'main'; renderSide(); }
  }, w ? 150 : 400) };
}

// 拖完、点完货松手后的那下点击不算数：货已重绘，免得落到空处被当成“点空处取消选中”
document.addEventListener('click', e => { if (Date.now() - dragEnd < 300) { dragEnd = 0; e.stopPropagation(); e.preventDefault(); } }, true);

// 挪货：拖放与点按共用
function placeMoved(it, gid, x, y) {
  const from = it.pos && it.pos.g;
  if (gid === 'tray') toTray(it, x, y);
  else { delete it.from; placeItem(it, gid, x, y); }
  if (S.scav && S.scav.pending === it.uid) S.scav.pending = null;
  if (gid === 'display' && from !== 'display' && isBanned(it)) {
    const t = tolerance(landlordPerson());
    toast(`${itemName(it)}是违禁品。管事${landlordPerson().name}看见了多半会${TOLERANCE_NAME[t]}。`, t === 'ignore' ? '' : 'bad');
  }
  if (from === 'tool' || gid === 'tool') {
    peak('lens', appraiseLevel());
    const found = recheckStock();
    toast(found.length ? `换上${LENS_NAMES[appraiseLevel()]}，重新审视库房：${found.join('、')}有问题！` : `鉴宝台换上了${LENS_NAMES[appraiseLevel()]}`, found.length ? 'bad' : '');
  }
}

// 点空格子、画面等没有按钮的地方：收起详情卡、取消选中。点到别的按钮只收卡，选中留给那个按钮用（如进献）
document.addEventListener('click', e => {
  if (!S || !(sel || peek) || e.target.closest('#itemcard, .item, #modal-layer')) return;
  if (e.target.closest('[data-act]')) { peek = null; renderCard(); return; }
  sel = peek = null; renderAll();
});

// ───────────── 悬停提示 ─────────────

function moveTip(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  const el = e.target.closest && e.target.closest('.item[data-uid]');
  const tip = $('#tooltip');
  if (!el || !S || !S.items[el.dataset.uid]) { hideTip(); return; }
  const it = S.items[el.dataset.uid];
  if (tip.dataset.uid !== String(it.uid)) { tip.innerHTML = itemTip(it); tip.dataset.uid = it.uid; }
  tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + 18, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 18;
  if (y + h > innerHeight - 8) y = innerHeight - h - 8;
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}

function hideTip() { const t = $('#tooltip'); t.style.display = 'none'; t.dataset.uid = ''; }

window.addEventListener('resize', fitStage);
window.addEventListener('DOMContentLoaded', () => { fitStage(); showTitle(); });
