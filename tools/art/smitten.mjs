#!/usr/bin/env node
// 情蛊神态（_smitten）：给每一张成年女子的面孔补一张“脸红花痴、衣着轻薄”的立绘。中了情蛊的人见了你就换这张（js/gu.js smittenMood）。
//   node tools/art/smitten.mjs --list           列出该画的面孔（有名有姓的、故事里的、路人的女面孔；未成年的一概不画）
//   node tools/art/smitten.mjs [--jobs 4]       画还没有的；画完跑 postprocess 出 webp、更新 assets/art.js
//   node tools/art/smitten.mjs --redo a,b       重画这几张
// 以 art/raw/chars/<面孔>.png 的底图改图（同一个演员、同一身行头、同一个镜头），提示词见 tools/art/specs.py 的 SMITTEN / SMITTEN_NOTE。
// 模型用 gpt-image-2.5-sunburst-adobe（GPT_IMAGE_MODEL / GPT_IMAGE_FALLBACK 都只设它，免得混进别的画风）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GAME, loadGame } from '../lib/headless.mjs';

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const flag = k => argv.includes(`--${k}`);

// 该画的面孔：{ face, who, note, prompt }
export function smittenFaces() {
  const ctx = loadGame([], { quiet: true });
  return vm.runInContext(`(() => {
    const out = new Map(), minorFaces = new Set();
    const adult = d => !(d.age != null ? d.age < 18 : d.minor);
    for (const d of Object.values(CAST)) if (!adult(d)) minorFaces.add(d.portrait);
    const add = (face, who, own) => {
      if (!face || minorFaces.has(face) || /kid/.test(face)) return;
      const r = out.get(face) || { face, who: [], own: null };
      r.who.push(who); if (own) r.own = own; out.set(face, r);
    };
    for (const d of Object.values(CAST)) if (d.sex === 'f' && adult(d)) add(d.portrait, d.name, d.moodArt && d.moodArt.smitten);
    for (const [k, st] of Object.entries(STORIES)) if (st.person && !CAST[k] && (st.person.sex === 'f' || FACE_SEX[st.person.portrait] === 'f')) add(st.person.portrait, st.person.name);
    for (const o of Object.values(OFFICIALS)) if (FACE_SEX[o.portrait] === 'f') add(o.portrait, o.name);
    for (const [f, s] of Object.entries(FACE_SEX)) if (s === 'f') add(f, '路人');
    return [...out.values()];
  })()`, ctx);
}

// 直接运行才画图；cast.mjs 只借 smittenFaces 来查缺
const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN) await main();

function specs() {
  const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(GAME, 'tools/art'))}); import specs; print(json.dumps({'s': specs.SMITTEN, 'e': specs.SMITTEN_EXPR, 'c': specs.SMITTEN_CLOTH_FOR, 'n': specs.SMITTEN_NOTE, 'f': specs.SMITTEN_FACES, 'k': specs.SMITTEN_SCREEN, 'm': specs.SMITTEN_SCREEN_FOR}))`;
  return JSON.parse(execFileSync('python3', ['-c', py]).toString());
}

async function main() {
  const has = name => fs.existsSync(path.join(GAME, 'assets/chars', `${name}.webp`));
  const raw = name => path.join(GAME, 'art/raw/chars', `${name}.png`);

  const faces = smittenFaces();
  const { s: SMITTEN, e: EXPR, c: CLOTH_FOR, n: NOTE, f: KIND, k: SCREEN, m: SCREEN_FOR } = specs();
  const redo = (opt('redo') || '').split(',').filter(Boolean);
  // 幕布色按底图挑：人物整体偏蓝（蓝比红高）的用绿幕，其余用蓝幕
  const autoScreen = JSON.parse(execFileSync('python3', ['-c', `
import json, os
from PIL import Image
out = {}
for f in ${JSON.stringify(faces.map(r => r.face))}:
    p = '${GAME}/assets/chars/' + f + '.webp'
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGBA'); px = im.load(); w, h = im.size; s = [0, 0, 0]
    for y in range(0, h, 6):
        for x in range(0, w, 6):
            r, g, b, a = px[x, y]
            if a > 240: s[0] += r; s[1] += g; s[2] += b
    out[f] = 'green' if s[2] > s[0] * 1.03 else 'blue'
