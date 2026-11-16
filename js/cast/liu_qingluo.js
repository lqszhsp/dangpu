// 柳青萝：游方蛇医。拿本钱价收药，去救丹房见死不救的杂役；丹房容不下她——帮她要掏钱、要得罪人，卖了她换丹房的交情
'use strict';

defineCharacter({
  id: 'liu_qingluo', name: '柳青萝', faction: 'yao', sex: 'f', title: '游方蛇医',
  portrait: 'yao_snake',
  bio: '化形多年的青蛇，在杂役区后巷支了个草棚给人看病，不收诊金。丹房的人说她抢生意，杂役们说她是活菩萨。',
  intro: '一个替杂役看病、跟你讨本钱药材的蛇妖。',
  savvy: 0.6, power: 32, eye: 2,
  traits: { greed: 0.15, integrity: 0.8, caution: 0.6, wish: 'herb_blood' },
  start: { day: 6, node: 'herbs', chance: 0.5 },
  regular: true,
  // 懂医术：结识后可在「人物」页或点状态求诊；fee 是每重伤毒的底价
  healer: { heals: ['injured', 'poisoned'], fee: 20 },
  lines: {
    first: '（她舌尖轻轻一吐，像在尝空气里的味道）小掌柜，你这儿有药草的香气。',
    neutral: ['小掌柜，又来叨扰。', '后巷又多了几个躺着的，吾来看看你这儿有什么。'],
    warm: ['小掌柜，草棚里的人都念着你。', '你这铺子，是这条街上唯一不吃人的地方。'],
    close: ['小掌柜，往后谁病了，报吾的名字。', '吾欠你的，吾记着。'],
    cold: '买药，不说别的。',
    hostile: '……你卖过吾一次，吾不会忘。',
    buy: ['有{cat}么？要救命用的。', '吾要些{cat}，价钱你说，别太狠。'],
    sell: '山里采的{item}，{ask} 灵石，你收么？',
  },
  command: { label: '令她替杂役看病，收买人心', run: () => { adjustRep('ren', 8); return '柳青萝的草棚前排起了长队，人人都知道药是从你铺子里出的。'; } },
  on: {
    // 在你这儿按平价买到救命的药，也算帮了她
    sold: (st, p, it, price) => {
      if (['herb_blood', 'herb_dew', 'pill_qi', 'vine_fruit'].includes(it.id) && price <= knownValue(it) * priceMul(it.id)) st.flags.helped = (st.flags.helped || 0) + 1;
    },
    death: (st, p) => { adjustRep('ren', -8); log('柳青萝死了。后巷草棚里的病人，没人管了。', 'loss'); },
  },

  nodes: {
    herbs: {
      when: 'day',
      text: (st, p) => {
        const has = owns('herb_blood') || owns('herb_dew');
        const lead = st.flags.visits ? '柳青萝又来了，衣摆上沾着草棚里的药渣。' : '一个青衣女子走进铺子，瞳仁细长如线，颈侧隐隐有几片青鳞。';
        return `${lead}\n“后巷那几个矿上下来的，丹房一颗回气丹要三十灵石，他们三个月的工钱。”她把一小袋碎灵石放在柜上，“${has ? '你有血灵芝、凝露草——按本钱卖给吾，行么？' : '你若收到血灵芝、凝露草，替吾留着，按本钱。'}”`;
      },
      choices: (st, p) => {
        const herb = owns('herb_blood') || owns('herb_dew');
        const again = () => (st.flags.visits = (st.flags.visits || 0) + 1, (st.flags.helped || 0) >= 2 || st.flags.visits >= 3 ? ['envoy', [3, 5]] : ['herbs', [3, 5]]);
        if (!herb) return [
          { label: '答应替她留着', run: () => { remember(p, '你答应按本钱替她留药。', 5); return { text: '“说定了。”她的瞳仁微微缩了一下，像是笑了。', go: again() }; } },
          { label: '送她 50 灵石去买药', hint: costHint(50), req: needStones(50), run: () => {
            spend(50, '送柳青萝 50 灵石买药。'); goodDeed(p, 2); st.flags.helped = (st.flags.helped || 0) + 1;
            remember(p, '你送了她五十灵石，让她去买药。', 18, 'helped');
            return { text: '她愣了愣，把灵石收进袖子，冲你行了个人族的礼。', go: again(), summary: '你接济过她的草棚。' };
          } },
          { label: '我这儿不是善堂', run: () => { remember(p, '你说你这儿不是善堂。', -6); return { text: '“也对。”她点点头，走了。', go: again() }; } },
        ];
        const name = itemName(herb), cost = Math.round(ITEMS[herb.id].base * 0.6), full = Math.round(knownValue(herb) * priceMul(herb.id));
        return [
          { label: `按本钱卖给她（${cost} 灵石）`, hint: `比市价少赚 ${full - cost}`, run: () => {
            takeItem(herb); earn(cost, `按本钱把${name}卖给柳青萝。`); goodDeed(p, 1); st.flags.helped = (st.flags.helped || 0) + 1;
            remember(p, `你按本钱卖给她${name}。`, 12, 'cheap');
            return { text: '她把药草揣进怀里，转身就走，走到门口又回头：“草棚里有三个人，今晚能睡着了。”', go: again() };
          } },
          { label: `白送给她`, hint: `失去${name}`, run: () => {
            takeItem(herb); goodDeed(p, 3); st.flags.helped = (st.flags.helped || 0) + 2;
            remember(p, `你把${name}白送给了她。`, 22, 'helped');
            return { text: '她盯着你看了很久：“人族里，也有你这样的。”', go: again(), summary: '你白送过她救命的药。' };
          } },
          { label: `照市价（${full} 灵石）`, run: () => {
            takeItem(herb); earn(full, `把${name}卖给柳青萝。`);
            remember(p, `你照市价卖给她${name}。`, 0);
            return { text: '她数灵石数得很慢，数完，袋子空了。', go: again() };
          } },
        ];
      },
    },

    envoy: {
      when: 'day',
      who: () => ({ name: '丹房执事', portrait: 'ren_cultivator', title: '丹房执事', faction: 'mo' }),
      text: (st, p) => `一个穿丹房袍子的中年人把一锭银子似的灵石压在柜上：“后巷那条青蛇，药是从你这儿出的吧？”\n“丹房的丹药卖不动，长老很不高兴。她在哪儿落脚，你说出来，这锭灵石归你，丹房也记你一份交情。”${(st.flags.helped || 0) >= 2 ? '\n他顿了顿，“当然，你也可以接着做善人——丹房的门，往后就别进了。”' : ''}`,
      choices: (st, p) => [
        { label: '说出她的落脚处', sin: ['betray', 3], hint: '+200 灵石；丹房好感 +20；善名大跌', run: () => {
          earn(200, '向丹房出卖柳青萝的落脚处。'); shiftSt('dan', 20);
          st.flags.sold = true;
          return { text: '执事满意地走了。傍晚，后巷传来一阵骚动。', go: ['raid', 0], summary: '你把她的落脚处卖给了丹房。' };
        } },
        { label: '塞钱打发执事，替她遮掩', hint: costHint(80), req: needStones(80), run: () => {
          spend(80, '打点丹房执事，替柳青萝遮掩。'); shiftSt('dan', -5); goodDeed(p, 2);
          remember(p, '丹房找上门，你花钱替她遮掩了过去。', 20, 'helped');
          return { text: '执事掂了掂灵石：“这回就算了。”他出门前看了你一眼，“善人，在杂役区活不长。”', go: ['plague', [4, 7]] };
        } },
        { label: '说不知道', hint: '丹房好感 -10', run: () => {
          shiftSt('dan', -10);
          return { text: '“不知道？”执事冷笑一声，“那就慢慢想。”', go: ['plague', [4, 7]] };
        } },
      ],
    },

    raid: {
      when: 'night',
      text: (st, p) => '后巷火光冲天。你从门缝里看见丹房的人把草棚掀翻，病人被拖到雨里。\n柳青萝被铁链锁着拖过你门前，她抬起头，细长的瞳仁对上了你的眼睛。',
      choices: (st, p) => [
        { label: '关上门', run: () => {
          p.status = 'jailed'; lifeNote(p, '被丹房锁拿，剖了蛇胆入药。');
          remember(p, '你把她卖给了丹房。', -100, 'betrayed');
          adjustRep('ren', -6); adjustRep('yao', -10);
          const r = pick(['dan_guide', 'pill_recipe']);
          giveItem(r);
          return { text: `第二天，丹房送来一件${ITEMS[r].name}，说是长老的谢礼。后巷的草棚再没搭起来过。`, end: true, summary: '你出卖了她；丹房记了你一份交情，杂役区记了你一笔账。' };
        } },
        { label: '冲出去，动手抢人', hint: `成算约 ${Math.round(trialOdds(48) * 100)}%（${condText('me') || '你状态尚好'}）；败了重伤${deathWarn('injured')}`, run: () => {
          const t = trial('me', 48);
          if (t.ok) {
            addHeat(15); shiftSt('dan', -25); karmaShift(4);
            remember(p, '你出卖了她，又在雨里拼了命把她抢了回来。', 25);
            return { text: '你抄起门闩冲进雨里，砸翻了两个丹房弟子。柳青萝挣开铁链，拖着你钻进了水渠。\n天亮时她替你包扎伤口，一句话也没说，只是手很轻。', end: true, summary: '你卖了她，又冒死把她抢了回来。' };
          }
          addCond('me', 'injured', 2, '冲进丹房的人堆里抢人'); addHeat(10);
          p.status = 'jailed'; lifeNote(p, '被丹房锁拿，剖了蛇胆入药。');
          remember(p, '你出卖了她，又想救她，没救成。', -40);
          return { text: '你冲出去不到三步，就被一棍砸翻在泥水里。柳青萝回头看了你一眼，被拖进了夜色。', end: true, summary: '你卖了她，想救没救成，自己也被打成重伤。' };
        } },
        { label: '冲出去，拿灵石赎她', hint: '-300 灵石；丹房好感 -20', req: needStones(300), run: () => {
          spend(300, '从丹房手里赎回柳青萝。'); shiftSt('dan', -20); karmaShift(6);
          remember(p, '你出卖了她，又在雨里把她赎了回来。', 10);
          return { text: '丹房的人收了灵石，松开铁链。柳青萝一言不发，扶起一个病人走进雨里。', end: true, summary: '你卖了她，又赎了她。她什么也没说。' };
        } },
      ],
    },

    plague: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      text: (st, p) => '杂役区闹起了尸疫，丹房的回气丹涨到了六十灵石一颗。\n柳青萝冲进铺子，眼睛熬得通红：“吾配得出解药，缺两颗回气丹做药引——或者一百灵石，吾自己去鬼市买。草棚里躺着十几个人。”'
        + (hasCond('me', 'poisoned') || hasCond('me', 'injured') ? `\n她看了你一眼，眉头一皱：“你也${condSev('me', 'poisoned') ? '中了毒' : '带着伤'}。”` : ''),
      choices: (st, p) => {
        const pills = Object.values(S.items).filter(it => HELD(it) && it.id === 'pill_qi' && !it.fake);
        const list = [];
        // 你身上有伤毒：交情够，她先治你；交情不够，开价
        if (hasCond('me', 'poisoned') || hasCond('me', 'injured')) list.push(p.aff >= 25
          ? { label: '请她顺手替你治一治', hint: '治好你身上的伤与毒；不收钱', run: () => {
              cureCond('me', 'poisoned'); cureCond('me', 'injured');
              remember(p, '尸疫那年，她顺手治好了你。', 5);
              return { text: '她三两下扎了针，又塞给你一包药粉：“含着，别咽。”\n一盏茶后，你吐出一口黑血，浑身轻了。她已经走了。', go: ['plague', 0] };
            } }
          : { label: '请她替你治伤（60 灵石）', hint: '她不欠你什么，照价收钱', req: needStones(60), run: () => {
              spend(60, '请柳青萝治伤。'); cureCond('me', 'poisoned'); cureCond('me', 'injured');
              return { text: '她收了灵石，下针很快，一句话也没多说。', go: ['plague', 0] };
            } });
        if (pills.length >= 2) list.push({ label: '给她两颗回气丹', hint: '失去两颗回气丹', run: () => {
          pills.slice(0, 2).forEach(takeItem); goodDeed(p, 4); st.flags.saved = true;
          remember(p, '尸疫那年，你给了她救命的药引。', 25, 'helped');
          return { text: '她抓起丹药就跑。三天后，后巷没有再抬出死人。', go: ['repay', [4, 6]], summary: '尸疫那年，你给了她救命的药引。' };
        } });
        list.push({ label: '给她一百灵石', hint: costHint(100), req: needStones(100), run: () => {
          spend(100, '资助柳青萝配尸疫解药。'); goodDeed(p, 4); st.flags.saved = true;
          remember(p, '尸疫那年，你给了她一百灵石配药。', 25, 'helped');
          return { text: '她攥着灵石冲进雨里。三天后，后巷没有再抬出死人。', go: ['repay', [4, 6]], summary: '尸疫那年，你资助她配了解药。' };
        } });
        list.push({ label: '趁疫情高价收她的蛇蜕药材', sin: ['fraud', 1], hint: '+120 灵石；她会恨你', run: () => {
          earn(120, '趁疫情压价收了柳青萝的蛇蜕。');
          remember(p, '尸疫那年，你趁火打劫。', -50, 'gouged');
          lifeNote(p, '尸疫过后，离开了杂役区。');
          p.status = 'gone';
          return { text: '她把蛇蜕扔在柜上，拿了灵石就走。那一年，后巷死了很多人。', end: true, summary: '尸疫那年，你趁火打劫。她走了。' };
        } });
        return list;
      },
    },

    repay: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      text: (st, p) => '一群杂役挤在你门口，手里捧着鸡蛋、粗布、一包包晒干的草药。柳青萝站在他们后面。\n“他们没什么能给你的，”她说，“吾有。”',
      choices: (st, p) => [
        { label: '收下', run: () => {
          adjustRep('ren', 10);
          // 好人好报：只有你够强，她才肯把真正的底牌押在你身上
          if (strongEnough() && Math.random() < 0.4) {
            adjustRep('yao', 25); giveItem('soul_crystal', { q: 90 }); S.flags.savior = (S.flags.savior || 0) + 1;
            lifeNote(p, '回到青蛇一族，接任了族长。');
            return { text: '她褪下颈侧一片青鳞放在你掌心：“吾是青蛇一族的少主。这片鳞在，妖族认你为友；哪天你大难临头，捏碎它。”\n她又放下一块魂晶，“这是族里给恩人的谢礼。”', end: true, summary: '她是青蛇一族的少主。妖族从此认你为友，你手里多了一道护身符。' };
          }
          p.informant = true; giveItem('vine_fruit', { q: 85 }); giveItem('vine_fruit', { q: 85 });
          return { text: '她把两枚血藤果放在柜上：“后巷的耳朵，往后替你听着。”', end: true, summary: '尸疫过后，杂役区的人都知道你的好；柳青萝成了你的耳目。' };
        } },
      ],
    },
  },
});
