# 人物与派系

[返回首页](README.md)

杂役区的每个人都记得你做过的事：来不来、出什么价、肯不肯帮你，看的是他自己的处境和对你的交情。「人物」页能看到每个人与你的往来、各自的命数。

## 四方

{{ T.factions() }}

在一族里的声望越高，这一族的客人来得越多、预算越足、出价越高，你撒谎也越不容易被识破。魔宗声望还管着货郎肯卖什么、秘籍肯卖几重，以及执法堂的关注每夜退得快不快。

## 交情

好感分五档：

{{ T.bands(a => MOOD_NAME[mood(a)]) }}

交情好的人出价更公道、肯替你说话，医者收你的诊金也少（见[伤毒、求医与死亡](health.md)）；仇视你的人会上门找麻烦。

## 送礼

在「人物」页可以给见过面的人送东西或灵石，一天一回。他看重的是东西对他的用处：正是他心心念念的那样（「人物」页写着“所求”），领情最多；手头越紧、越贪的人，越吃这一套。{{! (() => { fresh(); const p = Object.values(S.people).find(p => p.visits !== undefined); p.wish = 'pill_qi'; const it = makeItem('pill_qi', { q: 60 }); const a = giftValue(p, it); p.wish = 'iron_ore'; return a > giftValue(p, it); })() }}

## 善名

如实相告、公道买卖、接济弱者会涨善名；骗人、吞魂、杀人会掉。

{{ T.bands(v => VIRTUE_NAME(v), 0, 100) }}

- **口碑**：老实人的铺子，客人肯多出价；善名到了{{ VIRTUE_NAME(45) }}，每日多来一位客人；你真心帮过（接济、放人、护证……）{{ (() => { fresh(); for (let i = 0; i < 20; i++) { fateMerit(newPerson('ren'), 2); if (patronBonus()) return i + 1; } })() }} 个人以后，他们荐来的熟客再多一位。善名到 {{ (() => { for (let v = 0; v <= 100; v++) { fresh(); S.virtue = v; const a = trustMul(); S.virtue = v + 1; if (trustMul() === a && v > 20) return v; } })() }} 口碑就到顶，再往上只是花钱买名声。
- 善名在外，求上门的人多，卖货的人也敢多要价；善名太盛又没修为撑腰，人人当你软柿子捏。
- **好报**：你帮过的人记着你。多半只是捎件东西、一份消息、几百灵石；偶尔混出了头的人回来报恩——铺契降价、一道护身符（免一次锁拿、驱逐或横死）、破境之物、一件重宝。前提是你自己也够强：到了{{ REALMS[2].name }}，或者势力够大。{{! (() => { fresh(); S.cult.lv = 2; return strongEnough(); })() }}
- **奇遇**：善名在外、又没有恶名的，日子越往后越可能撞上大机缘——同样是铺契降价、护身符、破境之物或重宝。{{! (() => { fresh(); S.virtue = 60; S.day = 80; const r = Math.random; Math.random = () => 0; const a = JSON.stringify([S.flags.deedMul, S.flags.savior || 0, S.cult.xp, Object.keys(S.items).length]); karmaTick(); Math.random = r; return a !== JSON.stringify([S.flags.deedMul, S.flags.savior || 0, S.cult.xp, Object.keys(S.items).length]); })() }}{{! (() => { fresh(); S.virtue = 60; S.day = 80; S.fate.infamy = Math.ceil(fateTolerance()); const r = Math.random; Math.random = () => 0; const a = JSON.stringify([S.flags.deedMul, S.flags.savior || 0, S.cult.xp, Object.keys(S.items).length]); karmaTick(); Math.random = r; return a === JSON.stringify([S.flags.deedMul, S.flags.savior || 0, S.cult.xp, Object.keys(S.items).length]); })() }}

{{ T.trust() }}

## 因果

恶事是一场赌。每做一桩恶事——出卖人、销赃包庇、坑蒙拐骗、害人性命——就欠下一笔孽债，{{ FATE_WAIT[0] }}～{{ FATE_WAIT[1] }} 日后见分晓：**{{ pct(1 - FATE_ODDS) }} 风平浪静，{{ pct(FATE_ODDS) }} 报应上门**。故事里这类选项、举报和要挟的按钮，都写着这一把的赌注；顶栏的「孽」牌点开能看未了的孽债。

