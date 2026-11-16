#!/usr/bin/env node
// 角色册工具：新建角色、生成立绘、检查故事线、列出可复用的面孔
//   node tools/cast/cast.mjs faces                     列出所有现成面孔（男女、是否被占用、神态是否齐全）
//   node tools/cast/cast.mjs list                      列出角色册里的角色
//   node tools/cast/cast.mjs new <id> --name 名字 --faction ren|mo|xian|yao --sex m|f --title 称谓 (--reuse 面孔 | --art "英文画面描述")
//   node tools/cast/cast.mjs art <id> [--jobs 4] [--redo [wasted,angry]]   按 art 描述生成底图与六种神态（gpt-image）再转成游戏用图；--redo 重画（可只重画某几种神态）
//   node tools/cast/cast.mjs check [id] [--days 150] [--runs 6]   检查故事线：穷举抉择、找断链与死节点；再模拟实战看能否登场、走完
//   node tools/cast/cast.mjs ready [id] [--remote|--remote-only] [--no-browser] [--quiet]   上线检查：登记、立绘与图片清单、故事、文字、全员同场登场、真浏览器渲染、线上比对
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadGame as loadGameShared } from '../lib/headless.mjs';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX = path.join(GAME, 'index.html');
const MOODS = ['neutral', 'pleased', 'angry', 'afraid', 'sly', 'wasted', 'thrall'];
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(`--${k}`);

// ───────────── 载入游戏（无界面） ─────────────

// 无界面载入游戏：与货品册工具共用（逐个脚本执行，个别脚本坏了只跳过并报出）
const loadGame = () => loadGameShared(['CAST', 'STORIES', 'PORTRAITS', 'FACE_SEX', 'STORY_FACES', 'RESERVED_FACES', 'ART_SET', 'OFFICIALS']);

const artHas = name => fs.existsSync(path.join(GAME, 'assets/chars', `${name}.webp`));

// ───────────── faces / list ─────────────

function faces() {
  const g = loadGame(), G = g.__G;
  const all = fs.readdirSync(path.join(GAME, 'assets/chars')).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5))
    .filter(n => !MOODS.slice(1).some(m => n.endsWith(`_${m}`)));
  const taken = {};
  for (const def of Object.values(G.CAST)) taken[def.portrait] = `角色·${def.name}`;
  for (const st of Object.values(G.STORIES)) if (st.person && !G.CAST[st.person.pid]) taken[st.person.portrait] = `故事·${st.person.name}`;
  for (const o of Object.values(G.OFFICIALS)) taken[o.portrait] = taken[o.portrait] || `官差·${o.name}`;
  Object.assign(taken, { steward_sun: '故事·孙管事', beggar_master: '故事·血手陈枭', amu_disciple: '故事·阿木（入门后）', broker: '鬼市牙人' });
  const generic = new Set(Object.values(G.PORTRAITS).flat().map(([k]) => k));
  console.log('面孔'.padEnd(22), '性别', '神态', '用途');
  for (const n of all.sort()) {
    const base = n.replace(/_f\d$/, ''), moods = MOODS.filter(m => artHas(m === 'neutral' ? n : `${n}_${m}`)).length;
    const use = taken[n] || (generic.has(base) ? (G.STORY_FACES.has(n) ? '路人身份（底图被故事占用）' : `路人·${base}`) : '');
    console.log(n.padEnd(22), (G.FACE_SEX[n] === 'f' ? '女' : '男').padEnd(3), `${moods}/7`.padEnd(4), use);
  }
}

function list() {
  const g = loadGame(), G = g.__G;
  const defs = Object.values(G.CAST);
  if (!defs.length) return console.log('角色册是空的。用 new 新建一个。');
  for (const d of defs) {
    const moods = MOODS.filter(m => artHas(m === 'neutral' ? d.portrait : `${d.portrait}_${m}`)).length;
    console.log(`${d.id.padEnd(14)} ${d.name}（${d.title}，${d.sex === 'f' ? '女' : '男'}）立绘 ${d.portrait} ${moods}/7 · 节点 ${Object.keys(d.nodes).length} · 第 ${d.start.day || 1} 日起${d.regular ? ' · 也当熟客' : ''}`);
  }
}

// ───────────── new：生成可运行的角色文件 ─────────────

function registerScript(id) {
  let html = fs.readFileSync(INDEX, 'utf8');
  const tag = `<script src="js/cast/${id}.js"></script>`;
  if (html.includes(tag)) return;
  html = html.replace('<!-- cast:end -->', `${tag}\n<!-- cast:end -->`);
  fs.writeFileSync(INDEX, html);
}

