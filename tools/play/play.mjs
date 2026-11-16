#!/usr/bin/env node
// 命令行玩游戏：给测试玩家（人或 AI）用。载入完整的游戏（含界面 ui.js），用一个假 DOM 接住界面写出的 HTML，
// 把当前画面转成文字，按钮编号，照编号点。每局一份命令日志，每次调用都用同一颗种子从头重放——弹窗、议价进度都还原得出来。
//   node tools/play/play.mjs <局目录> new <开局id> [--diff normal] [--seed N] [--cap 天数]   新开一局（开局 id 见攻略 guide/start.md）；--cap：测试只玩到第几日
//   node tools/play/play.mjs <局目录> look                 看当前画面
//   node tools/play/play.mjs <局目录> click <编号>          点画面上第几个按钮（编号每次看画面都会变，先 look 再点）
//   node tools/play/play.mjs <局目录> price <数>            议价时拖价钱滑杆到这个数（画面上写着范围）
//   node tools/play/play.mjs <局目录> sel <uid> | unsel     选中 / 放下一件货（选中后画面会多出这件货能做的事）
//   node tools/play/play.mjs <局目录> move <uid> <格子id> [x y]   把货拖到某个格子（库房 store、陈列 display、地上 floor、设备的入料格等，画面上列着格子 id）
//   node tools/play/play.mjs <局目录> trash <uid>           把货丢掉
//   node tools/play/play.mjs <局目录> tip <uid>             悬停看这件货的详情
//   node tools/play/play.mjs <局目录> next                 自动点掉只有一个按钮的弹窗（夜间报告、成交结果、“继续”……），停在要拿主意的画面
//   node tools/play/play.mjs <局目录> status               一行 JSON：第几日、灵石、关注、伤毒、是否结局（给测试汇总用）
//   node tools/play/play.mjs <局目录> history [n]           最近 n 条命令
// 一次可以连着做几件事：用 ; 隔开，例如  click 3 ; look
// 规则：只能这样玩。别改游戏文件、别改局目录里的 log.jsonl——那等于作弊，测试作废。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { GAME, scripts } from '../lib/headless.mjs';

// ───────────── 假 DOM ─────────────

class El {
  constructor(sel = '') {
    this.sel = sel; this._html = ''; this.style = {}; this.dataset = {}; this.value = ''; this.className = '';
    this.isConnected = true; this.offsetWidth = 0; this.offsetHeight = 0; this.disabled = false; this.children = [];
    const self = this;
    this.classList = {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); self.className = [...this._s].join(' '); },
      remove(...c) { c.forEach(x => this._s.delete(x)); self.className = [...this._s].join(' '); },
      toggle(c, on) { (on ?? !this._s.has(c)) ? this.add(c) : this.remove(c); return this._s.has(c); },
      contains(c) { return this._s.has(c); },
    };
  }
  get firstChild() { return this._first || (this._first = new El(this.sel + '>*')); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.written = true; }
  get textContent() { return stripTags(this._html); }
  set textContent(v) { this._html = esc(String(v)); this.written = true; }
  get innerText() { return this.textContent; }
  insertAdjacentHTML(_, h) { this._html += h; this.written = true; }
  querySelector(s) { return doc.querySelector(s); }
  querySelectorAll() { return []; }
  closest() { return null; }
  matches() { return false; }
  contains() { return false; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  addEventListener() {} removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  removeChild() {} remove() { this._html = ''; } focus() {} blur() {} click() {} scrollIntoView() {}
  setAttribute(k, v) { this[k] = v; } getAttribute(k) { return this[k] ?? null; } removeAttribute(k) { delete this[k]; }
  setPointerCapture() {} releasePointerCapture() {} animate() { return { finished: Promise.resolve(), cancel() {} }; }
}

