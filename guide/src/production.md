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
- **[[machine:gupot]]**：[[item:gu_egg]]孵出[[item:gu]]，每夜吃腐骨长大；两只成蛊可能下新卵。
- **[[machine:pen]]**：养[[item:treasure_rat]]夜里叼东西回来，养[[item:gold_bug]]吞废铁吐[[item:spirit_sand]]；喂[[item:beast_feed]]长得快。
- **[[machine:forgery]]**：把货“做旧做好”，或照着样品仿造（要先学会，见下面的功法）。
- **[[machine:puppet]]**：夜里替你摆摊卖货，钱放进钱匣。

## 功法与秘籍

功法每一重都让对应设备出品更好，有的还多出一炉。秘籍在货郎那儿买，要按顺序读，魔宗声望够了才肯卖下一重。

{{ T.techs() }}

## 闭关

打烊后可以**闭关**：当夜你亲自坐镇炉火，[[machine:dihuo]]能把[[item:xuan_essence]]炼成[[item:god_blank]]，诸炉出品更精，还涨修为；代价是体力精神恢复得少。{{! (() => { const a = T.craft('dihuo', [['xuan_essence', 4]], { retreat: true }); return a.out.some(([id]) => id === 'god_blank'); })() }}
