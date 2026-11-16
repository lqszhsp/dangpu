# 伤毒、求医与死亡

[返回首页](README.md)

## 三种状态

{{ T.conds() }}

- **怎么来的**：拾荒遇险、与人动手、擂台惨败、被人堵巷口下毒、冲关失败。
- **影响**：比斗、动手、拾荒都吃亏；[[cond:injured]]让你夜里恢复得少，[[cond:poisoned]]每夜耗体力精神，[[cond:deviation]]让修为涨不动、冲关必败、说谎易露馅。
- 体力或精神见底时另算[[cond:exhausted]]，比斗也吃亏，歇一夜就好。

## 会死

- [[cond:injured]]到第三重（{{ CONDS.injured.grade[2] }}）、[[cond:poisoned]]到第三重（{{ CONDS.poisoned.grade[2] }}）时，每夜都有机会咽气；在第三重上再添一重，当场毙命。{{! (() => { fresh(); S.flags.savior = 0; addCond('me', 'injured', 3); addCond('me', 'injured', 1); return S.over && S.over.title === '伤重不治'; })() }}
- 不治、一直熬着的话：{{ CONDS.injured.grade[2] }}熬到自己降下来（{{ CONDS.injured.heal * 3 }} 夜）约有 **{{ pct(T.probe.deathRate('injured', 3, CONDS.injured.heal * 3)) }}** 没熬过去；{{ CONDS.poisoned.grade[2] }}不会自己好转，熬 {{ CONDS.poisoned.worsen * 5 }} 夜约有 **{{ pct(T.probe.deathRate('poisoned', 3, CONDS.poisoned.worsen * 5)) }}** 毒发身亡。
- 涉险的选项在你重伤、垂危时会写明后果（“再受伤就垂危了”“再受伤必死”），看清了再点。
- 手里有护身符的，会被人从鬼门关拽回来，降回第二重。{{! (() => { fresh(); S.flags.savior = 1; addCond('me', 'injured', 3); addCond('me', 'injured', 1); return !S.over && condSev('me', 'injured') === 2 && S.flags.savior === 0; })() }}

## 怎么治

点顶栏上的伤毒，会打开**求医**：列出手上对症的药（直接服下），和你结识过的医者。

### 手上的药

{{ Object.entries(CONDS).map(([k, c]) => `**${c.name}**：${c.cure.map(id => ref('item', id)).join('、')}`).join('；') }}。{{ CONDS.deviation.name }}要的是纯度够高的灵水（洗灵池洗出来的）。{{! (() => { fresh(); addCond('me', 'deviation', 1); return cureBy(makeItem('water', { purity: 98 })) == null && cureBy(makeItem('water', { purity: 99.5 })) === 'deviation'; })() }}

[[item:vine_fruit]]用[[machine:yaopot]]种，[[item:pill_blood]]、[[item:pill_qi]]用[[machine:danlu]]炼，[[item:herb_blood]]用[[machine:herbbed]]种，货郎和鬼市也常有（见[设备与配方](production.md)、[经营](shop.md)）。身上带伤去冒险之前，最好备一两样。

### 医者

懂医术的人见过一面（上过你的门）以后，就能在「人物」页对他**求诊**，也能从顶栏的伤毒点进去找他。没结识过医者，就只能靠手上的药，或者静养。

{{ T.healers() }}

诊金按你身上他能治的伤毒总重数算，交情越好越便宜，贪的人要得多。只有得罪了医者本人（交情跌到仇视）才求不动，名声好坏不连坐。{{! (() => { fresh(); const id = 'shen_suxin'; startStory(id, id, 'meet', 99); const p = S.people[id]; p.visits = 1; p.aff = 0; addCond('me', 'injured', 2); S.fate.infamy = 10; const ok = !healBlock(p); p.aff = -60; return ok && !!healBlock(p); })() }}以{{ CONDS.injured.grade[2] }}为例：

{{ T.healFees(Object.keys(CAST).filter(k => CAST[k].healer)) }}

## 人物也会伤、会病、会死

- 卖给、送给人物的真药（不是赝品、没掺害人的料）当场治好他对症的伤毒；带伤中毒的人上门，多半就是来买药的。{{! (() => { fresh(); const p = Object.values(S.people)[0]; addCond(p, 'injured', 2); npcCure(p, makeItem('vine_fruit', { q: 60 })); return !condSev(p, 'injured'); })() }}
- 人物中毒毒发以后会自己去寻郎中，寻不到就毒发身亡；{{ CONDS.injured.grade[2] }}的人每夜也有机会伤重不治。
- 成瘾的人断了货，熬一阵会戒掉；一直有人供货，就一直虚下去。