const els = new Map();
const doc = {
  querySelector(sel) { if (!els.has(sel)) els.set(sel, new El(sel)); return els.get(sel); },
  querySelectorAll() { return []; },
  getElementById(id) { return doc.querySelector(`#${id}`); },
  createElement(t) { return new El(t); },
  elementFromPoint() { return null; },
  addEventListener() {}, removeEventListener() {},
  body: new El('body'), documentElement: new El('html'),
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const stripTags = h => unesc(String(h).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// ───────────── HTML → 可点的东西 ─────────────

const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source']);
function parse(html) {
  const root = { tag: 'root', attrs: {}, kids: [] }, stack = [root];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[3] != null) { stack[stack.length - 1].kids.push({ text: m[3] }); continue; }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith('</')) {
      const i = stack.map(n => n.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i;
      continue;
    }
    const attrs = {};
    for (const a of m[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = unesc(a[2] ?? a[3] ?? a[4] ?? '');
    const node = { tag, attrs, kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (!VOID.has(tag) && !m[0].endsWith('/>')) stack.push(node);
  }
  return root;
}
const textOf = n => n.text != null ? unesc(n.text) : n.tag === 'br' ? ' ' : (n.attrs.alt || '') + n.kids.map(textOf).join('');
function walk(n, fn, anc = []) { if (n.text != null) return; fn(n, anc); n.kids.forEach(k => walk(k, fn, [...anc, n])); }
const dataOf = attrs => Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-'))
  .map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));

// 一块 HTML 的文字，按钮换成 [编号]；鉴宝镜里的破绽换成文字
function render(html, buttons, inputs) {
  const tree = parse(html);
  const out = [];
  const emit = (n, anc) => {
    if (n.text != null) { out.push(unesc(n.text)); return; }
    const a = n.attrs;
    if (a.class && /\b(tooltip|ghost-drag)\b/.test(a.class)) return;
    if (n.tag === 'input' && a.type === 'range') {
      inputs.push({ id: a.id, min: +a.min, max: +a.max, step: +(a.step || 1), value: +a.value });
      out.push(`［滑杆 ${a.min}～${a.max}，当前 ${a.value}：用 price <数> 拖］`); return;
    }
    if (a.id === 'lens-content') {
      const tr = []; walk(n, x => { if (x.tag === 'img' && /\bap-trace\b/.test(x.attrs.class || '')) tr.push(x.attrs.src.match(/_([a-z0-9]+)\.webp$/)?.[1] || '?'); });
      out.push(tr.length ? `［照妖镜里看到 ${tr.length} 处与肉眼所见不同：${tr.join('、')}］` : '［照妖镜里看到的与肉眼所见一模一样］'); return;
    }
    if (a.class && /\bap-view\b/.test(a.class)) return;
    if (a['data-act'] && !/^(speech-more)$/.test('')) {
      const label = textOf(n).replace(/\s+/g, ' ').trim() || a.title || a['data-act'];
      const disabled = a.disabled != null || /\bdisabled\b/.test(a.class || '');
      const b = { act: a['data-act'], data: dataOf(a), label, disabled, why: a.title || '' };
      if (!disabled) { buttons.push(b); out.push(` [${buttons.length}]${label} `); }
      else out.push(` [×]${label}${a.title ? `（${a.title}）` : ''} `);
      return;
    }
    if (n.tag === 'img') { if (a.alt) out.push(a.alt); return; }
    if (/^(p|div|li|h\d|tr|br|hr)$/.test(n.tag)) out.push('\n');
    if (n.tag === 'td' || n.tag === 'th') out.push(' | ');
    n.kids.forEach(k => emit(k, [...anc, n]));
    if (/^(p|div|li|h\d|tr)$/.test(n.tag)) out.push('\n');
  };
  tree.kids.forEach(k => emit(k, []));
  return out.join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}

// ───────────── 载入一局 ─────────────

function mulberry(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return f;
}

// index.html 里写死的按钮：开门迎客（文字在里头的 span）、打烊牌
const STATIC = [['#door', ''], ['#closesign', '打烊', 'close']];

function boot(seed) {
  els.clear();
  for (const [sel, text, act] of STATIC) { const e = doc.querySelector(sel); if (text) e._html = text; if (act) e.dataset.act = act; }
  const toasts = [], confirms = [];
  let clock = 1700000000000;
  const win = {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  };
  const ctx = {
    console: { log() {}, warn() {}, error: (...a) => process.stderr.write(a.join(' ') + '\n'), info() {} },
    JSON, Promise, Set, Map, Object, Array, String, Number, Boolean, Symbol, Error, RegExp, Proxy, Reflect, Intl,
    Math: Object.create(Math, { random: { value: mulberry(seed) } }),
    Date: Object.assign(function () { return new Date(clock); }, { now: () => (clock += 50) }),
    document: doc, window: win, navigator: { userAgent: 'node', maxTouchPoints: 0 },
    localStorage: (() => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; })(),
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    confirm: t => (confirms.push(t), true), alert: t => toasts.push(t), prompt: () => null,
    innerWidth: 1280, innerHeight: 800, getComputedStyle: () => ({}), Image: function () { return new El('img'); },
    __toasts: toasts, __confirms: confirms,
  };
  Object.assign(win, ctx); ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of [...scripts(), 'js/ui.js']) vm.runInContext(fs.readFileSync(path.join(GAME, f), 'utf8'), ctx, { filename: f });
  // 界面里的提示条：接住文字
  vm.runInContext(`{ const t0 = toast; toast = (msg, cls) => { __toasts.push(String(msg).replace(/<[^>]+>/g, '')); }; }
    globalThis.__H = HANDLERS; globalThis.__S = () => S;
    globalThis.__ui = () => ({ modal: !!modal, sel, tab });
    globalThis.__set = (k, v) => { if (k === 'sel') sel = v; if (k === 'peek') peek = v; };
    fitStage(); showTitle();`, ctx);
  return ctx;
}

