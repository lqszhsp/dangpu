#!/usr/bin/env node
// 上线：把 main 的提交打包传到服务器的版本目录，再把 current 软链换过去
//   node tools/deploy.mjs                 检查并列出这次会改什么，不上传
//   node tools/deploy.mjs --yes           检查都过了就上线
//   node tools/deploy.mjs status          线上是哪个版本、main 比它多了哪些提交、线上有没有仓库里没有的改动
//   node tools/deploy.mjs list            服务器上留着的版本
//   node tools/deploy.mjs rollback [版本]  切回上一个（或指定的）版本
// 防呆：
//   - 只上线 main，且 main 必须和 origin 对得上（落后就停，领先就先推上去）；
//   - 用 git archive 打包：没提交的改动、别的分支上的改动都传不上去；
//   - 线上若有文件的内容在仓库历史里从没出现过（有人绕开本工具直接改了线上），停下来列出——先合进 main 再上线；
//   - 换软链前查新版本：首页引用的文件都在、谁都读得了，不满足就不换；
//   - 换上后经 Caddy 逐个请求首页引用的脚本，有一个不是 200 就切回原来的版本、删掉新版本。
// --force 跳过“线上有仓库里没有的改动”这一项（那些改动会丢）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GAME } from './lib/headless.mjs';

const HOST = process.env.DANGPU_HOST || 'vps192';
const BASE = process.env.DANGPU_BASE || '/srv/dangpu';
const DOMAIN = process.env.DANGPU_DOMAIN || 'dangpu.photohaha.net';
const SHIP = ['index.html', 'css', 'js', 'assets'];   // 只传游戏要用的；tools、art、guide、说明文档不上线
const KEEP = 8;                                        // 服务器上留几个版本（当前与上一个总会留着）

const args = process.argv.slice(2);
const cmd = args.find(a => !a.startsWith('--')) || 'deploy';
const flag = k => args.includes(`--${k}`);

function run(bin, argv, opt = {}) {
  const r = spawnSync(bin, argv, { cwd: GAME, encoding: 'utf8', maxBuffer: 1 << 28, ...opt });
  if (r.status !== 0 && !opt.ok) die(`${bin} ${argv.slice(0, 3).join(' ')} 失败：${(r.stderr || r.stdout || '').trim().slice(0, 400)}`);
  return r;
}
const git = (...a) => run('git', a).stdout.trim();
const ssh = (script, opt) => run('ssh', ['-o', 'LogLevel=ERROR', '-o', 'ConnectTimeout=15', HOST, 'bash -s'], { input: `set -e\ncd ${BASE}\n${script}`, ...opt }).stdout;
function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

// ───────────── 服务器上的版本 ─────────────

