# 拾荒、修为与擂台

[返回首页](README.md)

## 拾荒

打烊后可以出门拾荒，一夜去一处。每翻一次耗体力精神，遇险的机会越翻越高；遇险当场结束，可能受伤中毒、丢钱或招执法堂。带伤去翻更耗力、更容易出事（见[伤毒、求医与死亡](health.md)）。

{{ T.locations() }}

翻出来的东西品相参差，带鉴定纹路的（丹药、玉佩、古镜）多半是假货，记得先鉴定再出手。

## 修为

服炼丹药、魂魄能涨修为；攒够了修为，再拿着破境之物冲关。

{{ T.realms() }}

能服炼的东西：

{{ T.cultXp() }}

- 标着“损善名”的是邪物，服一次善名掉一点。
- 冲关的成算：修为刚够时约 {{ pct((fresh(), S.cult.xp = REALMS[1].need, breakOdds())) }}，闭关时更高，修为攒得越多越高；带伤中毒都会拖累。冲关失败修为折损，还会[[cond:deviation]]。{{! (() => { fresh(); S.cult.xp = REALMS[1].need; const a = breakOdds(); S.retreat = true; const b = breakOdds(); S.retreat = false; addCond('me', 'injured', 1); return b > a && breakOdds() < a; })() }}
- 境界高过对方，才能对人动手（关门打狗、夜里截杀）。{{! (() => { fresh(); const p = Object.values(S.people).find(p => killable(p) && npcLevel(p) >= S.cult.lv); return !p || !!canKill(p); })() }}

## 擂台

每 {{ TOURNEY_EVERY }} 天一场外门小比，年终另有宗门大比。战堂执事提前几天上门，告诉你上擂的是谁、身上带着什么伤毒。你可以报名、押注、给对手下药，或者不去。

{{ T.tourney() }}

- 带伤中毒上擂很难赢，[[cond:injured]]到第三重时再挨打会要命（见[伤毒、求医与死亡](health.md)）。
- 赢了除了灵石和奖品，还涨魔宗声望与功勋、战堂的交情。
