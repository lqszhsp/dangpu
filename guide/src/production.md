# 设备与配方

[返回首页](README.md)

后院的设备白天装料，夜里开炉。每台设备每夜耗灵力，也耗你的体力精神（后院有苦力就由苦力顶掉体力那份）。

## 灵力

- 灵力阵每夜自带 {{ ARRAY_BASE_POWER }} 点灵力；[[upgrade:hijack]]多 {{ (() => { fresh(); const a = powerSupply(); S.upgrades.hijack = true; return powerSupply() - a; })() }} 点，[[upgrade:vein]]多 {{ (() => { fresh(); const a = powerSupply(); S.upgrades.vein = true; return powerSupply() - a; })() }} 点。
- 不够的从灵力格里的[[item:spirit_crystal]]里抽，一块最多充 {{ CRYSTAL_CAP }} 点。
- 灵力不够的设备当夜停工，所以「工坊」里的顺序要把要紧的排前面。

## 设备

价钱按寻常难度算（别的难度另加价，见[开局与难度](start.md)）。

{{ T.machines('normal') }}

## 实测配方

下表每一行都是在新开的一局里真的装料开炉得到的：原料按中等品相，不算功法与闭关的加成。

{{ T.recipes([
  ['furnace', [['iron_ore', 2]]],
  ['furnace', [['scrap_sword', 1]]],
  ['forge', [['iron_ingot', 3]], { mods: [['jade_slip', 1]] }],
  ['dihuo', [['iron_ore', 6]]],
  ['danlu', [['herb_dew', 2]]],
  ['danlu', [['herb_blood', 1], ['yao_core', 1]]],
  ['danlu', [['herb_blood', 2], ['yao_core', 1], ['herb_dew', 1]], { mods: [['pill_recipe', 1]] }],
  ['danlu', [['spirit_fruit', 2], ['herb_blood', 1]], { tech: { alchemy: 1 } }],
  ['danlu', [['yao_core', 1], ['blood_essence', 2], ['herb_blood', 1]], { tech: { alchemy: 2 } }],
  ['danlu', [['mihun_flower', 2]]],
  ['pool', [['water', 1, { purity: 60 }], ['filter_sand', 1]]],
  ['pool', [['water', 1, { purity: 98 }], ['spirit_sand', 1]]],
  ['spring', []],
  ['winejar', [['spirit_fruit', 2], ['yeast', 1]], { nights: 2 }],
  ['soulfurnace', [['soul_wisp', 3]]],
  ['soulfurnace', [['soul_grudge', 1]]],
  ['coffin', [['corpse', 1], ['soul_pearl', 1]], { nights: 2 }],
  ['puppetbench', [['iron_ingot', 2], ['soul_pearl', 1]], { mods: [['puppet_scroll', 1]] }],
  ['fudesk', [['fu_paper', 1], ['cinnabar', 1]]],
  ['silkrack', [['silk_seed', 1], ['spirit_fruit', 2]]],
]) }}

还有几类靠养、靠种，要过好几夜才见分晓：

