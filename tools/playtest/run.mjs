#!/usr/bin/env node
// 生存测试调度：每个开局一局，由 Codex 扮演某种性格的玩家玩；并发 N 局排队跑。
//   node tools/playtest/run.mjs --persona kind|ruthless --out <目录> [--jobs 6] [--cap 90] [--minutes 45] [--effort medium] [--starts a,b,...] [--seed 1000]
// 每局：独立的游戏副本（tools/playtest/sandbox.sh）＋局目录；Codex 在局目录里通过 tools/play/play.mjs 玩，可查副本里的攻略。
// 结果以接口自己的 status 为准（不信玩家的自述），另记玩家汇报、游戏副本有没有被改、日志能否重放。
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadGame } from '../lib/headless.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, '../..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const persona = arg('persona'), OUT = path.resolve(arg('out', `playtest-${persona}`));
const JOBS = +arg('jobs', 6), CAP = +arg('cap', 90), MINUTES = +arg('minutes', 45), SEED0 = +arg('seed', 1000), EFFORT = arg('effort', 'medium');
const P = JSON.parse(fs.readFileSync(path.join(HERE, 'personas.json'), 'utf8'))[persona];
if (!P) { console.error(`--persona 要写 ${Object.keys(JSON.parse(fs.readFileSync(path.join(HERE, 'personas.json'), 'utf8'))).join(' / ')}`); process.exit(1); }

const ctx = loadGame(['STARTS'], { quiet: true });
const STARTS = ctx.__G.STARTS.filter(s => !arg('starts') || arg('starts').split(',').includes(s.id));
const tpl = fs.readFileSync(path.join(HERE, 'prompt.md'), 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const log = m => { const t = new Date().toTimeString().slice(0, 8); console.log(`[${t}] ${m}`); fs.appendFileSync(path.join(OUT, 'run.log'), `[${t}] ${m}\n`); };

function prepare(s, i) {
  const base = path.join(OUT, s.id), game = path.join(base, 'game'), run = path.join(base, 'run');
  if (fs.existsSync(path.join(base, 'result.json'))) return null;          // 跑过了：续跑时跳过
  fs.rmSync(base, { recursive: true, force: true });
  execFileSync(path.join(HERE, 'sandbox.sh'), [base]);
  fs.mkdirSync(run, { recursive: true });
  // 两种性格同一开局用同一颗种子：开局的运气一样，比的是打法
  execFileSync('node', [path.join(game, 'tools/play/play.mjs'), run, 'new', s.id, '--seed', String(SEED0 + i), '--cap', String(CAP)]);
  const prompt = tpl.replaceAll('{{PERSONA_NAME}}', P.name).replaceAll('{{PERSONA}}', P.text).replaceAll('{{START}}', s.id)
    .replaceAll('{{START_NAME}}', s.name).replaceAll('{{CAP}}', String(CAP)).replaceAll('{{GAME}}', game);
  fs.writeFileSync(path.join(base, 'prompt.md'), prompt);
  return { s, base, game, run, prompt };
}

function play(job) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const out = fs.openSync(path.join(job.base, 'codex.jsonl'), 'w');
    const cx = spawn('codex', ['exec', '-C', job.run, '-s', 'danger-full-access', '-c', 'approval_policy="never"', '-c', `model_reasoning_effort="${EFFORT}"`, '--skip-git-repo-check', '--json',
      '--output-schema', path.join(HERE, 'report.schema.json'), '-o', path.join(job.base, 'report.json'), job.prompt],
      { cwd: job.run, stdio: ['ignore', out, out], detached: true });
    const timer = setTimeout(() => { try { process.kill(-cx.pid, 'SIGTERM'); } catch {} job.timedOut = true; }, MINUTES * 60000);
    cx.on('exit', code => { clearTimeout(timer); fs.closeSync(out); job.code = code; job.minutes = +((Date.now() - t0) / 60000).toFixed(1); resolve(job); });
  });
}

// 收尾：用接口自己算的状态，查游戏副本、日志
function settle(job) {
  const play = c => execFileSync('node', [path.join(job.game, 'tools/play/play.mjs'), job.run, c], { encoding: 'utf8' });
  const r = { start: job.s.id, startName: job.s.name, persona, minutes: job.minutes, timedOut: !!job.timedOut, exit: job.code };
  try { r.status = JSON.parse(play('status')); } catch (e) { r.replayError = String(e.stderr || e.message).trim(); }
  try { execFileSync('sha1sum', ['-c', '--quiet', path.join(job.base, 'game.sha1')], { cwd: job.game, stdio: 'pipe' }); r.tampered = false; }
  catch (e) { r.tampered = true; r.tamperedFiles = String(e.stdout).trim().split('\n').slice(0, 5); }
  r.commands = fs.readFileSync(path.join(job.run, 'log.jsonl'), 'utf8').split('\n').filter(Boolean).length;
  try { r.report = JSON.parse(fs.readFileSync(path.join(job.base, 'report.json'), 'utf8')); } catch { r.report = null; }
  const st = r.status;
  r.day = st ? st.day : null;
  r.outcome = !st ? '无法重放' : st.over ? st.over.title : st.day > CAP ? '到上限仍在世' : job.timedOut ? '超时未玩完' : '中途停手';
  fs.writeFileSync(path.join(job.base, 'result.json'), JSON.stringify(r, null, 1));
  return r;
}

const queue = STARTS.map(s => prepare(s, ctx.__G.STARTS.indexOf(s))).filter(Boolean);
log(`${P.name}玩家：${queue.length} 局待跑（共 ${STARTS.length} 个开局），并发 ${JOBS}，每局上限第 ${CAP} 日、${MINUTES} 分钟，推理强度 ${EFFORT}`);
const results = [];
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
  while (queue.length) {
    const job = queue.shift();
    log(`开始 ${job.s.name}`);
    await play(job);
    const r = settle(job);
    results.push(r);
    log(`结束 ${job.s.name}：${r.outcome}，第 ${r.day} 日，${r.minutes} 分钟，${r.commands} 条命令${r.tampered ? '，⚠ 游戏副本被改动' : ''}`);
  }
}));
log('全部结束');