function scaffold(id) {
  if (!/^[a-z][a-z0-9_]*$/.test(id || '')) throw new Error('id 只能用小写字母、数字、下划线，且以字母开头');
  const file = path.join(GAME, 'js/cast', `${id}.js`);
  if (fs.existsSync(file)) throw new Error(`${file} 已存在`);
  const name = opt('name'), faction = opt('faction'), sex = opt('sex'), title = opt('title');
  if (!name || !['ren', 'mo', 'xian', 'yao'].includes(faction) || !['m', 'f'].includes(sex) || !title) throw new Error('要 --name、--faction ren|mo|xian|yao、--sex m|f、--title');
  const reuse = opt('reuse'), art = opt('art');
  if (!reuse && !art) throw new Error('要 --reuse <面孔>（复用现成立绘）或 --art "英文画面描述"（新画）');
  if (reuse && !artHas(reuse)) throw new Error(`没有现成面孔 ${reuse}；先用 faces 看看有哪些`);
  const ta = sex === 'f' ? '她' : '他';
  const src = `// ${name}：${title}。TODO 一句话写清这个人与这条故事线
'use strict';

defineCharacter({
  id: '${id}', name: '${name}', faction: '${faction}', sex: '${sex}', title: '${title}',
  portrait: '${reuse || id}',${art ? `\n  art: ${JSON.stringify(art)},` : ''}
  bio: 'TODO 人物小传（「人物」页显示）',
  intro: 'TODO 故事摘要的开头（「人物」页显示）',
  savvy: 0.5, power: 25,
  traits: { greed: 0.5, integrity: 0.3 },
  start: { day: 5, node: 'meet', chance: 0.5 },
  regular: true,

  nodes: {
    meet: {
      when: 'day',
      text: () => 'TODO ${name}第一次进门时的处境与开场白。',
      choices: () => [
        { label: 'TODO 帮${ta}', hint: costHint(50), req: needStones(50), run: (st, p) => {
          spend(50, '帮了${name}。'); goodDeed(p, 2);
          remember(p, '你帮了${ta}。', 15, 'helped');
          return { text: 'TODO 结果', go: ['turn', [3, 5]], summary: '你帮了${ta}。' };
        } },
        { label: 'TODO 利用${ta}', hint: '+80 灵石；${ta}会记恨', run: (st, p) => {
          earn(80, '利用了${name}。'); st.flags.used = true;
          remember(p, '你利用了${ta}。', -30, 'betrayed');
          return { text: 'TODO 结果', go: ['turn', [3, 5]], summary: '你利用了${ta}。' };
        } },
      ],
    },
    turn: {
      when: 'night',
      cond: (st, p) => p.status === 'alive',
      text: st => st.flags.used ? 'TODO 被利用之后的转折' : 'TODO 受了恩惠之后的转折',
      choices: st => [
        { label: 'TODO 收尾', run: (st, p) => ({ text: 'TODO 结局', end: true, summary: 'TODO 结局摘要' }) },
      ],
    },
  },
});
`;
  fs.writeFileSync(file, src);
  registerScript(id);
  console.log(`已建 ${path.relative(GAME, file)}，并登记到 index.html。把 TODO 换成真正的故事，再跑 check ${id}${art ? `；立绘用 art ${id} 生成` : ''}。`);
}

// ───────────── art：生成底图与神态 ─────────────

