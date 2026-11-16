#!/usr/bin/env node
// 攻略 wiki：guide/src/*.md 是源文件，guide/*.md 是生成的攻略。数值、名称、配方一律从游戏代码里取，攻略与程序对账。
//   node tools/guide/guide.mjs build    生成 guide/*.md
//   node tools/guide/guide.mjs check    对账：源文件能否生成、生成结果与 guide/ 是否一致、引用是否都存在、代码里的东西是否都写进了攻略
//
// 源文件里的写法：
//   {{ 表达式 }}        在无界面载入的游戏里求值，插入结果。能用游戏的全部全局（CONDS、ITEMS、deedPrice()……），
//                       另有 T.xxx() 生成表格（tools/guide/tables.mjs）、pct()、sim()、fresh() 等帮手（见 HELPERS）
//   {{! 表达式 }}       断言：给正文里的定性说法配一个程序判定，为假就对账失败；不输出任何东西
//   [[类型:id]]         插入游戏里的正式名称，id 不存在就对账失败；类型见 tables.mjs 的 REFS（item、machine、cond、char……）
//   正文不许手写“数字＋单位”（3 天、50 灵石、10%）：数字要经 {{ }} 从代码里来，代码改了攻略跟着变
//
// 随机数按表达式播种：带模拟的数字每次生成都一样，只有它依赖的代码真的变了才会变。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { GAME, loadGame } from '../lib/headless.mjs';
import { REFS, COVER, tables } from './tables.mjs';

const SRC = path.join(GAME, 'guide/src'), OUT = path.join(GAME, 'guide');
const HEAD = name => `<!-- 本页由 tools/guide/guide.mjs 从 guide/src/${name} 生成，请勿手改：改源文件后运行 node tools/guide/guide.mjs build -->\n\n`;

// ───────────── 游戏 ─────────────

// 可播种的随机数：模拟出来的概率每次生成都一样
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0, 2166136261);

const ctx = loadGame([], { quiet: true });
if (ctx.__broken.length) { console.error(`✗ 游戏脚本载不进来：\n  ${ctx.__broken.join('\n  ')}`); process.exit(1); }
// G.xxx：从 node 这边读游戏的全局（const 声明的也读得到）
vm.runInContext('globalThis.G = new Proxy({}, { get: (_, k) => typeof k === "string" ? eval(k) : undefined });', ctx);
const G = ctx.G;

const seen = {};                       // 攻略里提到过的 { 类型: Set(id) }
const mark = (kind, id) => (seen[kind] = seen[kind] || new Set()).add(String(id));

// 插进表达式里的帮手
const HELPERS = {
  // 小数→百分比：pct(0.05) → '5%'
  pct: (x, digits = 0) => `${(x * 100).toFixed(digits).replace(/\.0+$/, '')}%`,
  // 新开一局（默认寻常难度、杂役学徒），返回 S
  fresh: (diff = 'normal', start = 'apprentice') => { G.newGame(diff, start); return G.S; },
  // 跑 n 次 fn，返回为真的比例；随机数已播种
  sim: (n, fn) => { let k = 0; for (let i = 0; i < n; i++) if (fn(i)) k++; return k / n; },
  // 名称：ref('item', 'vine_fruit') → 血藤果（与 [[item:vine_fruit]] 一样会记入覆盖）
  ref: (kind, id) => resolveRef(kind, id),
  // 列表连成顿号
  list: a => a.join('、'),
  T: null,
};

function resolveRef(kind, id) {
  const R = REFS[kind];
  if (!R) throw new Error(`没有 [[${kind}:…]] 这种引用（可用：${Object.keys(REFS).join('、')}）`);
  const name = R(G, id);
  if (name == null) throw new Error(`[[${kind}:${id}]] 在游戏里不存在`);
  mark(kind, id);
  return name;
}

HELPERS.T = tables({ G, mark, ref: resolveRef, ...HELPERS });
Object.assign(ctx, HELPERS);

// ───────────── 生成一页 ─────────────

// 找出一行里的 {{ … }}：按括号层数配对，表达式里的 {a: {b: 1}} 不会被当成结尾；字符串里的括号不算
function templates(line) {
  const out = [];
  for (let i = line.indexOf('{{'); i >= 0; i = line.indexOf('{{', i)) {
    let depth = 0, q = null, j = i + 2;
    for (; j < line.length; j++) {
      const c = line[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}') { if (depth === 0 && line[j + 1] === '}') break; depth--; }
    }
    if (j >= line.length) { out.push({ start: i, end: line.length, body: line.slice(i + 2), open: true }); break; }
    out.push({ start: i, end: j + 2, body: line.slice(i + 2, j) });
    i = j + 2;
  }
  return out;
}

// 手写的数字：阿拉伯数字连着单位。数字要从代码里来
// 汉字数字连着单位只提醒（“一位客人”“第三重”是说法，“退三成”才是规则）
const HARD_CN = /[两二三四五六七八九十半]+\s*(成|倍|天|日|夜|次|灵石)/;
const HARD_NUM = /(\d+(\.\d+)?\s*(灵石|天|日|夜|%|成|重|格|次|件|颗|倍|期|点))|(第\s*\d+\s*(日|天|期|夜))/;