// 当前画面：顶栏，弹窗开着就只看弹窗；否则看场景、柜台、货卡、分页、库房
function screen(ctx) {
  const buttons = [], inputs = [];
  const S = vm.runInContext('S', ctx), ui = vm.runInContext('__ui()', ctx);
  const part = (sel, title) => { const e = els.get(sel); if (!e || !e.innerHTML.trim()) return ''; const t = render(e.innerHTML, buttons, inputs); return t ? `【${title}】\n${t}` : ''; };
  const out = [];
  if (!S) { out.push(part('#title-screen', '山门')); return { text: out.join('\n\n'), buttons, inputs }; }
  const top = part('#topbar', '顶栏');
  out.push(top.replace(/^(【顶栏】)\n/, '$1').replace(/\n/g, ' · '));
  out.push('【状态】' + vm.runInContext(`'灵石 ' + S.stones + ' · 体力 ' + S.vit.st + ' · 精神 ' + S.vit.sp + ' · 执法堂关注 ' + S.heat
    + ' · 第 ' + S.day + ' 日' + (S.phase === 'night' ? '夜' : '') + ' · 下期租金 ' + rentAmount() + '（第 ' + S.rentDue + ' 日）· 铺契 ' + deedPrice()
    + (condList('me').length ? ' · 身上：' + condList('me').map(c => c.label).join('、') : '')`, ctx));
  const ml = els.get('#modal-layer');
  let modalBtns = null;
  if (ml && ml.className.includes('on') && ml.innerHTML.trim()) {
    const from = buttons.length;
    out.push(part('#modal-layer', '弹窗'));
    modalBtns = buttons.slice(from);
  } else {
    const door = [];
    for (const [sel] of STATIC) {
      const e = els.get(sel);
      if (!e || e.style.display === 'none' || !e.dataset.act) continue;
      buttons.push({ act: e.dataset.act, data: {}, label: (e._first ? e._first.textContent : '') || e.textContent });
      door.push(` [${buttons.length}]${buttons[buttons.length - 1].label} `);
    }
    if (door.length) out.push(`【店门口】\n${door.join('')}`);
    out.push(part('#speech', '来客说'), part('#nameplate', '来客'), part('#counter-panel', '柜台'),
      part('#itemcard', `选中的货`), part('#tabs', '分页'), part('#tab-body', '分页内容'), part('#side', '边栏'), part('#dock', '操作'), part('#nav', '导航'));
    out.push(gridsText(ctx, S));
  }
  return { text: out.filter(Boolean).join('\n\n'), buttons, inputs, modalBtns };
}