{{ T.sins() }}

这是魔门：坑蒙拐骗、卖人求赏是家常便饭，没有天道替谁伸冤，来讨账的只有苦主、他们的亲友和执法堂。开头小恶没人当回事——第 {{ FATE_TOL_DAYS[0] }} 日前，同样分量的恶事要作到第 {{ (() => { fresh(); S.day = FATE_TOL_DAYS[0]; const a = fateStake(1); for (let k = 1; k < 200; k++) { commitSin('fraud', { w: 1 }); if (fateStake(1) >= 2 * a) return k + 1; } })() }} 桩赌注才翻一倍；铺子做大了，盯着你的人就多了，到第 {{ FATE_TOL_DAYS[1] }} 日只要 {{ (() => { fresh(); S.day = FATE_TOL_DAYS[1]; const a = fateStake(1); for (let k = 1; k < 200; k++) { commitSin('fraud', { w: 1 }); if (fateStake(1) >= 2 * a) return k + 1; } })() }} 桩。日子越往后，每一桩的底注也涨得越快。{{! fateTolerance(1) === FATE_TOL[0] && fateTolerance(999) === FATE_TOL[1] }}

报应要赔的本金随你**累计**作的恶越滚越大，日子越往后也越大。以出卖（分量二）为例，若败露要赔：

{{ T.fateStakes(2, [10, 30, 60, 90], 16).split('\n').filter((l, i) => i < 2 || [1, 2, 4, 6, 8, 12, 16].includes(i - 1)).join('\n') }}

- 先掏灵石，不够就抄走最值钱的货；还赔不上就是**爆仓**：被人打成{{ CONDS.injured.grade[1] }}，执法堂关注暴涨——身上本就带伤、关注本就高的，这一下可能要命。{{! (() => { fresh(); S.stones = 0; S.day = 60; S.fate.n = 12; commitSin('harm', { w: 3 }); const r = Math.random; Math.random = () => 0; S.day = 80; fateTick(); Math.random = r; return S.fate.busts === 1 && condSev('me', 'injured') >= 2; })() }}
- **恶名**：每败露一桩，恶名就涨（小恶一点，出卖销赃两点，害命三点），客人跟着压价，最多压 {{ pct((fresh(), S.fate.infamy = 999, infamyDiscount())) }}。开头恶名到 {{ FATE_TOL[0] }} 好报和奇遇不再上门、到 {{ 4 * FATE_TOL[0] }} 每日少来一位客人（托付证据、跪求接济的人也不再上门）、到 {{ 8 * FATE_TOL[0] }} 少来两位；这些门槛随世道收紧，到第 {{ FATE_TOL_DAYS[1] }} 日降到 {{ FATE_TOL[1] }}、{{ 4 * FATE_TOL[1] }}、{{ 8 * FATE_TOL[1] }}。
- **洗手**：隔 {{ FATE_FADE }} 日不作恶，旧孽淡去相当于 {{ FATE_TOL[1] }}～{{ FATE_TOL[0] }} 桩小恶的分量（越往后越少）；有分量的善事每积 {{ FATE_MERIT }} 点善名，也抵去这么多。下一桩恶事的本金跟着回落。
- **怎么拿捏**：开局手头紧时，作一两桩恶事赌注小、赚头大；一路作下去，赌注翻着涨，越往后涨得越凶，五五开的赌局次数多了，总有一把赔不起。只做好人也活得下去，就是慢；最赚的是在两头之间拿捏——缺钱时冒一次险，赌赢了就收手行善，等旧孽淡了再说。

## 四大派系

血煞宗里四股势力。往来多了从陌生变成座上客、心腹，交情够了可以投到门下，换每周的独家买卖——但对头会记恨你。

{{ T.cliques() }}

## 加料

回气丹、灵酒、灵泉水这类货里可以偷偷掺东西，外表看不出分别，照常卖或送出去：

{{ T.laces() }}

对方越精明、越不信你，越可能识破；识破了就是一桩事端，苦主会上门讨说法。

