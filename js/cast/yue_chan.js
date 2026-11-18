// 月婵：醉月楼的头牌舞姬，修了三百年的玉兔，被一位长老亲眷包下，满头金钗却出不得楼门。
// 她偷偷变卖贵人的赏赐攒赎身钱——帮她要得罪少宗主一系，卖她能讨那位公子的欢心
'use strict';

const CHAN_PATRON = { name: '慕容公子', portrait: 'noble', title: '长老亲眷', faction: 'mo' };

defineCharacter({
  id: 'yue_chan', name: '月婵', faction: 'yao', sex: 'f', title: '兔妖舞姬',
  portrait: 'yue_chan',
  // 成年女子；兔族驻颜有术，看上去二十出头。勾人，但雅致不露骨
  art: 'an alluring rabbit-spirit dancer, an adult woman who looks about 22: long upright white rabbit ears with soft pink inner fur, ruby-red eyes, '
    + 'flawless luminous porcelain skin, red lips, a small beauty mark at the corner of her mouth, long glossy black hair in a loose elaborate updo '
    + 'with gold hairpins and a crescent-moon ornament, a graceful curvy figure, a layered sheer white and moon-silver silk dancer dress with pink trim, '
    + 'worn off the shoulders, long flowing sleeves, a side slit in the skirt, a small fluffy white tail, holding a round silk fan near her chin, '
    + 'a playful flirtatious stance, elegant and tasteful, not explicit',
  bio: '杂役区醉月楼的头牌舞姬，修了三百年的玉兔。脸上看不出半点岁月——兔族最舍得在驻颜上下本钱。她被一位长老亲眷包了下来，金钗玉佩戴满头，却连楼门都出不得。',
  intro: '一个拿贵人赏的衣裳来换现钱的兔妖舞姬。',
  savvy: 0.7, power: 30, eye: 2,
  traits: { greed: 0.6, integrity: 0.35, caution: 0.6, wish: 'zhuyan_dan', budgetMul: 1.4 },
  start: { day: 10, node: 'robe', chance: 0.4, cond: () => ART_SET.has('chars/yue_chan') },   // 立绘装好才登场
  regular: true,
  lines: {
    first: '（团扇半遮着脸，一双红眼睛从扇沿上打量你）小掌柜，你这铺子，倒比楼里清净。',
    neutral: ['小掌柜，又来叨扰啦。', '（她把团扇往柜上一搁）今儿有什么新鲜的？'],
    warm: ['小掌柜，楼里的姐妹都说你是个实诚人。', '（她冲你眨了眨眼）给吾留着好东西没有？'],
    close: ['这条街上，吾就信你一个。', '小掌柜，往后谁欺负你，告诉吾。'],
    cold: '买东西，别的不谈。',
    hostile: '（扇子挡住了脸）你卖过吾一回，吾记得清清楚楚。',
    buy: ['有{cat}么？要最好的。', '吾要些{cat}，价钱不是问题——别让人知道是吾买的。'],
    sell: '这件{item}，{ask} 灵石。别问是谁送的。',
  },
  on: {
    // 在你这儿按平价买到驻颜丹，也算帮了她一把
    sold: (st, p, it, price) => { if (it.id === 'zhuyan_dan' && price <= knownValue(it) * priceMul(it.id)) st.flags.kind = (st.flags.kind || 0) + 1; },
    death: (st, p) => { log('醉月楼换了头牌。没人说得清月婵去了哪儿。', 'loss'); },
  },

  nodes: {
    // 头一回：拿贵人赏的云锦法衣来换现钱，不许多问
    robe: {
      when: 'day',
      item: { id: 'cloud_robe', extra: { q: 80 } },
      text: () => '一个女子摇着团扇进门，一对雪白的兔耳从发髻间竖起来，裙摆一走一漾。她把一件云锦法衣往柜上一铺：'
        + '“慕容公子赏的，吾只穿过一回。小掌柜收不收？价钱好说——只是别问它从哪儿来，也别让人知道是吾卖的。”',
      choices: () => {
        const it = customerItem(), full = it ? Math.round(knownValue(it) * priceMul(it.id)) : 700;
        const fair = Math.round(full * 0.7), low = Math.round(full * 0.4);
        return [
          { label: `照七成收下，替她瞒着（${fair} 灵石）`, hint: costHint(fair), req: needStones(fair), run: (st, p) => {
            spend(fair, '收下月婵的云锦法衣。'); st.flags.robe = (keepCounterItem({ cost: fair, boughtDay: S.day }) || {}).uid;
            remember(p, '你照七成收了她的法衣，一句没多问。', 15, 'fair');
            return { text: '她把灵石收进袖里，团扇在你手背上轻轻一点：“小掌柜，是个懂事的。”', go: ['patron', [3, 5]], summary: '你替月婵出手了一件云锦法衣。', mood: 'pleased' };
          } },
          { label: `压到四成收（${low} 灵石），顺口问她急什么`, hint: `${costHint(low)}；她会说出缘由，也会记着你压价`, req: needStones(low), run: (st, p) => {
            spend(low, '压价收下月婵的云锦法衣。'); st.flags.robe = (keepCounterItem({ cost: low, boughtDay: S.day }) || {}).uid;
            remember(p, '你趁她着急，把法衣压到了四成。', -6, 'lowballed'); st.flags.asked = true;
            return { text: '她笑意淡了些，还是收了灵石：“急什么？攒钱赎身呀。笼子再金贵，也是笼子。”', go: ['patron', [3, 5]], summary: '你压价收了月婵的法衣，知道了她在攒赎身钱。' };
          } },
          { label: '不收，劝她别惹那位公子', hint: '不沾这件事', run: (st, p) => {
            remember(p, '你劝她别惹慕容公子。', 3); st.flags.refused = true;
            return { text: '“劝吾的人多了。”她把法衣搭回臂弯，“你是头一个不图吾什么的。”', go: ['patron', [3, 5]] };
          } },
        ];
      },
    },

    // 包她的公子找上门：问她卖了什么、说了什么
    patron: {
      when: 'day',
      who: () => CHAN_PATRON,
      text: st => {
        const robe = st.flags.robe && S.items[st.flags.robe] && HELD(S.items[st.flags.robe]);
        return '一位锦衣公子摇着折扇进门，身后跟着两个家奴：“听说醉月楼的月婵来过你这儿？她卖了什么、换了多少、说了什么——一五一十告诉本公子。”'
          + (robe ? '\n他的扇子停在半空：“那件云锦，本公子认得。”' : '');
      },
      choices: st => {
        const robe = st.flags.robe && S.items[st.flags.robe] && HELD(S.items[st.flags.robe]) ? S.items[st.flags.robe] : null;
        return [
          { label: '什么都没看见', hint: `撒谎；被看穿则少宗主一系交情 -8、关注 +5${robe ? '，法衣被收走' : ''}${condText('me') ? `（${condText('me').replace(/。$/, '')}，更容易露馅）` : ''}`, run: () => {
            if (lieCaught(robe ? 0.6 : 0.3)) {
              shiftSt('heir', -8); addHeat(5); if (robe) takeItem(robe);
              st.flags.covered = true;
              return { text: `他冷笑一声，扇子往柜上一敲：“好一张嘴。”${robe ? '家奴把那件云锦从你柜里拎了出去。' : ''}`, go: ['night', [1, 2]], mood: 'angry' };
            }
            st.flags.covered = true;
            return { text: '他盯着你看了一会儿，“哼”了一声，摇着扇子走了。', go: ['night', [1, 2]] };
          } },
          ...(robe ? [{ label: '把法衣还给他，照实说', hint: '失去法衣，得赏 100 灵石；少宗主一系交情 +6；她会知道', run: (st, p) => {
            takeItem(robe); earn(100, '慕容公子赏的封口钱。'); shiftSt('heir', 6);
            remember(p, '你把她卖的法衣交给了慕容公子。', -30, 'betrayed'); st.flags.told = true;
            return { text: '他把法衣搭在家奴臂上，丢下一袋灵石：“识时务。”', go: ['night', [1, 2]], mood: 'pleased' };
          } }] : []),
          { label: '告诉他：她在攒钱赎身，想逃', hint: '+200 灵石；少宗主一系交情 +10', sin: ['betray', 2], run: (st, p) => {
            earn(200, '把月婵的打算卖给了慕容公子。'); shiftSt('heir', 10);
            remember(p, '你把她攒钱赎身的事告诉了慕容公子。', -100, 'betrayed');
            addCond(p, 'injured', 2, '被慕容公子的家奴教训'); lifeNote(p, '被关进了醉月楼的后楼，不许再见客。'); p.status = 'gone';
            return { text: '他的扇子“啪”地合上：“三百年的兔子，还想翻出本公子的手心？”\n三天后，醉月楼换了头牌。', end: true, summary: '你把月婵要逃的事卖给了慕容公子。', mood: 'pleased' };
          } },
        ];
      },
    },

    // 当夜：她拿那位公子的把柄来换赎身钱
    night: {
      when: 'night',
      cond: (st, p) => p.status === 'alive',
      text: st => '打烊后，有人在门板上轻轻叩了三下。月婵披着一件不起眼的灰斗篷，兔耳压在兜帽里：'
        + (st.flags.told ? '“你把吾卖了一半，吾还是来了——这条街上，只有你的铺子还亮着灯。”' : '“小掌柜，那位公子来过了吧？多谢你。”')
        + '\n“赎身要三百灵石，吾还差这些。”她从袖里抽出一卷纸，“慕容家的一笔烂账——够他在宗门里喝一壶的。借吾钱，这个归你；不借，这个也能卖给你。”',
      choices: () => [
        { label: '借她三百灵石赎身', hint: `${costHint(300)}；她答应日后连本带利还`, req: needStones(300), run: (st, p) => {
          spend(300, '借给月婵三百灵石赎身。'); goodDeed(p, 3); makeIntel('clique', { cid: 'heir' });
          remember(p, '你借了她三百灵石赎身。', 30, 'helped'); st.flags.freed = true;
          lifeNote(p, '赎了身，出了醉月楼。');
          return { text: '她把那卷纸塞进你手里，兜帽下的兔耳抖了抖：“三百年了，头一回有人不图吾这张脸，只图吾的账。”', go: ['after', [5, 8]], summary: '你借钱让月婵赎了身。', mood: 'pleased' };
        } },
        { label: '只买那份烂账（150 灵石）', hint: `${costHint(150)}；得一份派系内幕，她留在楼里`, req: needStones(150), run: (st, p) => {
          spend(150, '买下月婵手里慕容家的烂账。'); makeIntel('clique', { cid: 'heir' });
          remember(p, '你买了她的账，没借她钱。', 2);
          return { text: '她把纸卷递过来，指尖在你掌心停了一瞬：“也好。生意就是生意。”', end: true, summary: '你买了月婵的内幕，她还在醉月楼里。' };
        } },
        { label: '这浑水我不蹚', hint: '不沾这件事', run: (st, p) => {
          remember(p, '那晚你没开门。', -8);
          return { text: '叩门声停了。脚步声往巷子深处去了。', end: true, summary: '那晚你没给月婵开门。' };
        } },
      ],
    },

    // 赎身之后：她回来还钱，也带来了生意
    after: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      mood: 'pleased',
      text: () => '月婵换了一身素净的衣裳，头上只剩一根木簪，兔耳却竖得比从前精神。她把一袋灵石放在柜上：'
        + '“三百，再加一百利钱。吾在南街支了个茶摊——楼里那些姐妹、那些贵客的闲话，往后都往你这儿送。”',
      choices: () => [
        { label: '收下', hint: '+400 灵石；她成了你的耳目', run: (st, p) => {
          earn(400, '月婵还来三百灵石，外加一百利钱。'); p.informant = true;
          remember(p, '你收下了她的利钱，从此她替你打听消息。', 10);
          let tail = '她冲你行了个人族的礼，团扇一摇，走了。';
          // 够强才有的好报：她当年的老主顾里，有人管着铺契
          if (strongEnough() && Math.random() < 0.35) {
            S.flags.deedMul *= 0.9;
            tail += '\n半个月后，管事见了你，客客气气地说铺契的价钱可以再商量——听说是哪位常去南街茶摊的老爷递了句话。';
          }
          return { text: tail, end: true, summary: '月婵赎了身，在南街开了茶摊，替你打听消息。' };
        } },
        { label: '利钱就免了', hint: '+300 灵石；善名 +2；交情更深', run: (st, p) => {
          earn(300, '月婵还来三百灵石。'); goodDeed(p, 2); p.informant = true;
          remember(p, '你免了她的利钱。', 20, 'helped');
          return { text: '她愣了愣，团扇遮住了半张脸，只露出一双红眼睛弯了弯：“小掌柜，你这样的人，在这条街上活不长的。吾替你看着点。”', end: true, summary: '月婵赎了身，你免了她的利钱。' };
        } },
      ],
    },
  },
});
