#!/usr/bin/env node
// 汇总生存测试：每个开局几种性格各活了几日、怎么结束的；输出 markdown 对比表
//   node tools/playtest/compare.mjs <结果目录> <结果目录> ... [--cap 90]
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2), capArg = argv.indexOf('--cap'), CAP = capArg >= 0 ? +argv[capArg + 1] : 90;
const dirs = argv.filter((a, i) => !a.startsWith('--') && (capArg < 0 || i !== capArg + 1));
const NAME = { kind: '善良', ruthless: '不择手段', balanced: '权衡' };
const load = dir => fs.existsSync(dir) ? Object.fromEntries(fs.readdirSync(dir)
  .filter(d => fs.existsSync(path.join(dir, d, 'result.json')))
  .map(d => [d, JSON.parse(fs.readFileSync(path.join(dir, d, 'result.json'), 'utf8'))])) : {};
const sets = dirs.map(load).filter(s => Object.keys(s).length);
const names = sets.map(s => NAME[Object.values(s)[0].persona] || Object.values(s)[0].persona);
const ids = [...new Set(sets.flatMap(Object.keys))];
const order = ['apprentice', 'water', 'fence', 'alchemist', 'gu', 'corpse', 'digger', 'tamer', 'talisman', 'smith', 'nothing'];
ids.sort((x, y) => (order.indexOf(x) + 1 || 99) - (order.indexOf(y) + 1 || 99));

// 存活日数：死了记结局那天；到上限仍在世记上限；超时没玩完的、买下铺契赢了的都不算死，记当时的日数（标 ≥，真实只会更长）
const won = r => !!(r && r.status && r.status.over && r.status.over.win);
const dead = r => !!(r && r.status && r.status.over && !r.status.over.win);
const daysOf = r => !r || r.day == null ? null : r.outcome === '到上限仍在世' ? CAP : r.day;
const cell = r => !r ? '—' : `${dead(r) ? '' : '≥'}${daysOf(r)} 日 · ${r.outcome}${r.tampered ? ' ⚠改动' : ''}`;
const fate = r => r && r.status && r.status.fate ? r.status.fate : null;
const extra = r => !r || !r.status ? '' : `灵石 ${r.status.stones}，关注 ${r.status.heat}，善名 ${r.status.virtue}${r.status.kills ? `，杀 ${r.status.kills}` : ''}`
  + (fate(r) ? `，作恶 ${fate(r).total} 桩（败露 ${fate(r).erupted}、爆仓 ${fate(r).busts}），恶名 ${fate(r).infamy}` : '');

const stats = set => {
  const rs = Object.values(set), ds = rs.map(daysOf).filter(x => x != null).sort((x, y) => x - y);
  const deaths = rs.filter(dead), by = deaths.reduce((o, r) => (o[r.outcome] = (o[r.outcome] || 0) + 1, o), {});
  const f = rs.map(fate).filter(Boolean);
  return {
    n: rs.length, median: ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2) : '—',
    won: rs.filter(won).length, wonDays: rs.filter(won).map(daysOf).sort((a, b) => a - b).join('、') || '—',
    toCap: rs.filter(r => r.outcome === '到上限仍在世').length, deaths: deaths.length, by: Object.entries(by).map(([k, v]) => `${k} ${v}`).join('、') || '—',
    open: rs.filter(r => r.outcome === '超时未玩完' || r.outcome === '中途停手').length, tampered: rs.filter(r => r.tampered).length,
    sins: f.length ? (f.reduce((s, x) => s + x.total, 0) / f.length).toFixed(1) : '—', busts: f.reduce((s, x) => s + x.busts, 0),
    virtue: rs.filter(r => r.status).length ? Math.round(rs.filter(r => r.status).reduce((s, r) => s + r.status.virtue, 0) / rs.filter(r => r.status).length) : '—',
  };
};
const st = sets.map(stats);
const row = (label, k) => `| ${label} | ${st.map(s => s[k]).join(' | ')} |`;

console.log(`## 存活对比（寻常难度，测试上限第 ${CAP} 日）

| 开局 | ${names.join(' | ')} |
| --- | ${names.map(() => '---').join(' | ')} |
${ids.map(id => `| ${(sets.map(s => s[id]).find(Boolean)).startName} | ${sets.map(s => cell(s[id])).join(' | ')} |`).join('\n')}

“≥”表示人还活着（买下铺契、到了测试上限，或时限到了没玩完）。

| 汇总 | ${names.join(' | ')} |
| --- | ${names.map(() => '---').join(' | ')} |
${row('局数', 'n')}
${row('死局', 'deaths')}
${row('死因', 'by')}
${row('买下铺契', 'won')}
${row('买下铺契的日子', 'wonDays')}
${row('撑到上限', 'toCap')}
${row('时限到了没玩完', 'open')}
${row('存活中位数（日，含“≥”）', 'median')}
${row('平均作恶（桩）', 'sins')}
${row('爆仓（次）', 'busts')}
${row('终局平均善名', 'virtue')}
${row('游戏副本被改动', 'tampered')}

## 每局详情
${ids.map(id => sets.map(s => s[id]).filter(Boolean).map(r => `
### ${r.startName} · ${NAME[r.persona] || r.persona}：${cell(r)}
- 终局：${extra(r)}；${r.commands} 条命令，${r.minutes} 分钟${r.replayError ? `；⚠ 重放出错：${r.replayError}` : ''}
${r.status && r.status.over ? `- 结局：${r.status.over.text.replace(/<[^>]+>/g, '')}\n` : ''}${r.report ? `- 玩家自述：${r.report.summary}\n- 玩家认为的原因：${r.report.cause}\n- 关键决定：${r.report.key_decisions.join('；')}` : '- （玩家没交汇报）'}`).join('\n')).join('\n')}
`);