// 没得选的画面：弹窗里只有一个按钮、也没有滑杆（夜间报告“迎接第几日”、成交后的“好”、故事里的“继续”）
const noChoice = s => s.modalBtns && s.modalBtns.length === 1 && !s.inputs.length;

// 格子里的货：uid、名字、看上去的品相与估值（与悬停所见一致）
function gridsText(ctx, S) {
  const lines = vm.runInContext(`(() => {
    const name = gid => ({ store: '库房', display: '陈列柜', floor: '地上（夜里可能遭贼）', counter: '柜台', power: '灵力格', hidden: '夹层暗格', basket: '背篓', tool: '鉴定工具', tray: '交易盘' })[gid]
      || (gid.startsWith('m') ? (() => { const [mid, slot] = gid.slice(1).split(':'); const m = S.machines.find(x => x.mid === +mid); return m ? MACHINES[m.type].name + '·' + ({ in: '入料', out: '产出', mod: '模块' })[slot] : gid; })() : gid);
    const by = {};
    for (const it of Object.values(S.items)) if (it.pos) (by[it.pos.g] = by[it.pos.g] || []).push(it);
    return Object.keys(S.grids).filter(g => g !== 'counter' || by[g]).map(g => {
      const G = S.grids[g], list = (by[g] || []).sort((a, b) => a.uid - b.uid);
      return name(g) + '［' + g + '，' + G.w + '×' + G.h + '］：' + (list.length ? list.map(it => '#' + it.uid + ' ' + itemName(it) + (hasQuality(it) ? '·' + qualityName(it.q) : '') + ' 估' + knownValue(it)).join('；') : '空');
    });
  })()`, ctx);
  return `【格子与货】（货写作 #uid；sel <uid> 选中、move <uid> <格子id> 拖动、tip <uid> 看详情）\n${lines.join('\n')}`;
}

// ───────────── 命令 ─────────────

const dir = process.argv[2];
if (!dir || dir.startsWith('-')) { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 17).join('\n').replace(/^\/\/ ?/gm, '')); process.exit(0); }
const LOG = path.join(dir, 'log.jsonl'), META = path.join(dir, 'meta.json');
const rest = process.argv.slice(3).join(' ').split(/\s*;\s*/).map(s => s.trim()).filter(Boolean);

