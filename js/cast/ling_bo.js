// 凌波：石盆里养了三百年的水仙花妖，自恋、爱照镜子，离了纯净的灵泉水就要谢。
// 丹房要她的花球炼驻颜丹——护她要得罪丹房，卖她丹房给个好价
'use strict';

const LINGBO_DAN = { name: '丹房执事', portrait: 'mo_senior', title: '丹房执事', faction: 'mo' };
// 铺里有没有九十九成以上的灵泉水（够她续一回命的）
const lingboWater = () => ownItem(it => it.id === 'water' && it.purity >= 99 && !it.laced);

defineCharacter({
  id: 'ling_bo', name: '凌波', faction: 'yao', sex: 'f', title: '水仙花妖',
  portrait: 'ling_bo',
  // 成年女子；花妖驻颜，看上去二十出头。清冷、自赏，衣着雅致
  art: 'a narcissus flower spirit, an adult woman who looks about 22: a cool, delicate, strikingly beautiful face with porcelain skin, pale jade-green eyes, '
    + 'long straight silver-white hair adorned with small white narcissus blossoms with golden cups, a layered white and pale-gold silk dress with long flowing water-like sleeves, '
    + 'a pale green sash, holding a small bronze hand mirror and glancing at it, a slight proud self-admiring air, elegant and graceful',
  bio: '在石盆里养了三百年的水仙花妖，化了形还离不开水。自赏得很，镜子不离手；灵泉水不够纯，她的花就要谢。',
  intro: '一个抱着铜镜来典当、只想换几瓶好水的水仙花妖。',
  savvy: 0.6, power: 22, eye: 2,
  traits: { greed: 0.3, integrity: 0.6, caution: 0.5, wish: 'zhuyan_dan', budgetMul: 1.1 },
  start: { day: 8, node: 'mirror', chance: 0.4, cond: () => ART_SET.has('chars/ling_bo') },   // 立绘装好才登场
  regular: true,
  lines: {
    first: '（她先照了照柜上的铜镜，才抬眼看你）这间铺子，倒还映得出吾的样子。',
    neutral: ['小掌柜，有好水么？', '（她对着柜面理了理鬓边的花）今日又来叨扰。'],
    warm: ['你这儿的水，吾喝着最清。', '小掌柜，你比镜子还懂吾。'],
    close: ['吾的花，有一半是你浇活的。', '往后你铺里摆着的水仙，吾替你开得最好。'],
    cold: '买水，别的不谈。',
    hostile: '（她连镜子都不照了）你卖过吾的花球。',
    buy: ['有{cat}么？要最清的。', '吾要{cat}——不清的不要。'],
    sell: '这件{item}，{ask} 灵石。吾照过它三百年了。',
  },
  on: {
    // 卖给她纯水，算帮她续命
    sold: (st, p, it) => { if (it.id === 'water' && it.purity >= 99) st.flags.watered = (st.flags.watered || 0) + 1; },
    death: () => { log('石盆里那株水仙谢了，再没开过。', 'loss'); },
  },

  nodes: {
    // 头一回：抱着照了三百年的铜镜来典当，只为换纯水
    mirror: {
      when: 'day',
      item: { id: 'bronze_mirror', extra: { q: 78, fake: false } },
      text: () => '一个白衣女子进门，鬓边别着几朵金盏白瓣的水仙，先对着柜上的铜镜照了照，才把怀里一面古镜放到柜上：'
        + '“吾照了它三百年，舍不得——可吾的花要谢了。小掌柜，换些九十九成以上的灵泉水给吾，镜子你拿去。”'
        + (lingboWater() ? '' : '\n（你铺里眼下没有这样纯的水。）'),
      choices: () => {
        const w = lingboWater();
        return [
          ...(w ? [{ label: `拿${itemName(w)}换她的铜镜`, hint: `失去一份好水，得一面古镜；她记你的好`, run: (st, p) => {
            takeItem(w); keepCounterItem({ cost: 0, boughtDay: S.day }); goodDeed(p, 1);
            remember(p, '你用一份纯水换了她的铜镜，她的花缓过来了。', 18, 'fair'); st.flags.watered = 1;
            return { text: '她捧着水瓶，指尖在瓶身上转了一圈，鬓边的花一点点舒展开：“镜子归你了。替吾照好它。”', go: ['dan', [3, 5]], summary: '你用纯水换下了凌波的铜镜。', mood: 'pleased' };
          } }] : []),
          { label: '收下铜镜，给她三百灵石去别处买水', hint: costHint(300), req: needStones(300), run: (st, p) => {
            spend(300, '收下凌波的青铜古镜。'); keepCounterItem({ cost: 300, boughtDay: S.day });
            remember(p, '你收了她的铜镜，给了她三百灵石。', 6, 'fair');
            return { text: '“灵石……”她把灵石拢进袖里，又回头看了铜镜一眼，“也行。”', go: ['dan', [3, 5]], summary: '你收下了凌波的铜镜。' };
          } },
          { label: '镜子你留着，水赊给你', hint: '不收货；往后她还你', run: (st, p) => {
            goodDeed(p, 2); remember(p, '你没收她的镜子，让她先去买水。', 12, 'helped'); st.flags.owes = true;
            return { text: '她愣了一下，把镜子抱回怀里：“吾记着。三百年来，头一回有人不图吾这面镜子。”', go: ['dan', [3, 5]] };
          } },
        ];
      },
    },

    // 丹房执事上门：要一株三百年的水仙花球炼驻颜丹
    dan: {
      when: 'day',
      who: () => LINGBO_DAN,
      text: () => '一位丹房执事掀帘进门，衣袖上沾着药渣：“丹房缺一味三百年的水仙花球，炼驻颜丹的君药。听说杂役区有株成了精的——你可知她在哪儿？”'
        + '\n“报个信，丹房赏两百；替她瞒着，丹房的生意你往后就别想做了。”',
      choices: () => [
        { label: '说不知道', hint: `撒谎；被看穿则丹房交情 -10${condText('me') ? `（${condText('me').replace(/。$/, '')}，更容易露馅）` : ''}`, run: st => {
          if (lieCaught(0.4)) { shiftSt('dan', -10); st.flags.suspect = true; return { text: '执事看了你半晌：“行。丹房记着。”', go: ['night', [1, 2]], mood: 'angry' }; }
          return { text: '执事“嗯”了一声，走了。', go: ['night', [1, 2]] };
        } },
        { label: '说她早出城了', hint: '花 50 灵石打点，买个准话', req: needStones(50), run: () => {
          spend(50, '打点丹房执事。');
          return { text: '执事掂了掂灵石：“出城了？那就算了。”', go: ['night', [1, 2]] };
        } },
        { label: '告诉他她常在哪个水井边照影子', hint: '+200 灵石；丹房交情 +10；妖族声望 -8', sin: ['betray', 2], run: (st, p) => {
          earn(200, '把凌波的去处卖给丹房。'); shiftSt('dan', 10); adjustRep('yao', -8);
          remember(p, '你把她常去的水井告诉了丹房。', -100, 'betrayed');
          lifeNote(p, '花球被丹房挖了去，炼了驻颜丹。'); p.status = 'gone';
          return { text: '三天后，丹房出了一炉驻颜丹，香得半条街都闻得见。\n水井边，只剩一面没人照的水。', end: true, summary: '你把凌波卖给了丹房。', mood: 'pleased' };
        } },
      ],
    },

    // 当夜：她要把花球寄在你铺里
    night: {
      when: 'night',
      cond: (st, p) => p.status === 'alive',
      mood: 'afraid',
      text: st => '夜里，凌波抱着一只盛水的石盆来敲门，盆里卧着一颗白生生的花球：“丹房的人在井边转了两天了。吾把根寄在你这儿——人不在，根在，吾就死不了。”'
        + (st.flags.suspect ? '\n你想起丹房执事那句“丹房记着”。' : ''),
      choices: st => [
        { label: '把石盆藏好', hint: `执事若起了疑会来搜${S.grids.hidden ? '（有暗格，稳些）' : ''}`, run: (st, p) => {
          goodDeed(p, 2); remember(p, '你替她藏了花球。', 20, 'helped');
          if (st.flags.suspect && hideRoll(0.5)) {
            shiftSt('dan', -8); addHeat(5); addCond(p, 'injured', 2, '花球被挖');
            return { text: '天没亮，丹房的人踹开了后门，从柜台底下端走了石盆。\n凌波没再来过。后来听说，她在城外的河边扎了根，花开得很小。', end: true, summary: '丹房从你铺里搜走了凌波的花球。' };
          }
          return { text: '你把石盆塞进了库房最里头。半夜，盆里冒出一点嫩绿的芽。', go: ['bloom', [5, 8]], summary: '你替凌波藏了花球。', mood: 'pleased' };
        } },
        { label: '劝她出城，送她一瓶好水上路', hint: `${lingboWater() ? '失去一份纯水' : costHint(60)}；妖族声望 +5`, req: () => !!lingboWater() || S.stones >= 60 || '没有纯水，也凑不出 60 灵石', run: (st, p) => {
          const w = lingboWater(); if (w) takeItem(w); else spend(60, '给凌波买水上路。');
          adjustRep('yao', 5); goodDeed(p, 2); remember(p, '你送她出了城，还给了她一瓶好水。', 18, 'helped');
          lifeNote(p, '出城去了南边的湖。'); p.status = 'gone';
          return { text: '她抱着石盆走进夜色里，回头说：“南边有片湖，吾去那儿开花。你来，吾照给你看。”', end: true, summary: '你送凌波出了城。' };
        } },
        { label: '不想惹丹房', run: (st, p) => {
          remember(p, '那晚你没收她的花球。', -12);
          return { text: '她抱着石盆站了很久，走了。', end: true, summary: '那晚你没收下凌波的花球。' };
        } },
      ],
    },

    // 风头过去：花开了，她来还情
    bloom: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      mood: 'pleased',
      text: st => '凌波来了，鬓边的水仙开得比哪一回都盛。她把一面新磨的铜镜放在柜上，照了照自己，才转过来：'
        + '“根养好了。这是吾谢你的——两瓶花露，添进丹炉，驻颜丹一炉出两颗；走火入魔了，喝一口也能镇住。”'
        + (st.flags.owes ? '\n“上回赊的水钱，也一并算上。”' : ''),
      choices: () => [
        { label: '收下', hint: '得两瓶水仙花露、一份琼浆玉露；她往后替你看着丹房的风声', run: (st, p) => {
          giveItem('narcissus_dew', { q: 92 }); giveItem('narcissus_dew', { q: 92 }); giveItem('water', { purity: 99.95, q: 90 }); p.informant = true; adjustRep('yao', 5);
          remember(p, '你收下了她的谢礼。', 10);
          let tail = '她临走前在你的水缸里点了一滴花露。第二天，缸里的水清得照得见人影。';
          // 够强才有：她带来丹房的独门方子
          if (strongEnough() && Math.random() < 0.35) {
            makeIntel('clique', { cid: 'dan' });
            tail += '\n她还留下一张纸：“丹房那炉驻颜丹的底细——吾的同族，替吾记着呢。”';
          }
          lifeNote(p, '花开了，常来铺子里照镜子。');
          return { text: tail, end: true, summary: '凌波的花开了，她常来你铺子里。' };
        } },
      ],
    },
  },
});
