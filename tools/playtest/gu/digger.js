// 拾荒客照 Codex 那局的打法玩（每天白天去最安全的炼器坊废料场拾荒，翻到的残器、铁料放进炼器台），28 天，数炼器台重新祭炼了几夜
window.__keepAlive = true;
newGame('normal', 'digger'); enterGame();
const forge = S.machines.find(m => m.type === 'forge'), fin = gridOf(forge, 'in');
let salvNights = 0, relics = 0, trips = 0, made = {};
for (let d = 0; d < 28 && !S.over; d++) {
  day({
    night: () => {
      const go = !(condSev('me', 'injured') >= 2 || S.heat >= 50);   // 和那局一样：伤重、关注高就不出门
      if (go && click('scavenge')) {
      if (!click('scav-go', { id: 'scrapyard' })) closeModal(); else {
      trips++;
      for (let k = 0; k < 12 && click('scav-search'); k++) if (S.scav && (S.scav.ended || S.scav.danger > 0.3)) break;
      relics += itemsIn('basket').filter(x => x.id === 'broken_relic').length;
      click('scav-home'); settle();
      } }
      // 残器先放；铁料只补到够配残器（一锭、一柄残剑或两块矿），不把入料格塞满
      moveAll('broken_relic', fin);
      const need = itemsIn(fin).filter(x => x.id === 'broken_relic').length;
      const have = () => countIn(itemsIn(fin), 'iron_ingot') + countIn(itemsIn(fin), 'scrap_sword') + Math.floor(countIn(itemsIn(fin), 'iron_ore') / 2);
      for (const id of ['iron_ingot', 'scrap_sword', 'iron_ore']) while (have() < need && moveAll(id, fin, 1)) {}

      const r = itemsIn(fin).filter(x => x.id === 'broken_relic').length;
      if (machineCheck(forge).ok && /祭炼/.test(machineCheck(forge).msg)) salvNights++;
      note(`夜：炼器台 ${machineCheck(forge).msg.slice(0, 8)}（残器 ${r}）入料格 ${itemsIn(fin).map(x => x.id[0] + x.id.split('_')[1][0]).join('')} 库房残器 ${Object.values(S.items).filter(x => x.id === 'broken_relic' && x.pos && x.pos.g !== fin).map(x => x.pos.g).join(',')}`);
    },
  });
  // 产物卖给货郎（选中、卖给货郎），残器、铁料留着
  for (const it of Object.values(S.items).filter(x => x.pos && (x.pos.g === gridOf(forge, 'out') || x.pos.g === 'floor') && !['broken_relic', 'iron_ingot', 'scrap_sword', 'iron_ore'].includes(x.id))) { pick(it); click('sell-broker'); }
  for (const it of itemsIn(gridOf(forge, 'out')).concat(itemsIn('floor'))) made[it.id] = (made[it.id] || 0) + 1;
}
window.__res = { salvNights, relics, trips, over: S.over && S.over.title, stones: S.stones, day: S.day };
note('结果 ' + JSON.stringify(window.__res) + `；补了 ${window.__rentTopUps} 灵石（加速，测的是炉子不是账）`);
check('拾荒客只去废料场也翻得到残器', relics >= 5, `${trips} 趟翻到 ${relics} 件残破法器`);
check('炼器台拿翻来的残剑、玄铁矿补料，真的开炉重新祭炼', salvNights >= 8, `28 夜里祭炼 ${salvNights} 夜`);