function act(ctx, cmd, live) {
  const [op, ...a] = cmd.split(/\s+/);
  const S = () => vm.runInContext('S', ctx);
  ctx.__toasts.length = 0; ctx.__confirms.length = 0;
  const run = code => vm.runInContext(code, ctx);
  switch (op) {
    case 'look': case 'status': case 'history': case 'tip': case 'next': return null;
    case 'click': {
      // 日志里记的是按钮本身（act 与数据），不是编号：重放不受画面变化影响
      const b = live ? live.buttons[+a[0] - 1] : JSON.parse(cmd.slice(6));
      if (!b) throw new Error(`没有编号 ${a[0]} 的按钮（先 look）`);
      ctx.__btn = { dataset: b.data, disabled: false, closest: () => null, classList: { contains: () => false }, value: '' };
      ctx.__act = b.act;
      run(`{ const fn = __H[__act]; if (!fn) throw new Error('这个按钮没有动作：' + __act); fn(__btn); if (S && typeof renderCard === 'function') renderCard(); }`);
      return `click ${JSON.stringify({ act: b.act, data: b.data, label: b.label })}`;
    }
    case 'price': {
      const r = els.get('#h-range');
      if (!r || !r.oninput) throw new Error('现在没有价钱滑杆');
      r.value = String(+a[0]); r.oninput();
      return `price ${+a[0]}`;
    }
    case 'sel': case 'unsel': {
      const uid = op === 'sel' ? +a[0] : null;
      if (uid != null && !S().items[uid]) throw new Error(`没有 #${uid} 这件货`);
      ctx.__uid = uid; run('__set("sel", __uid); __set("peek", __uid); renderAll();');
      return op === 'sel' ? `sel ${uid}` : 'unsel';
    }
    case 'move': {
      const [uid, gid, x, y] = a; ctx.__mv = { uid: +uid, gid, x: x != null ? +x : null, y: y != null ? +y : null };
      const err = run(`(() => { const it = S.items[__mv.uid]; if (!it) return '没有这件货';
        if (!S.grids[__mv.gid]) return '没有格子 ' + __mv.gid;
        let p = __mv.x != null ? { x: __mv.x, y: __mv.y } : findSpot(__mv.gid, it);
        if (!p) return '那个格子放不下这件货';
        const why = typeof placeMoved === 'function' ? placeMoved(it, __mv.gid, p.x, p.y) : placeItem(it, __mv.gid, p.x, p.y);
        renderAll(); return typeof why === 'string' ? why : null; })()`);
      if (err) throw new Error(err);
      return `move ${a.join(' ')}`;
    }
    case 'trash': {
      ctx.__uid = +a[0];
      const err = run(`(() => { const it = S.items[__uid]; if (!it) return '没有这件货'; if (S.scav && S.scav.pending === it.uid) S.scav.pending = null; destroyItem(it); __set('sel', null); renderAll(); return null; })()`);
      if (err) throw new Error(err);
      return `trash ${+a[0]}`;
    }
    default: throw new Error(`不认得的命令：${op}`);
  }
}

function replay() {
  if (!fs.existsSync(META)) throw new Error(`${dir} 还没开局：先 new <开局id>`);
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const ctx = boot(meta.seed);
  ctx.__meta = meta;
  vm.runInContext(`newGame(__meta.diff, __meta.start); enterGame(); showIntro();`, ctx);
  const log = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  for (const [i, l] of log.entries()) {
    const [op, ...a] = l.cmd.split(' ');
    try { act(ctx, l.cmd, null); }
    catch (e) { throw new Error(`重放第 ${i + 1} 条命令（${l.cmd}）出错：${e.message}——日志被改过，或游戏代码变了`); }
  }
  return { ctx, meta, log };
}

const status = ctx => vm.runInContext(`(() => ({ day: S.day, cap: __meta.cap, phase: S.phase, stones: S.stones, heat: S.heat, rentDue: S.rentDue, rent: rentAmount(), deed: deedPrice(),
  conds: condList('me').map(c => c.label), realm: realmName(), virtue: S.virtue, kills: S.stats.kills || 0,
  fate: S.fate ? { total: S.fate.total, erupted: S.fate.erupted, buried: S.fate.buried, busts: S.fate.busts, infamy: S.fate.infamy, pending: S.fate.debts.length } : null,
  over: S.over ? { win: S.over.win, title: S.over.title, text: S.over.text } : null }))()`, ctx);