**市面上也有别人掺好了的货，还有赝品。** 鬼市的丹药灵酒约 {{ pct(sim(4000, () => !!marketLace('pill_qi', {}, 0.2).laced)) }} 掺过料、古玩一半是赝品；魔宗客人拿来卖的约 {{ pct(sim(4000, () => !!marketLace('pill_qi', {}, 0.15).laced)) }}，货郎的也偶有。掺的多是忘忧散，也有尸毒、噬心蛊。外表看不出，**验货**才验得出——手法有一到三重，照妖镜够好、或者你自己学过这一味的手法，才闻得出来。{{! (() => { fresh(); const a = makeItem('pill_qi', { laced: 'addict', laceGrade: 3 }); quickInspect(a); const no = !a.lacedSeen; S.laceKnown = { addict: 1 }; quickInspect(a); return no && a.lacedSeen; })() }}

收到这样的货，怎么办由你：

- **吃个亏**：丢了，或者贱卖给货郎（他一闻就知道，只给一成价）；不知道就自己服下的，忘忧散耗你精神，尸毒让你{{ CONDS.poisoned.grade[1] }}，噬心蛊得运功逼出来、伤你一重。
- **转手骗人**：当好货照常卖出去。不知情时卖出去不算你作恶，只是替人背锅——可对方识破了照样找你；明知还卖，就是你的孽债。{{! (() => { fresh(); const p = newPerson('ren'); p.savvy = 0; const r0 = Math.random; Math.random = () => 0.99; applyLace(p, makeItem('pill_qi', { laced: 'poison' }), 'sale'); const n1 = S.fate.debts.length; applyLace(newPerson('ren'), makeItem('pill_qi', { laced: 'poison', lacedSeen: true }), 'sale'); Math.random = r0; return n1 === 0 && S.fate.debts.length === 1; })() }}
- **学了变本加厉**：把验出来的掺料货拆开辨味，学会那一味的手法；赝品、以次充好的货也一样能拆开学仿造、作伪。学会了手脚更干净（被识破的机会大约少一半），忘忧散一次能让人上两重瘾。偏门的门道（见下面的“打听门道”）也教这些手艺。{{! (() => { fresh(); const p = newPerson('ren'); p.savvy = 0.6; const t = makeItem('pill_qi'); t.laced = 'poison'; t.lacedBy = 'me'; const a = laceDetectChance(p, t); S.laceKnown = { poison: 1 }; return laceDetectChance(p, t) < a * 0.6; })() }}

## 让人听话

凭这几样能差遣人：{{ T.levers() }}。被控的人可以上贡、替你盯执法堂、打探消息，房东、管事、巡查等人还有各自的“方便”。每次差遣都可能被识破。

## 打听门道

杂役区的人各自懂些门道：丹师、郎中懂丹方和治伤，铁匠懂炉火，混混、销赃的懂偏门生意，老人、僧道懂因果，行商懂行情和货源。见过一面的人，「人物」页里列着他像是懂哪些行当的门道（只露行当，不露内容），可以一条条请教；一天跟同一个人只能打听一回，费些精神。打听来的记在「卷宗」的见闻录里。门道一共 {{ loreAll().length }} 条，内容由游戏数据现编，和这份攻略一样与程序对得上。{{! loreAll().every(t => !/undefined|NaN/.test(t.text) && LORE_TIER[t.tier]) }}

- **肯不肯说**看三样：世道（难度越高人越嘴紧）、这条门道值多少（{{ Object.values(LORE_TIER).join(' / ') }}，偏门生意另加一截）、他对你的交情。仇视你的一个字也不说。
- **花钱买**：交情不够时，只有{{ LORE_TIER.high }}的和偏门的门道肯卖，要价看他贪不贪、你们差多少交情；守规矩的人给钱也不卖害人的门道，混混、销赃的不在乎。{{! (() => { fresh(); const p = S.people.thug; p.aff = 0; return loreOffer(p, { tier: 'low', evil: false, id: '_' }).kind !== 'sell' && loreOffer(p, { tier: 'high', evil: true, id: '_' }).kind === 'sell'; })() }}

以一位贪念中等、不怎么守规矩的行商为例：

{{ T.lore() }}

## 有名有姓的人

除了开局就在杂役区的几位，下面这些人会陆续登场（登场日是大约，要碰上机缘）：

{{ T.cast() }}