// deploys.log 每行：时间 \t 版本目录 \t 提交（迁移来的写 -）\t 说明
function remoteState() {
  const out = ssh(`readlink current || true; echo ---; ls -1 releases; echo ---; cat deploys.log 2>/dev/null || true`);
  const [cur, rel, log] = out.split('---\n');
  return {
    current: cur.trim().replace(/^releases\//, ''),
    releases: rel.split('\n').filter(Boolean).sort(),
    log: log.split('\n').filter(Boolean).map(l => { const [time, name, rev, note] = l.split('\t'); return { time, name, rev, note }; }),
  };
}
const revOf = (st, name) => [...st.log].reverse().find(e => e.name === name && e.rev !== '-')?.rev || null;

// 线上 current 里每个文件的 git blob 值（在服务器上算，不用把文件拉回来）
function liveBlobs() {
  const out = ssh(`cd current/ && find . -type f | sed 's|^\\./||' | sort > /tmp/.dp-files && git hash-object --stdin-paths < /tmp/.dp-files | paste /tmp/.dp-files - ; rm -f /tmp/.dp-files`);
  return new Map(out.split('\n').filter(Boolean).map(l => { const i = l.lastIndexOf('\t'); return [l.slice(0, i), l.slice(i + 1)]; }));
}

function treeBlobs(rev) {
  const out = git('ls-tree', '-r', rev, '--', ...SHIP);
  return new Map(out.split('\n').filter(Boolean).map(l => { const [meta, p] = l.split('\t'); return [p, meta.split(' ')[2]]; }));
}

// 仓库所有分支、所有历史里出现过的对象
function knownObjects() {
  return new Set(git('rev-list', '--objects', '--all').split('\n').map(l => l.slice(0, 40)));
}

// 线上与要上线的版本逐个文件比：没变、新增、更新、删除；线上那份若仓库里从没有过，就是别人没入库的改动
function compare(live, next, known) {
  const r = { same: 0, add: [], update: [], remove: [], foreign: [] };
  for (const [p, b] of next) {
    if (!live.has(p)) r.add.push(p);
    else if (live.get(p) === b) r.same++;
    else (known.has(live.get(p)) ? r.update : r.foreign).push(p);
  }
  for (const [p, b] of live) if (!next.has(p)) (known.has(b) ? r.remove : r.foreign).push(p);
  return r;
}

const brief = (list, n = 12) => list.slice(0, n).join('、') + (list.length > n ? ` ……共 ${list.length} 个` : '');

// ───────────── 本地 main ─────────────

function checkMain() {
  run('git', ['fetch', '-q', 'origin'], { ok: true });
  const rev = git('rev-parse', 'main');
  const remote = run('git', ['rev-parse', '-q', '--verify', 'origin/main'], { ok: true }).stdout.trim();
  if (remote && remote !== rev) {
    if (run('git', ['merge-base', '--is-ancestor', remote, rev], { ok: true }).status !== 0)
      die(`origin 上的 main（${remote.slice(0, 7)}）有本地 main 没有的提交：先 git pull 合进来再上线`);
    if (cmd === 'deploy' && flag('yes')) { console.log(`· 本地 main 领先 origin，先推上去`); git('push', '-q', 'origin', 'main'); }
    else console.log(`· 本地 main 领先 origin（上线时会先推上去）`);
  }
  return rev;
}

// ───────────── 命令 ─────────────

function status() {
  const st = remoteState(), rev = revOf(st, st.current), main = checkMain();
  console.log(`线上：${st.current}${rev ? `（${rev.slice(0, 7)} ${git('log', '-1', '--format=%s', rev)}）` : '（不对应任何提交）'}`);
  console.log(`main：${main.slice(0, 7)} ${git('log', '-1', '--format=%s', main)}`);
  if (rev && rev !== main) console.log(`main 比线上多：\n${git('log', '--format=  %h %s', `${rev}..main`)}`);
  const c = compare(liveBlobs(), treeBlobs(main), knownObjects());
  console.log(`上线 main 会：新增 ${c.add.length} · 更新 ${c.update.length} · 删除 ${c.remove.length} · 不变 ${c.same}`);
  if (c.foreign.length) console.log(`⚠ 线上有 ${c.foreign.length} 个文件不在仓库里：${brief(c.foreign)}`);
}

function list() {
  const st = remoteState();
  for (const name of st.releases) {
    const e = [...st.log].reverse().find(x => x.name === name);
    console.log(`${name === st.current ? '→' : ' '} ${name}  ${e ? `${e.rev === '-' ? '' : e.rev.slice(0, 7)} ${e.note}` : ''}`);
  }
}

// 换软链：先建好新链接再改名覆盖，请求不会落空
const swap = name => ssh(`[ -d releases/${name} ] || { echo 没有这个版本: ${name} >&2; exit 1; }
ln -sfn releases/${name} current.new && mv -Tf current.new current`);
const logLine = (name, rev, note) => ssh(`printf '%s\\t%s\\t%s\\t%s\\n' "$(date '+%F %T')" '${name}' '${rev}' ${JSON.stringify(note.replace(/[\t\n'"$`\\]/g, ' '))} >> deploys.log`);

// 首页引用的脚本与样式
const shipRefs = html => [...new Set([...html.matchAll(/(?:src|href)="([^":#?]+\.(?:js|css))"/g)].map(m => m[1]))];

// 经 Caddy 请求首页与它引用的每个脚本、样式
function smoke(refs) {
  const out = ssh(['', ...refs].map(p => `printf '%s %s\\n' "$(curl -s -o /dev/null --max-time 20 --resolve ${DOMAIN}:443:127.0.0.1 -w '%{http_code}' 'https://${DOMAIN}/${p}')" '/${p}'`).join('\n'));
  return out.split('\n').filter(l => l && !l.startsWith('200 '));
}

function rollback() {
  const st = remoteState();
  const to = args.filter(a => !a.startsWith('--'))[1]
    || [...st.log].reverse().find(e => e.name !== st.current && st.releases.includes(e.name) && !e.note.startsWith('上线失败'))?.name;
  if (!to) die('找不到可以切回去的版本（node tools/deploy.mjs list 看看）');
  swap(to);
  logLine(to, revOf(st, to) || '-', `回滚：从 ${st.current} 切回`);
  console.log(`✓ 已切回 ${to}（原来是 ${st.current}）`);
}

function deploy() {
  const main = checkMain(), short = main.slice(0, 7), subject = git('log', '-1', '--format=%s', main);
  const st = remoteState(), liveRev = revOf(st, st.current);
  console.log(`线上：${st.current}${liveRev ? `（${liveRev.slice(0, 7)}）` : ''}\n要上：main ${short} ${subject}`);
  if (liveRev === main) { console.log('✓ 线上已经是这个版本'); return; }
  if (liveRev && run('git', ['merge-base', '--is-ancestor', liveRev, main], { ok: true }).status !== 0)
    die(`线上的 ${liveRev.slice(0, 7)} 不在 main 的历史里：有人从别的分支上了线，先把它合进 main`);

  const c = compare(liveBlobs(), treeBlobs(main), knownObjects());
  console.log(`改动：新增 ${c.add.length} · 更新 ${c.update.length} · 删除 ${c.remove.length} · 不变 ${c.same}`);
  for (const [k, name] of [['add', '新增'], ['update', '更新'], ['remove', '删除']]) if (c[k].length) console.log(`  ${name}：${brief(c[k])}`);
  if (c.foreign.length) {
    console.log(`\n✗ 线上有 ${c.foreign.length} 个文件的内容在仓库任何分支里都没有——多半是有人绕开本工具直接改了线上：\n  ${brief(c.foreign, 30)}`);
    if (!flag('force')) die('先把这些改动拿回来合进 main 再上线；确定不要它们，加 --force');
    console.log('  --force：这些改动会丢（原版本目录还在，可以回滚）');
  }
  if (!flag('yes')) { console.log('\n这是空跑。确认无误后加 --yes 上线。'); return; }

  const stamp = new Date(), pad = n => String(n).padStart(2, '0');
  const name = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}-${short}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dangpu-ship-'));
  // die() 直接 process.exit，finally 跑不到：退出时也清掉打包目录
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  try {
    run('bash', ['-c', `git archive ${main} ${SHIP.join(' ')} | tar -x -C '${dir}'`]);
    // 没变的文件与当前版本硬链接，不占地方：按内容比（-c），不带时间与属主——git archive 打出来的时间是提交时间，带上就次次对不上；
    // 权限统一设好（临时目录是 700，原样带上去 Caddy 就读不了）
    run('rsync', ['-rlc', '--delete', '--chmod=D755,F644', `--link-dest=${BASE}/releases/${st.current}/`, '-e', 'ssh -o LogLevel=ERROR', `${dir}/`, `${HOST}:${BASE}/releases/${name}/`]);
    // 换上之前：首页引用的文件都在、谁都读得了；不满足就不换，线上一刻也不受影响
    const refs = shipRefs(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'));
    const pre = ssh(`cd releases/${name}; for f in index.html ${refs.join(' ')}; do [ -f "$f" ] || echo "缺 $f"; done; find . ! -perm -o+r -print | head -5 | sed 's/^/读不了 /'`).trim();
    if (pre) { ssh(`rm -rf 'releases/${name}'`); die(`新版本有问题，没有换上（线上不受影响）：\n  ${pre.split('\n').join('\n  ')}`); }
    swap(name);
    const bad = smoke(refs);
    if (bad.length) {
      swap(st.current);
      ssh(`rm -rf 'releases/${name}'`);
      logLine(name, main, `上线失败，已切回 ${st.current} 并删掉此版本：${bad.length} 个请求不是 200，如 ${bad.slice(0, 3).join('，')}`);
      die(`换上后 ${bad.length} 个请求不是 200，已切回 ${st.current}：\n  ${bad.slice(0, 10).join('\n  ')}`);
    }
    logLine(name, main, subject);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }

  // 旧版本只留最近几个；当前与上一个总留着
  const keep = new Set([...st.releases, name].sort().slice(-KEEP).concat([name, st.current]));
  const drop = st.releases.filter(n => !keep.has(n));
  if (drop.length) ssh(drop.map(n => `rm -rf 'releases/${n}'`).join('\n'));
  console.log(`✓ 已上线 ${name}${drop.length ? `；清掉旧版本 ${drop.join('、')}` : ''}\n  出问题就 node tools/deploy.mjs rollback 切回 ${st.current}`);
}

({ deploy, status, list, rollback }[cmd] || (() => die(`不认得 ${cmd}：deploy / status / list / rollback`)))();
