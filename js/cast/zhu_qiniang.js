// 朱七娘：盘丝岭来的蜘蛛精，七姐妹里最小的一个。吐的丝比灵蚕丝韧十倍，织坊的管事想把她锁在织机前一辈子；
// 买她的丝能做云锦生意，替她出头要得罪少宗主一系的织坊，卖她能讨织坊的赏
'use strict';

const QINIANG_BOSS = { name: '织坊管事', portrait: 'landlord', title: '少宗主织坊管事', faction: 'mo' };

defineCharacter({
  id: 'zhu_qiniang', name: '朱七娘', faction: 'yao', sex: 'f', title: '蜘蛛精',
  portrait: 'zhu_qiniang',
  // 成年女子；妖修驻颜，看上去二十出头。妩媚、灵巧，雅致不露骨
  art: 'a spider spirit, an adult woman who looks about 22: a captivating beautiful face with fair skin, sharp dark eyes with a faint crimson glint, red lips, '
    + 'long glossy black hair pinned up with silver hairpins shaped like small spiders, a fitted black and deep crimson silk qipao-style robe embroidered with silver spiderweb patterns, '
    + 'sheer black silk sleeves, a fine glittering silver thread looped between her fingers like a cat\'s cradle, a slender graceful figure, '
    + 'a sly charming smile, elegant and tasteful, not explicit',
  bio: '盘丝岭七姐妹里最小的一个，下山来杂役区讨生活。她吐的丝比灵蚕丝韧十倍、亮十倍，织坊的管事看上了她的丝，也看上了她的人。',
  intro: '一个拿一卷亮得晃眼的丝线来卖的蜘蛛精。',
  savvy: 0.7, power: 32, eye: 2,
  traits: { greed: 0.5, integrity: 0.4, caution: 0.6, wish: 'cloud_robe', budgetMul: 1.0 },
  start: { day: 9, node: 'silk', chance: 0.4, cond: () => ART_SET.has('chars/zhu_qiniang') },   // 立绘装好才登场
  regular: true,
  lines: {
    first: '（一缕银丝从房梁垂下来，她顺着丝落在柜台前）小掌柜，吓着了？',
    neutral: ['小掌柜，今儿收丝么？', '（她指间绕着一根银丝）又来叨扰了。'],
    warm: ['小掌柜，你这儿的梁上，吾结的网最结实。', '姐姐们说杂役区人心坏，吾看你还好。'],
    close: ['往后谁动你的铺子，吾的丝替你挡着。', '小掌柜，吾给你织一件，穿上刀枪不入。'],
    cold: '买卖，别的不谈。',
    hostile: '（她手里的丝绷得笔直）你把吾卖给了织坊。',
    buy: ['有{cat}么？吾挑剔着呢。', '吾要{cat}，别拿次货糊弄吾。'],
    sell: '这卷{item}，{ask} 灵石。别处可买不着这么韧的。',
  },
  on: {
    death: () => { log('房梁上那张蛛网空了，再没人从梁上落下来。', 'loss'); },
  },

  nodes: {
    // 头一回：卖自己吐的丝
    silk: {
      when: 'day',
      text: () => '一缕银丝从房梁上垂下来，接着一个红衣女子顺着丝轻轻落在柜台前，发间几支蜘蛛形的银簪一晃一晃。她把一卷亮得晃眼的丝线搁在柜上：'
        + '“吾自己吐的，比灵蚕丝韧十倍。六卷能织一件云锦——小掌柜，收不收？”\n“只是……别让织坊的人知道是吾卖的。”',
      choices: () => [
        { label: '照价收下三卷（150 灵石）', hint: `${costHint(150)}；得三束灵丝（上品）`, req: needStones(150), run: (st, p) => {
          spend(150, '收下朱七娘的三卷丝。'); for (let i = 0; i < 3; i++) giveItem('silk', { q: 92 });
          remember(p, '你照价收了她的丝。', 15, 'fair'); st.flags.bought = true;
          return { text: '她把灵石一枚枚数进荷包，冲你一笑：“爽快。往后吾的丝，先紧着你。”', go: ['boss', [3, 5]], summary: '你收下了朱七娘的丝。', mood: 'pleased' };
        } },
        { label: '压价收（60 灵石）', hint: `${costHint(60)}；得三束灵丝；她会记着`, req: needStones(60), run: (st, p) => {
          spend(60, '压价收下朱七娘的三卷丝。'); for (let i = 0; i < 3; i++) giveItem('silk', { q: 92 });
          remember(p, '你压价收了她的丝。', -8, 'lowballed'); st.flags.bought = true; st.flags.cheated = true;
          return { text: '她手里的丝绷了一下，又松开了：“行。杂役区的价，吾记住了。”', go: ['boss', [3, 5]] };
        } },
        { label: '不收', hint: '不沾这件事', run: (st, p) => {
          remember(p, '你没收她的丝。', -2);
          return { text: '“可惜了。”她顺着银丝回到梁上，眨眼就不见了。', go: ['boss', [3, 5]] };
        } },
      ],
    },

    // 织坊管事上门：找吐丝的蜘蛛精
    boss: {
      when: 'day',
      who: () => QINIANG_BOSS,
      text: st => '一个肥头大耳的管事踱进门，手里转着两颗铁胆：“少宗主的织坊缺丝。听说杂役区有只会吐银丝的蜘蛛精——锁到织机前，一年能织三十件云锦。”'
        + '\n“谁替本管事找着她，织坊赏三百；谁藏着她……少宗主的生意，往后就不劳你了。”'
        + (st.flags.bought ? '\n他的目光扫过你柜里那几卷丝，眯了眯眼。' : ''),
      choices: st => [
        { label: '说没见过', hint: `撒谎${st.flags.bought ? '；柜里的丝是破绽' : ''}；被看穿则少宗主一系交情 -10${condText('me') ? `（${condText('me').replace(/。$/, '')}，更容易露馅）` : ''}`, run: st => {
          if (lieCaught(st.flags.bought ? 0.55 : 0.3)) { shiftSt('heir', -10); st.flags.suspect = true; return { text: '管事把铁胆一攥：“好，你没见过。”', go: ['web', [1, 2]], mood: 'angry' }; }
          return { text: '管事哼了一声，转着铁胆走了。', go: ['web', [1, 2]] };
        } },
        { label: '说是从鬼市收的，不知来路', hint: '花 60 灵石让他信', req: needStones(60), run: () => {
          spend(60, '打点织坊管事。');
          return { text: '管事收了灵石：“鬼市？那就是从别处流过来的。”', go: ['web', [1, 2]] };
        } },
        { label: '告诉他她常在你铺子房梁上落脚', hint: '+300 灵石；少宗主一系交情 +10；妖族声望 -8', sin: ['betray', 2], run: (st, p) => {
          earn(300, '把朱七娘卖给织坊。'); shiftSt('heir', 10); adjustRep('yao', -8);
          remember(p, '你把她卖给了织坊。', -100, 'betrayed'); lifeNote(p, '被锁在了少宗主织坊的织机前。'); p.status = 'gone';
          return { text: '当夜，织坊的人用浸了雄黄的网罩住了你的房梁。\n半个月后，织坊出了一批云锦，亮得晃眼。', end: true, summary: '你把朱七娘卖给了织坊。', mood: 'pleased' };
        } },
      ],
    },

    // 当夜：织坊的人来捉，她求你帮她挡一挡
    web: {
      when: 'night',
      cond: (st, p) => p.status === 'alive',
      mood: 'afraid',
      text: st => '半夜，房梁上落下一根丝，朱七娘顺着丝滑下来，脸色发白：“织坊的人带着雄黄网，在巷子里一家一家地找。小掌柜，让吾在你梁上躲一夜。”'
        + (st.flags.cheated ? '\n“上回压吾的价，吾不计较了——今夜帮吾一回。”' : '')
        + (st.flags.suspect ? '\n你想起管事攥着铁胆的那只手。' : ''),
      choices: st => [
        { label: '让她躲在梁上，你守着门', hint: `织坊若找上门，要凭你挡住${st.flags.suspect ? '（他已经起了疑）' : ''}；成算约 ${Math.round(trialOdds(36) * 100)}%（${condText('me') || '你状态尚好'}）`, run: (st, p) => {
          goodDeed(p, 3); remember(p, '那晚你让她在梁上躲着，替她守了门。', 25, 'helped');
          if (!st.flags.suspect || Math.random() < 0.5) return { text: '织坊的人从你门口过了三趟，没进来。天亮时，梁上多了一张细细密密的网。', go: ['repay', [5, 8]], summary: '你让朱七娘在梁上躲过了织坊。', mood: 'pleased' };
          const t = trial('me', 36);
          if (t.ok) { shiftSt('heir', -6); return { text: `织坊的人踹门进来。你抄起门闩挡在梁下：“这是我的铺子。”僵了半晌，他们走了。（${partsText(t.s)}）`, go: ['repay', [5, 8]], summary: '你替朱七娘挡住了织坊的人。', mood: 'pleased' }; }
          addCond('me', 'injured', 1, '挡织坊的人'); shiftSt('heir', -6);
          lifeNote(p, '被织坊用雄黄网从一间当铺的房梁上捉了去。'); p.status = 'gone';
          return { text: `织坊的人把你推到一边，雄黄网罩住了房梁。${condText('me')}`, end: true, summary: '你没挡住织坊，朱七娘被捉走了。' };
        } },
        { label: '给她一身斗篷，送她回盘丝岭', hint: `${costHint(50)}；妖族声望 +5`, req: needStones(50), run: (st, p) => {
          spend(50, '给朱七娘置办回山的盘缠。'); adjustRep('yao', 5); goodDeed(p, 2);
          remember(p, '你送她回了盘丝岭。', 18, 'helped'); lifeNote(p, '回了盘丝岭。'); p.status = 'gone';
          return { text: '她披上斗篷，在门口回头：“姐姐们会知道，杂役区有个好人。”', end: true, summary: '你送朱七娘回了盘丝岭。' };
        } },
        { label: '关上门', run: (st, p) => {
          remember(p, '那晚你没让她进门。', -15);
          return { text: '丝从门缝里缩了回去。后来，房梁上再没结过网。', end: true, summary: '那晚你没让朱七娘进门。' };
        } },
      ],
    },

    // 躲过一劫：她织一件给你
    repay: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      mood: 'pleased',
      text: () => '朱七娘从梁上落下来，怀里抱着一件叠得整整齐齐的法衣，银光流转：“七夜没合眼，织的。比织坊那些亮，也比它们韧。”',
      choices: () => [
        { label: '收下', hint: '得一件云锦法衣（极品）；她往后常来，梁上的网替你看着门', run: (st, p) => {
          giveItem('cloud_robe', { q: 95 }); p.informant = true; adjustRep('yao', 5);
          remember(p, '你收下了她织的法衣。', 10);
          let tail = '她冲你眨了眨眼，顺着丝回了梁上。往后夜里有贼摸进来，总会先在梁下绊一跤。';
          if (strongEnough() && Math.random() < 0.35) {
            S.flags.guard = true;
            tail += '\n后来盘丝岭的六个姐姐也来过一回，在你铺子四角各结了一张网——从此再没贼敢进门。';
          }
          lifeNote(p, '在一间当铺的房梁上安了家。');
          return { text: tail, end: true, summary: '朱七娘在你铺子的房梁上安了家。' };
        } },
      ],
    },
  },
});