print(json.dumps(out))`]).toString());
  for (const r of faces) {
    const note = KIND[r.face] ? ` ${NOTE[KIND[r.face]]}.` : '';
    // 背景画成一整片纯色幕布，回头用 chroma_key.py 抠：模型画“透明底”时常给假格子或纯黑，抠图会挖掉黑发深衣
    r.key = SCREEN_FOR[r.face] || autoScreen[r.face] || 'blue';
    r.prompt = `Same actor, same costume design, same framing, same camera angle and lighting, same style. Only change this: the facial expression and state: ${r.own || (CLOTH_FOR[r.face] ? `${EXPR}; ${CLOTH_FOR[r.face]}` : SMITTEN)}.${note} `
      + `Replace the whole background with a ${SCREEN[r.key]} studio screen: one flat uniform color everywhere around and between the limbs, no floor, no shadow, no gradient, no checkerboard; no ${r.key} on the person.`;
    r.done = has(`${r.face}_smitten`) && !redo.includes(r.face);
    r.base = fs.existsSync(raw(r.face));
  }

  if (flag('list')) {
    for (const r of faces) console.log(`${r.done ? '✓' : r.base ? '·' : '✗'} ${r.face.padEnd(18)} ${r.who.join('、')}${KIND[r.face] ? `（${KIND[r.face]}）` : ''}${r.base ? '' : '  缺底图 art/raw/chars/' + r.face + '.png'}`);
    console.log(`共 ${faces.length} 张面孔，已画 ${faces.filter(r => r.done).length}，待画 ${faces.filter(r => !r.done).length}`);
    process.exit(0);
  }

  const todo = faces.filter(r => !r.done);
  const noBase = todo.filter(r => !r.base);
  if (noBase.length) { console.error(`✗ 缺底图（先把原图放进 art/raw/chars）：${noBase.map(r => r.face).join('、')}`); process.exit(1); }
  if (!todo.length) { console.log('✓ 成年女子的面孔都有情蛊神态了'); process.exit(0); }
  for (const f of redo) for (const p of [raw(`${f}_smitten`), path.join(GAME, 'assets/chars', `${f}_smitten.webp`)]) fs.rmSync(p, { force: true });

  const jobs = todo.map(r => ({ id: `char:${r.face}_smitten`, mood: 'smitten', refs: [`raw/chars/${r.face}.png`], out: `raw/chars/${r.face}_smitten.png`,
    size: '1024x1536', quality: 'high', background: 'opaque', prompt: r.prompt }));
  const manifest = path.join(GAME, 'art/smitten.json');
  fs.writeFileSync(manifest, JSON.stringify(jobs, null, 0));
  console.log(`画 ${jobs.length} 张情蛊神态（清单 art/smitten.json）`);
  const env = Object.assign({}, process.env, { GPT_IMAGE_MODEL: 'gpt-image-2.5-sunburst-adobe', GPT_IMAGE_FALLBACK: 'gpt-image-2.5-sunburst-adobe' });
  const r = spawnSync('python3', [path.join(process.env.HOME, '.codex/skills/gpt-image/scripts/gpt_image.py'), 'batch', manifest, '--jobs', opt('jobs') || '4'], { stdio: 'inherit', env, cwd: path.join(GAME, 'art') });
  // 抠幕布：新画好的原图就地改成带透明的 PNG，再出 webp
  for (const k of Object.keys(SCREEN)) {
    const files = todo.filter(x => x.key === k && fs.existsSync(raw(`${x.face}_smitten`)) && !has(`${x.face}_smitten`)).map(x => raw(`${x.face}_smitten`));
    if (files.length) spawnSync('python3', [path.join(GAME, 'tools/art/chroma_key.py'), ...files, '--key', k], { stdio: 'inherit' });
  }
  spawnSync('python3', [path.join(GAME, 'tools/art/postprocess.py')], { stdio: 'inherit' });
  // 抠完看颜色：人物的整体颜色跟底图差太多（偏绿、发灰），多半是幕布色没选对或抠掉了暖色
  const drift = JSON.parse(execFileSync('python3', ['-c', `
import json
from PIL import Image
def mean(p):
    im = Image.open(p).convert('RGBA'); px = im.load(); w, h = im.size; s = [0, 0, 0]; n = 0
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b, a = px[x, y]
            if a > 240: s[0] += r; s[1] += g; s[2] += b; n += 1
    return [v / max(1, n) for v in s]
out = {}
for f in ${JSON.stringify(todo.map(r => r.face))}:
    try:
        a, b = mean('${GAME}/assets/chars/' + f + '.webp'), mean('${GAME}/assets/chars/' + f + '_smitten.webp')
        # 色相偏移：比较两张图里三通道的相对比例（亮度变了不算）
        ra, rb = [v / max(1, sum(a)) for v in a], [v / max(1, sum(b)) for v in b]
        out[f] = round(max(abs(x - y) for x, y in zip(ra, rb)) * 100, 1)
    except Exception: pass
print(json.dumps(out))`]).toString());
  const off = Object.entries(drift).filter(([, v]) => v >= 6);
  if (off.length) console.log(`! 这几张的颜色跟底图差得多（通道比例偏 6% 以上），放到红底上看一眼：${off.map(([f, v]) => `${f} ${v}%`).join('、')}`);
  const left = todo.filter(r => !has(`${r.face}_smitten`));
  console.log(left.length ? `还缺 ${left.length} 张：${left.map(r => r.face).join('、')}（再跑一次会续上）` : `✓ ${todo.length} 张都画好了。放到红底上看一遍再上线。`);
  if (r.status && left.length) process.exit(1);
}