- **[[machine:herbbed]]**：种下[[item:herb_seed]]，长成[[item:herb_blood]]或[[item:herb_dew]]；春夏长得快，冬天慢（见[时令与战事](calendar.md)）。
- **[[machine:yaopot]]**：[[item:mihun_seed]]长成[[item:mihun_flower]]；[[item:vine_seed]]要喂[[item:bones]]或[[item:corpse]]才长，结出[[item:vine_fruit]]——治伤的好药。
- **[[machine:gupot]]**：三格一行——原料格放[[item:bones]]，蛊虫格养[[item:gu]]、孵[[item:gu_egg]]，产物格收新下的卵和吐出的[[item:gu_venom]]。盅口开着还是封着，养法全然不同：
  - **开盅喂养**：卵一夜孵化，幼蛊每夜吃一块腐骨长大，长满化为金蚕蛊；两只成蛊可能下卵，卵落进产物格，想孵就挪回蛊虫格。万毒蛊、蛊王每夜也吃一骨，吐出蛊毒（万毒蛊 {{ pct(GU_VENOM[2]) }}，蛊王夜夜都吐）。
  - **封盅斗蛊**：不喂食、不孵卵，每夜最凶的一只吞掉最弱的一只，夺来对方 {{ pct(GU_DEVOUR_TOX) }} 的毒性，连它吞过的也算进自己的数里。吞满 {{ GU_STAGES[2].eat }} 只成**万毒蛊**，吞满 {{ GU_STAGES[3].eat }} 只成**蛊王**，每蜕变一回吐出一份蛊毒。养两只万毒蛊再封进一盅，胜者一夜便可成王。
  - 毒性六十的金蚕蛊约值 {{ (fresh(), rawValue(makeItem('gu', { growth: 100, tox: 60 }))) }}，同样毒性的万毒蛊 {{ (fresh(), rawValue(makeItem('gu', { growth: 100, tox: 60, eat: GU_STAGES[2].eat }))) }}、蛊王 {{ (fresh(), rawValue(makeItem('gu', { growth: 100, tox: 60, eat: GU_STAGES[3].eat }))) }}；拿幼蛊去喂一只金蚕蛊最划算。蛊毒是魔宗禁药，鬼市收，擂台前也能拿来下药。
- **[[machine:pen]]**：养[[item:treasure_rat]]夜里叼东西回来，养[[item:gold_bug]]吞废铁吐[[item:spirit_sand]]；喂[[item:beast_feed]]长得快。
- 兽栏的饲料格、蛊盅的原料格里，同种的饲料叠在一格，一格至多 {{ MACHINES.pen.feedStack }} 份；叠着的每份照旧记着自己的品相，吃掉的是最早放进去的，取出来也各是各的。
- **[[machine:forgery]]**：把货“做旧做好”，或照着样品仿造（要先学会，见下面的功法）。
- **[[machine:puppet]]**：夜里替你摆摊卖货，钱放进钱匣。

## 功法与秘籍

功法每一重都让对应设备出品更好，有的还多出一炉；每门都练到第四重。秘籍要按顺序读。第一、二重在货郎那儿买，魔宗声望够了才肯卖下一重；第三、四重鬼市不卖，要靠功勋或机遇：

- **功勋兑换**：在货郎的“功勋”页，拿对应一方的功勋换秘籍（只摆出你眼下读得懂的那一重）。
- **行家传艺**：表里列着的行家与你交情够了（三重好感 {{ G.TEACH_AFF[0] }}，四重 {{ G.TEACH_AFF[1] }}），他自己那桩事也了了，过几天就会揣着手抄登门；奉上书价 {{ G.TEACH_FEE * 100 }}% 的束脩，或者只道声谢，当场学会。还没学到前一重的不会来，已经从别处学会的就作罢；手头忙可以请他改日再来。
- **拾荒偶得**：每翻到一件东西，有 {{ G.SCROLL_FIND * 100 }}% 的机会是一卷你正缺的高重秘籍——只翻得到这处地方有的那几门：{{ G.LOCATIONS.map(l => `${l.name}（${l.scrolls.map(t => G.TECHS[t].name).join('、')}）`).join('，') }}。
- **好人好报**：帮过的人混出了头，报答你的重礼里，也可能是一卷你缺的秘籍。

重宝（基价 {{ G.DEEP_MARK_BASE }} 以上）的原主烙印深，可达四重，要抹印第四重才抹得掉。

{{ T.techs() }}

## 闭关

打烊后可以**闭关**：当夜你亲自坐镇炉火，[[machine:dihuo]]能把[[item:xuan_essence]]炼成[[item:god_blank]]，诸炉出品更精，还涨修为；代价是体力精神恢复得少。{{! (() => { const a = T.craft('dihuo', [['xuan_essence', 4]], { retreat: true }); return a.out.some(([id]) => id === 'god_blank'); })() }}