try {
  if (rest[0] && rest[0].startsWith('new')) {
    const [, start, ...opt] = rest[0].split(/\s+/);
    const o = k => { const i = opt.indexOf(`--${k}`); return i >= 0 ? opt[i + 1] : null; };
    if (fs.existsSync(LOG) && fs.readFileSync(LOG, 'utf8').trim()) throw new Error(`${dir} 已经有一局在玩了`);
    fs.mkdirSync(dir, { recursive: true });
    const meta = { start, diff: o('diff') || 'normal', seed: +(o('seed') || Math.floor(Math.random() * 1e9)), cap: o('cap') ? +o('cap') : null, created: new Date().toISOString() };
    const probe = boot(meta.seed);
    if (!vm.runInContext(`STARTS.some(s => s.id === ${JSON.stringify(start)})`, probe)) throw new Error(`没有开局 ${start}：可选 ${vm.runInContext('STARTS.map(s => s.id).join(" ")', probe)}`);
    fs.writeFileSync(META, JSON.stringify(meta, null, 1)); fs.writeFileSync(LOG, '');
    rest.splice(0, 1, 'look');
  }
  const { ctx, log, meta } = replay();
  const capped = () => meta.cap && vm.runInContext('S.day', ctx) > meta.cap;
  let last = null;
  for (const cmd of rest.length ? rest : ['look']) {
    const live = screen(ctx);
    if (vm.runInContext('S && S.over', ctx) && !/^(look|status|history|tip)/.test(cmd)) throw new Error('这一局已经结束了');
    if (capped() && !/^(look|status|history|tip)/.test(cmd)) throw new Error(`测试只玩到第 ${meta.cap} 日，你已经撑过来了：停手，写汇报`);
    const rec = act(ctx, cmd, live);
    if (rec) { fs.appendFileSync(LOG, JSON.stringify({ cmd: rec, day: vm.runInContext('S.day', ctx), at: log.length + 1 }) + '\n'); log.push({ cmd: rec }); }
    last = { cmd, toasts: [...ctx.__toasts], confirms: [...ctx.__confirms] };
    if (cmd.startsWith('tip')) {
      ctx.__uid = +cmd.split(/\s+/)[1];
      console.log(vm.runInContext(`S.items[__uid] ? itemTip(S.items[__uid]) : '没有这件货'`, ctx).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      continue;
    }
    if (cmd === 'status') { console.log(JSON.stringify(status(ctx))); continue; }
    if (cmd === 'next') {
      // 连点没得选的画面，停在要拿主意的地方；点过的都照常记进日志
      const skipped = [];
      for (let k = 0; k < 40; k++) {
        const s = screen(ctx);
        if (vm.runInContext('S && S.over', ctx) || capped() || !noChoice(s)) break;
        const b = s.modalBtns[0];
        const head = s.text.split('【弹窗】\n')[1]?.split('\n')[0] || '';
        const rec = act(ctx, `click ${JSON.stringify(b)}`, null);
        fs.appendFileSync(LOG, JSON.stringify({ cmd: rec, day: vm.runInContext('S.day', ctx), at: log.length + 1 }) + '\n'); log.push({ cmd: rec });
        skipped.push(`${head}→${b.label}`);
        last.toasts.push(...ctx.__toasts);
      }
      if (skipped.length) last.toasts.unshift(`自动点过 ${skipped.length} 个没得选的画面：${skipped.join('；')}`);
      continue;
    }
    if (cmd.startsWith('history')) { const n = +(cmd.split(/\s+/)[1] || 20); console.log(log.slice(-n).map(l => l.cmd).join('\n') || '（还没有命令）'); continue; }
  }
  if (last && /^(tip|status|history)/.test(last.cmd)) process.exit(0);
  const s = screen(ctx);
  const msgs = [...(last ? last.confirms.map(c => `（确认：${c} → 是）`) : []), ...(last ? last.toasts : [])];
  if (msgs.length) console.log(`【提示】${msgs.join(' ｜ ')}\n`);
  console.log(s.text);
  const over = vm.runInContext('S && S.over', ctx);
  if (!over && capped()) console.log(`\n【测试上限】已撑过第 ${meta.cap} 日，测试到此为止：停手，写汇报`);
  if (over) console.log(`\n【结局】${over.title}：${stripTags(over.text)}\n（这一局结束了，第 ${vm.runInContext('S.day', ctx)} 日）`);
} catch (e) {
  console.error(`✗ ${e.message}`); if (process.env.PLAY_DEBUG) console.error(e.stack);
  process.exit(1);
}
