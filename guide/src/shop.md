# 经营

[返回首页](README.md)

## 一天怎么过

1. **清晨**：收租日先收租；货郎、行情、鬼市的货一早换过。
2. **白天开门迎客**：客人来买、来卖、来请你鉴定。一位客人一次能连着谈几样货。
3. **打烊**：夜里可以去拾荒、去鬼市，也可以闭关。
4. **夜里**：设备按「工坊」的顺序耗灵力运转；你入定歇息，体力精神恢复。

## 租金

- 头一期在第 {{ T.probe.firstRentDay() }} 日收，之后每 {{ T.probe.rentEvery() }} 日收一期，一期比一期高。寻常难度下：

{{ T.rents(10) }}

- 到期时手里的灵石够就自动交掉。交不上，欠款涨到 {{ T.probe.rentGrace().mul }} 倍，宽限 {{ T.probe.rentGrace().days }} 日；宽限期满还交不上，就被扫地出门。{{! (() => { fresh(); S.stones = 0; S.flags.savior = 0; S.day = S.rentDue; rentCheck(); for (let i = 0; i < 9 && !S.over; i++) { S.day++; rentCheck(); } return S.over && S.over.title === '扫地出门'; })() }}
- 房东可能换人，租金也可能被故事改动（帮钱执事销赃能换折扣，得罪了人租金会涨）。

## 客流与陈列

- 每天大约来 **{{ T.probe.customers() }}** 位客人。[[upgrade:sign]]多招一位{{! (() => { const a = T.probe.customers(); fresh(); itemsIn('display').forEach(destroyItem); S.upgrades.sign = true; return customerCount() === a + 1; })() }}，陈列柜里摆的货越值钱，来的人也越多。
- **陈列柜决定来什么人**：摆一件货，就有 {{ pct(displayPull(1)) }} 的客人冲着它来，摆得越多越高，最多 {{ pct(displayPull(99)) }}。冲着货来的人更有耐心、预算更足、肯多出价。
- 什么货招什么族的人，见[货物图鉴](items.md)的分类；各族喜好见[人物与派系](people.md)。
- [[item:yao_core]]、[[item:beast_hide]]摆出来会得罪妖族。仙门禁物、魔宗禁药摆出来会招执法堂（见[执法堂与巡查](law.md)）。

## 议价与鉴定

- 顾客出价看货的底价、当下行情、你在他那一族的声望、他对你的交情、难度的出价倍率。开价太狠，他会还价或拂袖而去，界面上标着成交、还价、拂袖三种可能。
- 收货时卖家也在撒谎：残次货、赝品、赃物都会被说成好货。**鉴定**（用照妖镜）能看穿品相和真假；镜子越好看得越深。
- 替人鉴定收鉴定费；[[upgrade:master]]让鉴定费翻倍，说谎也更不容易被识破。
- 赝品可以当真货卖，也可以照实说。买家眼力够就可能当场看穿，或者回去以后才发现，上门找你算账。

## 体力与精神

几乎每件事都耗体力与精神，夜里入定歇息恢复。闭关的夜里恢复得少，带伤的夜里也恢复得少。

一夜好眠大约回体力 {{ (fresh(), S.vit.st = 0, S.vit.sp = 0, restNight(), S.vit.st) }}、精神 {{ S.vit.sp }}；修一间[[upgrade:quiet]]能多回 {{ (() => { fresh(); S.upgrades.quiet = true; S.vit.st = 0; restNight(); const a = S.vit.st; fresh(); S.vit.st = 0; restNight(); return a - S.vit.st; })() }}。

{{ T.actions() }}

服下能补气力的东西：

{{ T.restores() }}

## 货郎

货郎每天换一批货。下面是底价，实际价钱还要算上难度加价、当天行情、战事，魔宗声望高能打折；有些货要魔宗声望够了才肯卖。

{{ T.supply() }}

货郎也收你的货，只给估值的 {{ pct((() => { fresh(); const it = makeItem('iron_ingot', { q: 60 }); autoPlace(it); const v = trueValue(it), before = S.stones; sellToBroker(it); return (S.stones - before) / v; })(), 0) }} 左右，图个省事。设备拆了只退 {{ pct((() => { fresh(); const m = addMachine('furnace'), before = S.stones; removeMachine(m); return (S.stones - before) / MACHINES.furnace.price; })()) }} 的价钱。

## 扩建

{{ T.upgrades() }}

## 鬼市与批发

打烊后可以去这三处整批进货、出货。每逢**{{ (() => { fresh(); for (let d = 1; d <= WEEK_LEN; d++) { S.day = d; if (isGhostNight()) return weekdayOf(d).name; } })() }}**，鬼市的货更多，去了也不招执法堂。

{{ T.dealers() }}

宗门批发处要魔宗声望够了，或者在魔宗攒下功勋，才肯跟你做生意。
