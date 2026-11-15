// 工具共用：无界面载入游戏、查立绘/图标、往 index.html 登记脚本、调用生图与后期
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const INDEX = path.join(GAME, 'index.html');

export function scripts() {
  const html = fs.readFileSync(INDEX, 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'js/ui.js');
}

// 载入游戏全部逻辑（不含界面）；expose 里的名字挂到 ctx.__G 上方便取用
// 像浏览器一样逐个脚本执行：缺文件或某个脚本出错，只跳过它、报出来，别的照常载入
export function loadGame(expose = [], { quiet = false } = {}) {
  const ctx = { console, Math, JSON, Date, setTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  vm.createContext(ctx);
  const broken = [];
  for (const f of scripts()) {
    const file = path.join(GAME, f);
    if (!fs.existsSync(file)) { broken.push(`${f}：文件不存在`); continue; }
    try { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: f }); }
    catch (e) { broken.push(`${f}：${e.message}`); }
  }
  vm.runInContext(`var sel = null; globalThis.__G = { ${expose.join(', ')} };`, ctx);
  if (broken.length && !quiet) {
    console.warn(`! index.html 里有 ${broken.length} 个脚本载不进来（浏览器里同样会被跳过）：`);
    broken.slice(0, 6).forEach(b => console.warn(`    ${b}`));
    if (broken.length > 6) console.warn(`    ……另有 ${broken.length - 6} 个`);
  }
  ctx.__broken = broken;
  return ctx;
}

export const hasArt = (dir, name) => fs.existsSync(path.join(GAME, 'assets', dir, `${name}.webp`));

// 在 index.html 的 <!-- <tag>:end --> 前登记一个脚本
export function registerScript(tag, src) {
  let html = fs.readFileSync(INDEX, 'utf8');
  const line = `<script src="${src}"></script>`;
  if (html.includes(line)) return;
  if (!html.includes(`<!-- ${tag}:end -->`)) throw new Error(`index.html 里找不到 <!-- ${tag}:end -->`);
  html = html.replace(`<!-- ${tag}:end -->`, `${line}\n<!-- ${tag}:end -->`);
  fs.writeFileSync(INDEX, html);
}

// 读 tools/art/specs.py 里的风格前缀等
export function artSpecs(names) {
  const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(GAME, 'tools/art'))}); import specs; print(json.dumps({k: getattr(specs, k) for k in ${JSON.stringify(names)}}, default=sorted))`;
  return JSON.parse(execFileSync('python3', ['-c', py]).toString());
}

// 跑一批生图（gpt-image 技能），再转成游戏用图；--redo 时先删掉要重画的
export function runArt(name, jobs, { jobsN = 4, redo = null } = {}) {
  const artDir = path.join(GAME, 'art');
  fs.mkdirSync(artDir, { recursive: true });
  if (redo) jobs.filter(j => redo === true || redo.includes(j.variant)).forEach(j => {
    fs.rmSync(path.join(artDir, j.out), { force: true });
    fs.rmSync(path.join(GAME, 'assets', j.out.split('/')[1], path.basename(j.out, '.png') + '.webp'), { force: true });
  });
  const manifest = path.join(artDir, `${name}.json`);
  fs.writeFileSync(manifest, JSON.stringify(jobs));
  const script = path.join(process.env.HOME, '.codex/skills/gpt-image/scripts/gpt_image.py');
  const r = spawnSync('python3', [script, 'batch', manifest, '--jobs', String(jobsN)], { stdio: 'inherit', env: process.env });
  spawnSync('python3', [path.join(GAME, 'tools/art/postprocess.py')], { stdio: 'inherit' });
  return r.status || 0;
}
