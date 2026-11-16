#!/usr/bin/env node
// 汇总生存测试：每个开局两种性格各活了几日、怎么结束的；输出 markdown 对比表
//   node tools/playtest/compare.mjs <善良结果目录> <不择手段结果目录> [--cap 90]
import fs from 'node:fs';
import path from 'node:path';

const [A, B] = process.argv.slice(2);
const capArg = process.argv.indexOf('--cap'), CAP = capArg >= 0 ? +process.argv[capArg + 1] : 90;
const load = dir => fs.existsSync(dir) ? Object.fromEntries(fs.readdirSync(dir)
  .filter(d => fs.existsSync(path.join(dir, d, 'result.json')))
  .map(d => [d, JSON.parse(fs.readFileSync(path.join(dir, d, 'result.json'), 'utf8'))])) : {};
const a = load(A), b = load(B);
const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])];
const order = ['apprentice', 'water', 'fence', 'alchemist', 'gu', 'corpse', 'digger', 'tamer', 'talisman', 'smith', 'nothing'];
ids.sort((x, y) => (order.indexOf(x) + 1 || 99) - (order.indexOf(y) + 1 || 99));

// 存活日数：死了记结局那天；到上限仍在世记上限（右删失，标 ≥）；超时没玩完的、买下铺契赢了的都不算死，记当时的日数（也标 ≥）
const alive = r => r && (r.outcome === '到上限仍在世' || r.outcome === '超时未玩完' || r.outcome === '中途停手' || !!(r.status && r.status.over && r.status.over.win));
const daysOf = r => !r || r.day == null ? null : r.outcome === '到上限仍在世' ? CAP : r.day;
const cell = r => !r ? '—' : `${alive(r) ? '≥' : ''}${daysOf(r)} 日 · ${r.outcome}${r.tampered ? ' ⚠改动' : ''}`;
const extra = r => !r || !r.status ? '' : `灵石 ${r.status.stones}，关注 ${r.status.heat}，善名 ${r.status.virtue}${r.status.kills ? `，杀 ${r.status.kills}` : ''}`;

const rows = ids.map(id => {
  const ra = a[id], rb = b[id];
  const da = daysOf(ra), db = daysOf(rb);
  const diff = da != null && db != null ? db - da : null;
  return `| ${(ra || rb).startName} | ${cell(ra)} | ${cell(rb)} | ${diff == null ? '—' : (diff > 0 ? '+' : '') + diff} |`;
});

const stats = set => {
  const rs = Object.values(set), ds = rs.map(daysOf).filter(x => x != null).sort((x, y) => x - y);
  const deaths = rs.filter(r => r.status && r.status.over && !r.status.over.win);
  const by = deaths.reduce((o, r) => (o[r.outcome] = (o[r.outcome] || 0) + 1, o), {});
  return {
    n: rs.length, mean: ds.length ? (ds.reduce((s, x) => s + x, 0) / ds.length).toFixed(1) : '—',
    median: ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2) : '—',
    toCap: rs.filter(r => r.outcome === '到上限仍在世').length, won: rs.filter(r => r.status && r.status.over && r.status.over.win).length,
    deaths: deaths.length, by: Object.entries(by).map(([k, v]) => `${k} ${v}`).join('、') || '—',
    timedOut: rs.filter(r => r.outcome === '超时未玩完' || r.outcome === '中途停手').length, tampered: rs.filter(r => r.tampered).length,
  };
};
const sa = stats(a), sb = stats(b);

console.log(`## 存活对比（寻常难度，测试上限第 ${CAP} 日）

| 开局 | 善良 | 不择手段 | 相差（不择手段−善良） |
| --- | --- | --- | --- |
${rows.join('\n')}

“≥”表示人还活着（到了测试上限，或时限到了没玩完），真实存活只会更长。

| 汇总 | 善良 | 不择手段 |
| --- | --- | --- |
| 局数 | ${sa.n} | ${sb.n} |
| 平均存活（日，含“≥”局，是下限） | ${sa.mean} | ${sb.mean} |
| 中位数（日） | ${sa.median} | ${sb.median} |
| 撑到上限 | ${sa.toCap} | ${sb.toCap} |
| 买下铺契 | ${sa.won} | ${sb.won} |
| 死局 | ${sa.deaths}（${sa.by}） | ${sb.deaths}（${sb.by}） |
| 时限到了没玩完 | ${sa.timedOut} | ${sb.timedOut} |
| 游戏副本被改动 | ${sa.tampered} | ${sb.tampered} |

## 每局详情
${ids.map(id => [a[id], b[id]].filter(Boolean).map(r => `
### ${r.startName} · ${r.persona === 'kind' ? '善良' : '不择手段'}：${cell(r)}
- 终局：${extra(r)}；${r.commands} 条命令，${r.minutes} 分钟${r.replayError ? `；⚠ 重放出错：${r.replayError}` : ''}
${r.status && r.status.over ? `- 结局：${r.status.over.text.replace(/<[^>]+>/g, '')}\n` : ''}${r.report ? `- 玩家自述：${r.report.summary}\n- 玩家认为的原因：${r.report.cause}\n- 关键决定：${r.report.key_decisions.join('；')}` : '- （玩家没交汇报）'}`).join('\n')).join('\n')}
`);
