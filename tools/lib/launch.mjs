// 上线检查共用：用真浏览器（无界面 Firefox）经 HTTP 打开游戏跑测试；比对线上服务器与本地的文件
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { GAME, INDEX } from './headless.mjs';

// 线上位置：可用环境变量改
export const REMOTE = process.env.DANGPU_REMOTE || 'vps192:/srv/dangpu/current';
export const DOMAIN = process.env.DANGPU_DOMAIN || 'dangpu.photohaha.net';
const FIREFOX = process.env.DANGPU_FIREFOX || 'firefox';
// snap 版 Firefox 只能读写家目录下的 snap 目录
const PROFILE = path.join(process.env.HOME, 'snap/firefox/common/dangpu-ready');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };

// 在真浏览器里跑一段测试：testSrc 是一个 async 函数体，能用游戏的全部全局，返回值交回来。
// 页面与资源都经 HTTP 提供（与线上一致），图片真的加载、真的解码。
export async function browserRun(testSrc, { timeout = 120000 } = {}) {
  const html = fs.readFileSync(INDEX, 'utf8').replace('</body>', `<script>
window.__errors = [];
window.addEventListener('error', e => __errors.push(String(e.message || e.target && e.target.src || e)), true);
window.addEventListener('load', async () => {
  let result;
  try { result = await (async () => { ${testSrc} })(); } catch (e) { result = { fatal: String(e && e.stack || e) }; }
  await fetch('/__report', { method: 'POST', body: JSON.stringify({ result, errors: __errors }) });
});
</script></body>`);
  let done;
  const got = new Promise(r => { done = r; });
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (req.method === 'POST' && url === '/__report') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => { res.end('ok'); done(JSON.parse(body)); });
      return;
    }
    if (url === '/' || url === '/__ready.html') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(html); }
    const file = path.join(GAME, url);
    if (!file.startsWith(GAME) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  fs.mkdirSync(PROFILE, { recursive: true });
  // 每回都是 SIGTERM 收场，Firefox 当它崩了；崩的次数攒多了，启动时弹“安全模式”框挡住页面，测试就卡死。关掉这道检查
  fs.writeFileSync(path.join(PROFILE, 'user.js'), 'user_pref("toolkit.startup.max_resumed_crashes", -1);\nuser_pref("browser.sessionstore.resume_from_crash", false);\n');
  const ff = spawn(FIREFOX, ['--headless', '--no-remote', '--profile', PROFILE, `http://127.0.0.1:${port}/__ready.html`], { stdio: 'ignore', detached: true });
  const timer = new Promise(r => setTimeout(() => r({ result: { fatal: `浏览器 ${timeout / 1000} 秒内没有回报（Firefox 起不来，或页面卡死）` }, errors: [] }), timeout));
  const out = await Promise.race([got, timer]);
  try { process.kill(-ff.pid, 'SIGTERM'); } catch (e) { /* 已退出 */ }
  server.close();
  return out;
}

// ───────────── 线上比对 ─────────────

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// files：相对游戏根目录的路径。返回 { missing, differ, http: { 路径: 状态码 }, err }
export function remoteCompare(files, httpPaths = []) {
  const [host, dir] = REMOTE.split(':');
  const cmd = `cd ${dir} 2>/dev/null || { echo NODIR; exit 0; }; for f in ${files.map(f => `'${f}'`).join(' ')}; do if [ -f "$f" ]; then sha256sum "$f"; else echo "MISSING $f"; fi; done; `
    + httpPaths.map(p => `echo "HTTP ${p} $(curl -sS -o /dev/null --max-time 20 --resolve ${DOMAIN}:443:127.0.0.1 -w '%{http_code}' 'https://${DOMAIN}/${p}')"`).join('; ');
  const r = spawnSync('ssh', ['-o', 'ConnectTimeout=15', '-o', 'LogLevel=ERROR', host, cmd], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0 && !r.stdout) return { err: `连不上 ${host}：${(r.stderr || r.error || '').toString().trim().slice(0, 200)}` };
  if (r.stdout.includes('NODIR')) return { err: `${REMOTE} 不存在` };
  const remote = {}, missing = [], differ = [], codes = {};
  for (const line of r.stdout.split('\n')) {
    let m;
    if ((m = line.match(/^MISSING (.+)$/))) missing.push(m[1]);
    else if ((m = line.match(/^([0-9a-f]{64})\s+(.+)$/))) remote[m[2]] = m[1];
    else if ((m = line.match(/^HTTP (\S+) (\d+)$/))) codes[m[1]] = +m[2];
  }
  for (const f of files) if (remote[f] && fs.existsSync(path.join(GAME, f)) && remote[f] !== sha(path.join(GAME, f))) differ.push(f);
  return { missing, differ, http: codes };
}

// 部署见 tools/deploy.mjs：只上线 main，传到版本目录再换软链，可回滚
