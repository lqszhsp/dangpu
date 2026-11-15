# 时令与战事

[返回首页](README.md)

一周 {{ WEEK_LEN }} 天，一季 {{ SEASON_LEN }} 天，一年 {{ YEAR_LEN }} 天。行情跟着星期、季节、节庆、战事起落，顶栏的日历和每日的时令播报会告诉你今天什么好卖。

## 星期

{{ T.weekdays() }}

## 季节

{{ T.seasons() }}

灵草在[[machine:herbbed]]里长得快慢、[[item:corpse]]烂成[[item:bones]]的快慢都看季节。

## 节庆

{{ T.annual() }}

## 战事

人、仙、魔、妖四方关系越来越紧，紧张度跨过一道坎就进入下一阶段，只升不降。{{! WAR_STAGES.every((w, i) => !i || w.at > WAR_STAGES[i - 1].at) }}

{{ T.wars() }}

- 战时丹药、法器、符箓、魂魄、尸傀、妖植这些战备货越来越抢手，珍玩这类奢侈货越来越不值钱。{{! (() => WAR_CATS.length > 0 && WAR_STAGES[WAR_STAGES.length - 1].war > WAR_STAGES[0].war)() }}
- 战事越烈，巡查越勤、货郎进价越高；打到后面来客也会变少，宗门还按周征调。
- [[loc:battlefield]]开战以后能翻到更多战场遗物（见[拾荒、修为与擂台](adventure.md)）。