function artJobs(def) {
  const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(GAME, 'tools/art'))}); from specs import PORTRAIT_PREFIX, MOODS; print(json.dumps({'p': PORTRAIT_PREFIX, 'm': MOODS}))`;
  const { p, m } = JSON.parse(execFileSync('python3', ['-c', py]).toString());
  const sexWord = def.sex === 'f' ? 'a woman (actress)' : 'a man (actor)';
  const base = `raw/chars/${def.portrait}.png`;
  const jobs = [{ id: `char:${def.portrait}`, mood: 'neutral', prompt: p.replace('{d}', `${sexWord}: ${def.art}, neutral calm expression`), out: base, size: '1024x1536', quality: 'high', background: 'transparent' }];
  for (const [k, c] of Object.entries(m)) {
    jobs.push({ id: `char:${def.portrait}_${k}`, mood: k, refs: [base], out: `raw/chars/${def.portrait}_${k}.png`, size: '1024x1536', quality: 'high', background: 'transparent',
      prompt: `Same actor, same costume, same framing, same camera angle and lighting, same style. Only change this: the facial expression and state: ${c}. Keep the transparent background.` });
  }
  return jobs;
}

function makeArt(id) {
  const g = loadGame(), def = g.__G.CAST[id];
  if (!def) throw new Error(`角色册里没有 ${id}`);
  if (!def.art) throw new Error(`${id} 复用现成立绘 ${def.portrait}，不需要生图（要新画就给它写 art 描述，并把 portrait 改成新名字）`);
  if (def.artProvider === 'bailian' && def.ecologyBatch === 'qwen3pro55') {
    if (flag('redo')) throw new Error('Qwen 角色不自动删除成图；先检查并归档该图及完成记录，避免未决请求重复计费。');
    console.log(`按角色记录使用百炼 ${def.artModel}；不调用 GPT-image。`);
    for (const phase of ['bases', 'variants', 'preview', 'install']) {
      const r = spawnSync('python3', [path.join(GAME, 'tools/cast/qwen_batch.py'), '--phase', phase,
        '--ids', id, '--jobs', opt('jobs', '4')], { stdio: 'inherit', env: process.env });
      if (r.status !== 0) throw new Error(`Qwen ${phase} 阶段失败，已保留断点；请先检查日志。`);
    }
    return;
  }
  const jobs = artJobs(def), artDir = path.join(GAME, 'art');
  // --redo 重画全部；--redo wasted,angry 只重画这几种神态（底图写 neutral）
  if (flag('redo')) {
    const which = (opt('redo') || '').startsWith('--') || !opt('redo') ? null : opt('redo').split(',');
    jobs.filter(j => !which || which.includes(j.mood))
      .forEach(j => { for (const f of [path.join(artDir, j.out), path.join(GAME, 'assets/chars', path.basename(j.out, '.png') + '.webp')]) fs.rmSync(f, { force: true }); });
  }
  fs.mkdirSync(artDir, { recursive: true });
  const manifest = path.join(artDir, `cast_${id}.json`);
  fs.writeFileSync(manifest, JSON.stringify(jobs, null, 0));
  const script = path.join(process.env.HOME, '.codex/skills/gpt-image/scripts/gpt_image.py');
  console.log(`生成 ${jobs.length} 张：${def.portrait} 底图 + 六种神态（清单 art/cast_${id}.json）`);
  const r = spawnSync('python3', [script, 'batch', manifest, '--jobs', opt('jobs', '4')], { stdio: 'inherit', env: process.env });
  spawnSync('python3', [path.join(GAME, 'tools/art/postprocess.py')], { stdio: 'inherit' });
  const missing = MOODS.filter(m => !artHas(m === 'neutral' ? def.portrait : `${def.portrait}_${m}`));
  console.log(missing.length ? `还缺：${missing.join('、')}（再跑一次 art ${id} 会续上）` : '立绘齐了。打开联系表或进游戏看看效果。');
  if (r.status && missing.length) process.exit(1);
}

// ───────────── check：穷举故事线 + 模拟实战 ─────────────

// opts.live=false 时跳过单人实战模拟（上线检查改用全员同场模拟）；texts 收集渲染出的文字供上线检查查错字、代词
function checkOne(g, def, report, { live: doLive = true } = {}) {
  const errs = [], warns = [], texts = [];
  const nodes = Object.keys(def.nodes), reached = new Set(), endings = new Map();
  // 静态检查
  if (!['m', 'f'].includes(def.sex)) errs.push('sex 必须是 m 或 f');
  const missingArt = MOODS.filter(m => !artHas(m === 'neutral' ? def.portrait : `${def.portrait}_${m}`));
  if (missingArt.length === 7) errs.push(`没有立绘 ${def.portrait}（复用现成面孔，或 art ${def.id} 生成）`);
  else if (missingArt.length) warns.push(`立绘缺神态：${missingArt.join('、')}（缺的神态会退回底图）`);
  if (def.sexConflict) errs.push(`立绘 ${def.portrait} 是${def.sexConflict === 'f' ? '女' : '男'}的，角色却是${def.sex === 'f' ? '女' : '男'}的`);
  for (const [k, n] of Object.entries(def.nodes)) {
    if (!['day', 'night'].includes(n.when)) errs.push(`节点 ${k} 的 when 必须是 day 或 night`);
    if (typeof n.text !== 'function' || typeof n.choices !== 'function') errs.push(`节点 ${k} 的 text 与 choices 都要写成函数`);
  }
  // 穷举：每个状态下把每个可选的抉择都走一遍（随机结果多试几次）
  const run = code => vm.runInContext(code, g);
  g.__def = def;
  run(`newGame('normal', 'apprentice'); S.stones = 99999; S.cult.lv = 3;
    for (const k of ['yao_core','pill_found','soul_pearl','herb_blood','spirit_wine','sword_std','jade_pendant']) giveItem(k);
    startStory(__def.id, __def.id, __def.start.node || Object.keys(__def.nodes)[0], 0);
    Object.assign(S.people[__def.id], __def.traits || {}); S.people[__def.id].sex = __def.sex;`);
  const queue = [{ snap: run('JSON.stringify(S)'), path: [] }], seen = new Set();
  let states = 0;
  while (queue.length && states < 4000) {
    const { snap, path: trail } = queue.shift();
    g.__snap = snap;
    run('S = JSON.parse(__snap)');
    const st = run('S.story[__def.id]');
    if (st.done) { endings.set(st.summary || '（无摘要）', trail.join(' → ')); continue; }
    const key = st.node + JSON.stringify(st.flags) + run(`S.people[__def.id].status + Math.round(S.people[__def.id].aff / 20)`);
    if (seen.has(key) || trail.length > 24) continue;
    seen.add(key); states++;
    reached.add(st.node);
    let chs;
    try {
      const txt = run(`String(storyNode(S.story[__def.id]).text(S.story[__def.id], storyPerson(S.story[__def.id])))`);
      if (!txt.trim() || /TODO/.test(txt)) warns.push(`节点 ${st.node} 的文字还是空的或 TODO`);
      texts.push({ node: st.node, by: def.nodes[st.node].who ? 'other' : 'self', text: txt });
      chs = run(`storyNode(S.story[__def.id]).choices(S.story[__def.id], storyPerson(S.story[__def.id])).map((c, i) => ({ i, label: c.label, hint: c.hint, why: choiceState(c, S.story[__def.id], storyPerson(S.story[__def.id])) }))`);
    } catch (e) { errs.push(`节点 ${st.node}（${trail.join(' → ') || '开头'}）出错：${e.message}`); continue; }
    if (!chs.length) { errs.push(`节点 ${st.node} 没有任何抉择（死节点）`); continue; }
    for (const c of chs) {
      if (/TODO/.test(c.label + (c.hint || ''))) warns.push(`节点 ${st.node} 的抉择“${c.label}”还是 TODO`);
      if (c.why) continue;
      for (let t = 0; t < 3; t++) {
        g.__snap = snap; g.__i = c.i;
        run('S = JSON.parse(__snap)');
        try {
          const before = run('S.story[__def.id].node');
          const res = run('resolveChoice(__def.id, __i)');
          const after = run('S.story[__def.id]');
          if (res.go && !def.nodes[res.go[0]]) { errs.push(`节点 ${before} 的“${c.label}”跳到不存在的节点 ${res.go[0]}`); break; }
          if (!res.go && !res.end) warns.push(`节点 ${before} 的“${c.label}”既不跳转也不结束（第二天会原样再来）`);
          if (!res.text) warns.push(`节点 ${before} 的“${c.label}”没有结果文字`);
          if (/TODO/.test(res.text || '')) warns.push(`节点 ${before} 的“${c.label}”结果还是 TODO`);
          texts.push({ node: before, by: def.nodes[before].who ? 'other' : 'self', text: `${c.label}｜${c.hint || ''}｜${res.text || ''}｜${res.summary || ''}` });
          queue.push({ snap: run('JSON.stringify(S)'), path: [...trail, `${before}:${c.label}`] });
          if (after.done) break;
        } catch (e) { errs.push(`节点 ${st.node} 的“${c.label}”出错：${e.message}`); break; }
      }
    }
  }
  // 状态判定：哪些节点会看人身上的伤、毒、境界；再让一个带伤中毒的你、一个无伤的你各走一遍，看结局分布变不变
  const STATE_RE = /\b(judge|trial|judgeOdds|condSev|hasCond|condList|condPenalty|condText|fightRoll|lieCaught|hideRoll|addCond|cureCond|strongEnough|realmName|cultGap|npcLevel|S\.cult)\b/;
  const aware = nodes.filter(n => { const nd = def.nodes[n]; return STATE_RE.test(String(nd.text) + String(nd.choices) + String(nd.cond || '')); });
  const hooks = Object.values(def.on || {}).some(f => STATE_RE.test(String(f)));
  if (!aware.length && !hooks) warns.push('故事不看任何状态：带伤、中毒、修为高低走出来都一样（用 judge / trial / condSev / fightRoll 等给关键抉择分出结果，见 reference/state.md）');
  report.stateAware = aware;
  const outcomes = preset => {
    const tally = {};
    for (let i = 0; i < 40; i++) {
      g.__preset = preset;
      run(`(() => { newGame('normal', 'apprentice'); S.stones = 99999;
        for (const k of ['yao_core','pill_found','soul_pearl','herb_blood','spirit_wine','sword_std','jade_pendant','pill_qi','pill_qi','pill_blood']) giveItem(k);
        if (__preset === 'hurt') { addCond('me', 'injured', 2); addCond('me', 'poisoned', 1); }
        if (__preset === 'strong') S.cult.lv = 3;
        startStory(__def.id, __def.id, __def.start.node || Object.keys(__def.nodes)[0], 0);
        Object.assign(S.people[__def.id], __def.traits || {}); S.people[__def.id].sex = __def.sex;
        for (let k = 0; k < 30 && !S.story[__def.id].done; k++) {
          const st = S.story[__def.id], n = storyNode(st), p = storyPerson(st);
          const ch = n.choices(st, p); const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p));
          if (!ok.length) break;
          resolveChoice(__def.id, ok[Math.floor(Math.random() * ok.length)]);
          S.day = Math.max(S.day, S.story[__def.id].due);
        }
      })()`);
      const sum = run('S.story[__def.id].done ? (S.story[__def.id].summary || \'（无摘要）\') : \'（未完）\'');
      tally[sum] = (tally[sum] || 0) + 1;
    }
    return tally;
  };
  try { report.byState = { 带伤中毒: outcomes('hurt'), 无伤: outcomes('fine'), 金丹: outcomes('strong') }; } catch (e) { warns.push(`按状态重放时出错：${e.message}`); }

  const unreached = nodes.filter(n => !reached.has(n));
  if (unreached.length) warns.push(`走不到的节点：${unreached.join('、')}（若靠 on 钩子用 jump 跳入，可忽略）`);
  if (!endings.size) errs.push('没有任何一条路走到结局（end: true）');

  // 模拟实战：从新开一局开始，看角色会不会登场、走完
  // 至少要跑到登场日之后五十天，否则晚登场的人物会被误判为“没登场”
  // 模拟玩家乱选抉择，钱、关注、性命、恶名都替他兜着（每天补满护身符、清掉恶名），免得局早早结束、扩展人物不再登场
  const days = Math.max(+opt('days', 150), (def.start.day || 1) + 50), runs = doLive ? +opt('runs', 6) : 0, live = [];
  for (let r = 0; r < runs; r++) {
    run(`newGame('normal', 'apprentice'); S.stones = 5000; var __log = { start: null, visits: 0, beats: 0, end: null, regular: 0 };
      for (let d = 0; d < ${days} && !S.over; d++) {
        S.flags.savior = 9; if (S.fate) S.fate.infamy = 0; openShop(); if (S.story[__def.id] && __log.start == null) __log.start = S.day;
        let c, g = 0;
        while ((c = nextCustomer()) && g++ < 40) {
          if (c.kind === 'story') { const st = S.story[c.key], n = storyNode(st), p = storyPerson(st); const ch = n.choices(st, p); const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p));
            if (c.key === __def.id) __log.beats++; if (ok.length) resolveChoice(c.key, pick(ok)); }
          else if (c.pid === __def.id) __log.regular++;
          if (c.kind === 'inspect') runInspection(0);
          if (S.customer) dismissCustomer(false); if (S.over) break; }
        if (S.over) break;
        closeShop();
        for (const k of dueStories('night')) { const st = S.story[k], n = storyNode(st), p = storyPerson(st); const ch = n.choices(st, p); const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p));
          if (k === __def.id) __log.beats++; if (ok.length) resolveChoice(k, pick(ok)); }
        nightResolve(); S.stones = Math.max(S.stones, rentAmount() + 1000); S.heat = Math.min(S.heat, 60);
        if (S.story[__def.id] && S.story[__def.id].done && __log.end == null) { __log.end = S.day; __log.summary = S.story[__def.id].summary; }
      }`);
    live.push(run('__log'));
  }
  const started = live.filter(l => l.start != null);
  if (doLive && !started.length) errs.push(`模拟 ${runs} 局、每局 ${days} 天，一次都没登场（看看 start 的 day / cond / chance）`);
  else if (doLive && started.length < runs / 2) warns.push(`模拟 ${runs} 局只登场 ${started.length} 局：登场条件偏严，或同批人物太多排不上`);
  const finished = live.filter(l => l.end != null);
  report.push({ def, errs: [...new Set(errs)], warns: [...new Set(warns)], nodes, reached, endings, live, started, finished, states, stateAware: report.stateAware, byState: report.byState, texts });
}

function check(id) {
  const g = loadGame(), defs = id ? [g.__G.CAST[id]] : Object.values(g.__G.CAST);
  if (id && !defs[0]) throw new Error(`角色册里没有 ${id}`);
  if (!defs.length) return console.log('角色册是空的。');
  const report = [];
  for (const def of defs) checkOne(loadGame(), def, report);
  let bad = 0;
  for (const r of report) {
    const d = r.def;
    console.log(`\n■ ${d.name}（${d.id}）  节点 ${r.reached.size}/${r.nodes.length} 走得到 · 状态 ${r.states} · 结局 ${r.endings.size} 种`);
    for (const [s, p] of r.endings) console.log(`  结局：${s}\n        ${p}`);
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '—';
    console.log(`  实战 ${r.live.length} 局：登场 ${r.started.length} 局（平均第 ${avg(r.started.map(l => l.start))} 日）· 走完 ${r.finished.length} 局（平均第 ${avg(r.finished.map(l => l.end))} 日）· 剧情来访 ${avg(r.live.map(l => l.beats))} 次 · 熟客来访 ${avg(r.live.map(l => l.regular))} 次`);
    if (r.stateAware && r.stateAware.length) console.log(`  看状态的节点：${r.stateAware.join('、')}`);
    if (r.byState) {
      const keys = [...new Set(Object.values(r.byState).flatMap(Object.keys))];
      console.log('  按你的状态随机走 40 遍，各结局次数（带伤中毒 / 无伤 / 金丹）：');
      for (const k of keys) console.log(`    ${String(r.byState.带伤中毒[k] || 0).padStart(2)} / ${String(r.byState.无伤[k] || 0).padStart(2)} / ${String(r.byState.金丹[k] || 0).padStart(2)}  ${k}`);
    }
    for (const e of r.errs) console.log(`  ✗ ${e}`);
    for (const w of r.warns) console.log(`  ! ${w}`);
    if (!r.errs.length) console.log('  ✓ 没有错误');
    bad += r.errs.length;
  }
  process.exit(bad ? 1 : 0);
}

// ───────────── ready：上线检查 ─────────────
// 逐项判定一个人物能不能真的上线：文件与登记、立绘与图片清单、故事、文字、全员同场的登场模拟、真浏览器渲染、线上比对。
// 任何一项 ✗ 都不算就绪；退出码非零，部署脚本据此拦下。

const MOOD_KEYS = MOODS;
const LINE_VARS = { cat: '丹药', item: '回气丹', ask: 70 };
const LINE_KEYS = ['first', 'hostile', 'cold', 'neutral', 'warm', 'close', 'buy', 'sell', 'attracted'];

function webpOk(file) {
  if (!fs.existsSync(file)) return '缺文件';
  const b = fs.readFileSync(file);
  if (b.length < 3000) return `只有 ${b.length} 字节`;
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return '不是 webp';
  return null;
}

// 全员同场：所有人物一起抢登场名额、抢每天两个故事来客的位子
function popSim(ids, runs, days) {
  const g = loadGame();
  g.__ids = ids;
  return vm.runInContext(`(() => {
    const tally = {}; for (const id of __ids) tally[id] = { runs: 0, first: [], done: 0, beats: 0, errors: [] };
    // 某个人物的抉择出错，记在他名下，别拖垮整场模拟
    const choose = (key, i) => { try { resolveChoice(key, i); } catch (e) { const t = tally[key]; if (t && t.errors.length < 3) t.errors.push(S.story[key].node + '：' + e.message); if (S.story[key]) S.story[key].done = true; } };
    for (let r = 0; r < ${runs}; r++) {
      newGame('normal', 'apprentice'); S.stones = 5000;
      const seen = {};
      for (let d = 0; d < ${days} && !S.over; d++) {
        S.flags.savior = 9; if (S.fate) S.fate.infamy = 0; openShop(); let c, k = 0;
        while ((c = nextCustomer()) && k++ < 40) {
          if (c.kind === 'story') { if (tally[c.key]) { tally[c.key].beats++; if (!seen[c.key]) { seen[c.key] = S.day; } }
            const st = S.story[c.key], n = storyNode(st), p = storyPerson(st); let ch = []; try { ch = n.choices(st, p); } catch (e) { if (tally[c.key]) tally[c.key].errors.push(st.node + '：' + e.message); st.done = true; }
            const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p)); if (ok.length) choose(c.key, pick(ok)); }
          if (c.kind === 'inspect') runInspection(0); if (S.customer) dismissCustomer(false); if (S.over) break; }
        if (S.over) break;
        closeShop();
        for (const k2 of dueStories('night')) { if (tally[k2]) { tally[k2].beats++; if (!seen[k2]) seen[k2] = S.day; }
          const st = S.story[k2], n = storyNode(st), p = storyPerson(st); let ch = []; try { ch = n.choices(st, p); } catch (e) { if (tally[k2]) tally[k2].errors.push(st.node + '：' + e.message); st.done = true; }
          const ok = ch.map((x, i) => i).filter(i => !choiceState(ch[i], st, p)); if (ok.length) choose(k2, pick(ok)); }
        nightResolve(); S.stones = Math.max(S.stones, rentAmount() + 1000); S.heat = Math.min(S.heat, 60);
      }
      for (const id of __ids) { if (seen[id]) { tally[id].runs++; tally[id].first.push(seen[id]); } if (S.story[id] && S.story[id].done) tally[id].done++; }
    }
    return tally;
  })()`, g);
}

// 真浏览器：来客站在柜台前、故事对话框、人物页卡片、七种神态图都要真的显示出来
async function browserCheck(ids) {
  const { browserRun } = await import('../lib/launch.mjs');
  return browserRun(`
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const loaded = async img => { if (!img) return false; for (let i = 0; i < 60 && !img.complete; i++) await wait(100); return img.complete && img.naturalWidth > 0; };
    const out = {}; let first = true;
    for (const id of ${JSON.stringify(ids)}) {
      const r = out[id] = {};
      try {
        newGame('normal', 'apprentice'); if (first) { enterGame(); first = false; } S.stones = 99999;
        const def = CAST[id]; S.day = Math.max(S.day, def.start.day || 1);
        startStory(id, id, def.start.node || Object.keys(def.nodes)[0], 0);
        const p = S.people[id]; Object.assign(p, def.traits || {}); p.sex = def.sex;
        S.phase = 'day'; S.customer = storyVisitor(id); renderAll();
        const por = document.querySelector('#portrait');
        r.scene = await loaded(por); r.sceneSrc = por.getAttribute('src');
        openStory(id, () => {});
        const sp = document.querySelector('.st-portrait img');
        r.dialog = await loaded(sp); r.dialogSrc = sp && sp.getAttribute('src');
        r.text = ((document.querySelector('.st-text') || {}).textContent || '').trim().length;
        r.buttons = document.querySelectorAll('.st-choice').length;
        closeModal(); S.customer = null; p.visits = Math.max(1, p.visits); tab = 'people'; renderAll();
        const card = document.querySelector('.pcard[data-pid="' + id + '"]');
        r.card = !!card && await loaded(card.querySelector('img'));
        r.moods = {};
        for (const m of ${JSON.stringify(MOOD_KEYS)}) {
          const want = m === 'neutral' ? faceOf(p) + '.webp' : faceOf(p) + '_' + m + '.webp';
          const im = new Image(); im.src = asset('chars', faceOf(p) + '~' + m);
          r.moods[m] = await im.decode().then(() => im.src.endsWith(want), () => false);
        }
      } catch (e) { r.err = String(e && e.message || e); }
    }
    return out;`, { timeout: Math.max(60000, ids.length * 4000) });
}

async function ready(only) {
  const doBrowser = !flag('no-browser'), doRemote = flag('remote') || flag('remote-only'), localOnly = !flag('remote-only');
  const g = loadGame();
  const G = g.__G;
  const html = fs.readFileSync(INDEX, 'utf8');
  const scriptList = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const artList = new Set(G.ART_SET);
  const defs = only ? [G.CAST[only]] : Object.values(G.CAST);
  if (only && !defs[0]) {
    const f = path.join(GAME, 'js/cast', `${only}.js`);
    console.log(`✗ ${only} 没有载入：${fs.existsSync(f) ? (scriptList.includes(`js/cast/${only}.js`) ? `脚本出错（${(g.__broken.find(b => b.includes(only)) || '').slice(0, 160)}）` : '文件在，但没登记到 index.html') : '没有 js/cast/' + only + '.js'}`);
    process.exit(1);
  }
  const res = {};
  const mark = (id, ok, gate, msg) => { (res[id] = res[id] || []).push({ ok, gate, msg }); };

  // 全局：js/cast 下没登记的文件、载不进来的脚本
  const castFiles = fs.readdirSync(path.join(GAME, 'js/cast')).filter(f => f.endsWith('.js'));
  const orphans = castFiles.filter(f => !scriptList.includes(`js/cast/${f}`));
  const broken = g.__broken || [];

  if (localOnly) {
    // 同名、撞脸
    const names = {}, faces = {};
    // 角色册的人物会以同名 id 登记一个故事，那是它自己，不算撞名撞脸
    for (const [k, st] of Object.entries(G.STORIES)) if (st.person && !G.CAST[k]) {
      names[st.person.name] = (names[st.person.name] || []).concat(`故事·${st.person.pid}`);
      faces[st.person.portrait] = (faces[st.person.portrait] || []).concat(`故事·${st.person.pid}`);
    }
    for (const o of Object.values(G.OFFICIALS)) { names[o.name] = (names[o.name] || []).concat('官差'); faces[o.portrait] = (faces[o.portrait] || []).concat(`官差·${o.name}`); }
    for (const d of Object.values(G.CAST)) names[d.name] = (names[d.name] || []).concat(d.id);
    const castPos = scriptList.indexOf('js/cast.js'), ecoPos = scriptList.indexOf('js/cast-ecology.js'), lookPos = scriptList.indexOf('js/look.js');
    const begin = html.indexOf('<!-- cast:begin'), end = html.indexOf('<!-- cast:end');

    const pops = popSim(defs.map(d => d.id), +opt('runs', 3), +opt('days', 100));

    for (const def of defs) {
      const id = def.id, file = `js/cast/${id}.js`, abs = path.join(GAME, file);
      // 1 文件与登记
      const errs1 = [];
      if (!fs.existsSync(abs)) errs1.push(`文件应为 ${file}`);
      const pos = scriptList.indexOf(file), tagAt = html.indexOf(`<script src="${file}">`);
      if (pos < 0) errs1.push('没登记到 index.html');
      else {
        if (pos < castPos) errs1.push('登记在 js/cast.js 之前');
        const src = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
        if (/ecologyCharacter\(/.test(src) && pos < ecoPos) errs1.push('用了 ecologyCharacter，却登记在 js/cast-ecology.js 之前');
        if (lookPos >= 0 && pos > lookPos) errs1.push('登记在 js/look.js 之后');
        if (begin >= 0 && (tagAt < begin || tagAt > end)) errs1.push('不在 <!-- cast:begin --> 与 <!-- cast:end --> 之间');
        if (/TODO/.test(src)) errs1.push('文件里还有 TODO');
      }
      const dupName = (names[def.name] || []).filter(x => x !== id);
      if (dupName.length) errs1.push(`名字“${def.name}”与 ${dupName.join('、')} 重了`);
      const otherFace = Object.values(G.CAST).filter(d => d.id !== id && d.portrait === def.portrait).map(d => d.id).concat(faces[def.portrait] || []);
      if (otherFace.length) errs1.push(`立绘 ${def.portrait} 已被 ${otherFace.join('、')} 用了`);
      mark(id, !errs1.length, '文件与登记', errs1.join('；') || `${file} 已登记，载入无误`);

      // 2 立绘：七张都在、是真的 webp、在浏览器用的图片清单里
      const errs2 = [];
      for (const m of MOOD_KEYS) {
        const name = m === 'neutral' ? def.portrait : `${def.portrait}_${m}`;
        const bad = webpOk(path.join(GAME, 'assets/chars', `${name}.webp`));
        if (bad) errs2.push(`${name}：${bad}`);
        else if (!artList.has(`chars/${name}`)) errs2.push(`${name} 不在 assets/art.js 里（浏览器会当它不存在；跑 python3 tools/art/postprocess.py）`);
      }
      if (def.sexConflict) errs2.push(`立绘 ${def.portrait} 画的是${def.sexConflict === 'f' ? '女' : '男'}人，人物却是${def.sex === 'f' ? '女' : '男'}的`);
      mark(id, !errs2.length, '立绘', errs2.join('；') || `${def.portrait} 七种神态齐全，已入图片清单`);

      // 3 故事（穷举）与状态
      const rep = [];
      checkOne(loadGame(), def, rep, { live: false });
      const r = rep[0];
      const errs3 = r.errs.slice(), notes3 = [];
      if (!r.stateAware || !r.stateAware.length) errs3.push('没有一个节点看状态（受伤、中毒、修为）——见 reference/state.md');
      if (r.byState) {
        const keys = Object.keys(Object.assign({}, ...Object.values(r.byState)));
        const same = keys.every(k => Object.values(r.byState).every(t => Math.abs((t[k] || 0) - (r.byState.无伤[k] || 0)) <= 2));
        if (same) notes3.push('三种状态下结局分布几乎一样');
      }
      for (const w of r.warns.filter(w => /TODO|空的/.test(w))) errs3.push(w);
      mark(id, !errs3.length, '故事', errs3.join('；') || `${r.reached.size}/${r.nodes.length} 节点走得到，${r.endings.size} 种结局，看状态的节点：${r.stateAware.join('、')}${notes3.length ? `（注意：${notes3.join('；')}）` : ''}`);

      // 4 文字：漏掉的占位符、undefined、性别代词、熟客台词
      const errs4 = [], warns4 = [];
      for (const t of r.texts) {
        const bad = t.text.match(/\{\w+\}|undefined|NaN|\[object \w+\]|null(?![一-龥])/);
        if (bad) { errs4.push(`节点 ${t.node} 的文字里出现“${bad[0]}”`); break; }
      }
      const self = r.texts.filter(t => t.by === 'self').map(t => t.text).join('');
      const he = (self.match(/他(?!们)/g) || []).length, she = (self.match(/她(?!们)/g) || []).length;
      if (def.sex === 'f' && he > she * 2 && he >= 4) warns4.push(`女性人物的故事里“他”${he} 次、“她”${she} 次，看看有没有写错代词`);
      if (def.sex === 'm' && she > he * 2 && she >= 4) warns4.push(`男性人物的故事里“她”${she} 次、“他”${he} 次，看看有没有写错代词`);
      for (const [k, v] of Object.entries(def.lines || {})) {
        if (!LINE_KEYS.includes(k)) warns4.push(`台词键 ${k} 不会被用到（可用：${LINE_KEYS.join(' ')}）`);
        for (const line of [].concat(v)) { const out = vm.runInContext(`fill(${JSON.stringify(line)}, ${JSON.stringify(LINE_VARS)})`, g); if (/\{\w+\}/.test(out)) errs4.push(`台词 ${k} 里有用不了的占位符：${line}`); }
      }
      mark(id, !errs4.length, '文字', errs4.concat(warns4.map(w => `（提醒）${w}`)).join('；') || `${r.texts.length} 段文字无漏字，代词与性别一致`);

      // 5 登场：全员同场
      const pt = pops[id], runs = +opt('runs', 3), days = +opt('days', 100), errs5 = [];
      let startOk = true;
      try { if (def.start.cond) { g.__d = def; vm.runInContext('newGame("normal", "apprentice"); __d.start.cond()', g); } } catch (e) { startOk = false; errs5.push(`start.cond 出错：${e.message}`); }
      if (pt.errors.length) errs5.push(`实战里出错：${pt.errors[0]}`);
      if (startOk && !pt.runs) errs5.push(`全员同场模拟 ${runs} 局×${days} 天，一次都没登场（start.day ${def.start.day}，chance ${def.start.chance ?? 1}）`);
      else if (startOk && pt.runs < runs / 2) errs5.push(`全员同场 ${runs} 局只登场 ${pt.runs} 局`);
      if ((def.start.day || 1) > 60) errs5.push(`start.day ${def.start.day}：多数玩家一局玩不到这么久`);
      const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '—';
      mark(id, !errs5.length, '登场', errs5.join('；') || `全员同场 ${runs} 局里登场 ${pt.runs} 局，平均第 ${avg(pt.first)} 日；走完 ${pt.done} 局`);
    }
  }

  // 6 真浏览器
  if (localOnly && doBrowser) {
    const out = await browserCheck(defs.map(d => d.id));
    const fatal = out.result && out.result.fatal;
    for (const def of defs) {
      const b = (out.result || {})[def.id] || {}, errs6 = [];
      if (fatal) errs6.push(fatal.split('\n')[0]);
      else if (b.err) errs6.push(`出错：${b.err}`);
      else {
        if (!b.scene) errs6.push(`柜台前的立绘没显示（${b.sceneSrc}）`);
        if (!b.dialog) errs6.push(`故事对话框的立绘没显示（${b.dialogSrc}）`);
        if (!b.text) errs6.push('故事对话框没有文字');
        if (!b.buttons) errs6.push('故事对话框没有抉择按钮');
        if (!b.card) errs6.push('「人物」页卡片没显示');
        const badM = Object.entries(b.moods || {}).filter(([, ok]) => !ok).map(([m]) => m);
        if (badM.length) errs6.push(`神态图加载不出：${badM.join('、')}`);
      }
      mark(def.id, !errs6.length, '浏览器', errs6.join('；') || `Firefox 里柜台立绘、故事对话框（${b.buttons} 个抉择）、人物页卡片、七种神态都显示正常`);
    }
    const jsErr = (out.errors || []).filter(e => !/favicon/.test(e));
    if (jsErr.length) console.log(`! 浏览器里有 ${jsErr.length} 个脚本或资源错误：${jsErr.slice(0, 3).join('；')}`);
  }

  // 7 线上
  if (doRemote) {
    const { remoteCompare, REMOTE } = await import('../lib/launch.mjs');
    const engine = ['index.html', 'assets/art.js', 'js/cast.js', 'js/cast-ecology.js', 'js/condition.js', 'js/look.js', 'js/people.js', 'js/stories.js', 'js/ui.js'];
    const files = new Set(engine), httpPaths = [];
    for (const def of defs) {
      files.add(`js/cast/${def.id}.js`);
      for (const m of MOOD_KEYS) files.add(`assets/chars/${m === 'neutral' ? def.portrait : `${def.portrait}_${m}`}.webp`);
      httpPaths.push(`js/cast/${def.id}.js`, `assets/chars/${def.portrait}.webp`);
    }
    const rc = remoteCompare([...files], only ? httpPaths : httpPaths.slice(0, 6).concat(['']));
    const eng = rc.err ? [rc.err] : [...rc.missing, ...rc.differ].filter(f => engine.includes(f)).map(f => `${f} ${rc.missing.includes(f) ? '线上没有' : '与本地不同'}`);
    for (const def of defs) {
      const mine = [`js/cast/${def.id}.js`, ...MOOD_KEYS.map(m => `assets/chars/${m === 'neutral' ? def.portrait : `${def.portrait}_${m}`}.webp`)];
      const errs7 = rc.err ? [rc.err] : [
        ...mine.filter(f => rc.missing.includes(f)).map(f => `${f} 线上没有`),
        ...mine.filter(f => rc.differ.includes(f)).map(f => `${f} 与本地不同`),
        ...eng,
        ...Object.entries(rc.http || {}).filter(([p, c]) => (p.includes(def.id) || p.includes(`/${def.portrait}.webp`)) && c !== 200).map(([p, c]) => `https 取 ${p} 得 ${c}`)];
      mark(def.id, !errs7.length, '线上', errs7.join('；') || `${REMOTE} 上的文件与本地一致，网站能取到`);
    }
  }

  // 报告
  let bad = 0;
  if (orphans.length) { console.log(`✗ js/cast 里有没登记的文件（不会上线）：${orphans.join('、')}`); bad++; }
  const castBroken = broken.filter(b => b.startsWith('js/'));
  if (castBroken.length) { console.log(`✗ 有脚本载不进来：${castBroken.slice(0, 5).join('；')}`); bad++; }
  // 攻略与程序对账：新人物、新货、改了数值，攻略都得重新生成（node tools/guide/guide.mjs build）
  if (localOnly && fs.existsSync(path.join(GAME, 'guide/src'))) {
    const gc = spawnSync(process.execPath, [path.join(GAME, 'tools/guide/guide.mjs'), 'check'], { encoding: 'utf8' });
    if (gc.status) { console.log(`✗ 攻略与程序对不上（运行 node tools/guide/guide.mjs build 后检查差异）：\n${(gc.stderr || gc.stdout).split('\n').slice(0, 12).join('\n')}`); bad++; }
    else if (!flag('quiet')) console.log('✓ 攻略与程序一致');
  }
  const quiet = flag('quiet');
  let okN = 0;
  for (const def of defs) {
    const gates = res[def.id] || [], fail = gates.filter(x => !x.ok);
    if (!fail.length) okN++;
    if (quiet && !fail.length) continue;
    console.log(`\n${fail.length ? '✗' : '✓'} ${def.name}（${def.id}）${fail.length ? `未就绪：${fail.map(x => x.gate).join('、')}` : '可以上线'}`);
    for (const x of gates) if (!quiet || !x.ok) console.log(`  ${x.ok ? '✓' : '✗'} ${x.gate}：${x.msg}`);
    bad += fail.length;
  }
  console.log(`\n${okN}/${defs.length} 个人物就绪${bad ? `；${bad} 项未通过` : ''}`);
  process.exit(bad ? 1 : 0);
}

// ───────────── 入口 ─────────────

const [cmd, id] = args;
try {
  ({ faces, list, new: () => scaffold(id), art: () => makeArt(id), check: () => check(id && !id.startsWith('--') ? id : null), ready: () => ready(id && !id.startsWith('--') ? id : null) }[cmd] || (() => {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n').replace(/^\/\/ ?/gm, ''));
  }))();
} catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
// ready 是异步的：它抛出的错误也要拦下来，退出码非零
process.on('unhandledRejection', e => { console.error(`✗ 检查本身出错：${e && e.stack || e}`); process.exit(2); });
