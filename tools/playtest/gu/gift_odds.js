// 送礼单上标的识破几率：同一件掺了忘忧散的灵果，给中了蛊的人与没中蛊的人看
const SAVE = window.__SAVE; localStorage.setItem(SAVE_KEY, SAVE); load(); enterGame(); closeModal();
const shown = (p, uid) => {
  pages['gift-' + p.pid] = 0; HANDLERS.person({ dataset: { pid: p.pid } }); click('gift-open', { pid: p.pid });
  for (let pg = 0; pg < 40; pg++) { const r = qa(`[data-act="gift-give"][data-uid="${uid}"]`)[0]; if (r) { const m = r.textContent.match(/识破\s*(\d+)%/); closeModal(); return m ? +m[1] : 0; } if (!click('page', { key: 'gift-' + p.pid, d: 1 })) break; }
  closeModal(); return null;
};
const met = Object.values(S.people).filter(p => p.status === 'alive' && p.visits && !p.official && !p.story && npcLevel(p) <= S.cult.lv);
const t = giveItem('spirit_fruit'), a = giveItem('wangyou'); pick(t); click('lace'); click('lace-do', { uid: a.uid });
const before = met.slice(0, 6).map(p => [p.name, shown(p, t.uid)]);
// 给前三位下蛊（按钮），下中为止
const gu = met.slice(0, 3);
for (const p of gu) for (let k = 0; k < 10 && !guBound(p); k++) {
  const g = giveItem('gu', { growth: 100, tox: 40 });
  HANDLERS.person({ dataset: { pid: p.pid } }); click('plant-open', { pid: p.pid }); click('plant-do', { pid: p.pid, uid: g.uid }); settle();
  if (!guBound(p)) { S.day++; p.plantDay = 0; }
}
accel('下蛊每回不中就跳过一天重下（只为凑齐三个中蛊的人）');
const after = met.slice(0, 6).map(p => [p.name + (guBound(p) ? '（中蛊）' : ''), shown(p, t.uid)]);
note('下蛊前：' + before.map(x => x.join(' ') + '%').join('，'));
note('下蛊后：' + after.map(x => x.join(' ') + '%').join('，'));
const drop = gu.map((p, i) => [before[i][1], after[i][1]]);
check('送礼单上标的识破几率：同一个人中蛊后明显下降，没中蛊的不变', gu.every(guBound) && drop.every(([b, a]) => a < b * 0.6) && after.slice(3).every((x, i) => x[1] === before[3 + i][1]),
  drop.map(([b, a], i) => `${gu[i].name} ${b}%→${a}%`).join('，'));