function renderPage(file) {
  const name = path.basename(file), src = fs.readFileSync(file, 'utf8');
  const errs = [], warns = [];
  Math.random = seeded(hash(name));
  HELPERS.fresh();
  // 模板可以跨行（长表格的参数），所以整页一起找；行号按位置换算
  const lineAt = pos => src.slice(0, pos).split('\n').length;
  const tpl = templates(src);
  // 正文（去掉模板、引用、行内代码、链接地址后）不许手写数字
  let prose = src;
  for (const t of tpl.slice().reverse()) prose = prose.slice(0, t.start) + prose.slice(t.start, t.end).replace(/[^\n]/g, ' ') + prose.slice(t.end);
  prose.split('\n').forEach((line, i) => {
    const at = `guide/src/${name}:${i + 1}`, txt = line.replace(/\[\[[^\]]*\]\]|`[^`]*`|\]\([^)]*\)|<!--.*?-->/g, '');
    const m = txt.match(HARD_NUM);
    if (m) errs.push(`${at} 手写了数字“${m[0]}”：请改成 {{ }} 从代码里取`);
    const cn = txt.match(HARD_CN);
    if (cn) warns.push(`${at} 汉字写的数字“${cn[0]}”：若是规则里的数，请改成 {{ }} 从代码里取`);
  });
  let out = '', last = 0;
  for (const t of tpl) {
    const at = `guide/src/${name}:${lineAt(t.start)}`;
    out += src.slice(last, t.start); last = t.end;
    if (t.open) { errs.push(`${at} {{ 没有配对的 }}`); out += '？'; continue; }
    const assert = t.body.startsWith('!'), expr = assert ? t.body.slice(1) : t.body;
    // 每个表达式各自播种：改了一处规则，不相干的模拟数字不会跟着抖
    Math.random = seeded(hash(name + expr));
    try {
      const v = vm.runInContext(`(() => (${expr}))()`, ctx, { filename: at });
      if (assert) { if (!v) errs.push(`${at} 断言不成立：${expr.trim().slice(0, 120)}`); continue; }
      if (v == null || Number.isNaN(v)) { errs.push(`${at} {{${expr.trim().slice(0, 80)}}} 算出来是 ${v}`); out += '？'; continue; }
      out += typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
    } catch (e) { errs.push(`${at} {{${expr.trim().slice(0, 80)}}} 出错：${e.message}`); out += '？'; }
  }
  out += src.slice(last);
  // [[类型:id]]：在求值之后替换，表格里生成的不会再被替换；行号对源文件里的位置
  out = out.replace(/\[\[(\w+):([\w.-]+)\]\]/g, (all, kind, id) => {
    try { return resolveRef(kind, id); } catch (e) { errs.push(`guide/src/${name}:${lineAt(src.indexOf(all))} ${e.message}`); return '？'; }
  });
  // 站内链接要指到存在的页
  for (const [, target] of out.matchAll(/\]\(([^)#\s]+\.md)(#[^)]*)?\)/g))
    if (!fs.existsSync(path.join(SRC, target))) errs.push(`guide/src/${name} 链接到不存在的页 ${target}`);
  return { name, text: HEAD(name) + out.replace(/\n{3,}/g, '\n\n'), errs, warns };
}

// ───────────── 命令 ─────────────

function renderAll() {
  if (!fs.existsSync(SRC)) { console.error('✗ 没有 guide/src/'); process.exit(1); }
  const pages = fs.readdirSync(SRC).filter(f => f.endsWith('.md')).sort().map(f => renderPage(path.join(SRC, f)));
  const errs = pages.flatMap(p => p.errs), warns = pages.flatMap(p => p.warns);
  if (warns.length) console.warn(warns.map(w => `! ${w}`).join('\n'));
  // 反向对账：代码里有、攻略里没提到的
  for (const [kind, all] of Object.entries(COVER)) {
    const miss = all(G).filter(id => !(seen[kind] && seen[kind].has(String(id))));
    if (miss.length) errs.push(`攻略没提到这些${kind}：${miss.join('、')}（在某页用 [[${kind}:id]] 或表格写进去）`);
  }
  return { pages, errs };
}

const cmd = process.argv[2];
if (cmd === 'build' || cmd === 'check') {
  const { pages, errs } = renderAll();
  if (cmd === 'build') {
    fs.mkdirSync(OUT, { recursive: true });
    for (const p of pages) fs.writeFileSync(path.join(OUT, p.name), p.text);
    // 源文件删了的页，生成的也删掉
    for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.md')))
      if (!pages.some(p => p.name === f)) fs.rmSync(path.join(OUT, f));
    console.log(`生成 ${pages.length} 页到 guide/`);
  } else {
    for (const p of pages) {
      const f = path.join(OUT, p.name);
      if (!fs.existsSync(f)) errs.push(`guide/${p.name} 还没生成：运行 node tools/guide/guide.mjs build`);
      else if (fs.readFileSync(f, 'utf8') !== p.text) {
        // 列出头几处不同的行：攻略里写的 → 代码现在算出来的
        const a = fs.readFileSync(f, 'utf8').split('\n'), b = p.text.split('\n'), diff = [];
        for (let i = 0; i < Math.max(a.length, b.length) && diff.length < 3; i++)
          if (a[i] !== b[i]) diff.push(`    第 ${i + 1} 行\n      攻略：${(a[i] ?? '（无）').slice(0, 160)}\n      代码：${(b[i] ?? '（无）').slice(0, 160)}`);
        errs.push(`guide/${p.name} 与代码对不上（代码改了，或有人手改了生成的攻略）；运行 build 重新生成：\n${diff.join('\n')}`);
      }
    }
    for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(f => f.endsWith('.md')) : [])
      if (!pages.some(p => p.name === f)) errs.push(`guide/${f} 没有源文件 guide/src/${f}`);
  }
  if (errs.length) { console.error(errs.map(e => `✗ ${e}`).join('\n')); console.error(`\n${errs.length} 处对不上`); process.exit(1); }
  if (cmd === 'check') console.log(`✓ 攻略 ${pages.length} 页与程序一致`);
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n').replace(/^\/\/ ?/gm, ''));
}
