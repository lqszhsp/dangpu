// 曼殊：乱葬岗边上长了五百年的曼陀罗花妖。她的花粉是迷魂花的祖宗，执法堂按魔宗禁药缉她；
// 她拿花粉换安身的地方——收了来钱快，被搜出来是重罪；举报她，执法堂记你一功
'use strict';

const MANSHU_LAW = { name: '执法堂巡查', portrait: 'mo_enforcer', title: '执法堂', faction: 'mo' };

defineCharacter({
  id: 'man_shu', name: '曼殊', faction: 'yao', sex: 'f', title: '曼陀罗花妖',
  portrait: 'man_shu',
  // 成年女子；花妖驻颜，看上去二十出头。妖冶、危险，雅致不露骨
  art: 'a datura flower spirit, an adult woman who looks about 23: a strikingly beautiful bewitching face with pale skin, heavy-lidded violet eyes with dark purple eyeliner, '
    + 'dark plum lips, long black hair loosely braided with large trumpet-shaped white and deep-violet datura flowers, a layered deep violet and black silk gown '
    + 'with trailing sleeves embroidered with datura blossoms, worn off one shoulder, a faint shimmer of pale golden pollen in the air near her fingertips, '
    + 'a languid, dangerous, mysterious smile, elegant and tasteful, not explicit',
  bio: '乱葬岗边上长了五百年的曼陀罗，化形后在杂役区游荡。她的花粉闻一口飘飘欲仙，多闻几口就醒不过来——执法堂按魔宗禁药缉她。',
  intro: '一个提着一小罐花粉来换安身之所的曼陀罗花妖。',
  savvy: 0.75, power: 34, eye: 2,
  traits: { greed: 0.5, integrity: 0.3, caution: 0.7, wish: 'incense', budgetMul: 1.2 },
  start: { day: 12, node: 'pollen', chance: 0.4, cond: () => ART_SET.has('chars/man_shu') },   // 立绘装好才登场
  regular: true,
  lines: {
    first: '（她一进门，铺子里就飘起一股甜得发腻的香）小掌柜，你的铺子……有股好闻的胆子味。',
    neutral: ['小掌柜，又见面了。', '（她倚着柜台，花瓣在发间一张一合）今天收什么？'],
    warm: ['小掌柜，你闻着不怕吾。', '这条街上，就你这儿吾能睡个安稳觉。'],
    close: ['谁跟你过不去，告诉吾，吾去他梦里坐坐。', '五百年了，你是头一个不怕吾的人。'],
    cold: '买卖，别的不谈。',
    hostile: '（她身上的香一下子冷了）你把吾卖给了执法堂。',
    buy: ['有{cat}么？要够劲的。', '吾想要{cat}，别问做什么。'],
    sell: '这件{item}，{ask} 灵石。闻了别怕。',
  },
  on: {
    death: () => { log('乱葬岗边那片曼陀罗一夜之间全枯了。', 'loss'); },
  },

  nodes: {
    // 头一回：一罐花粉换一个藏身处
    pollen: {
      when: 'day',
      text: () => '一个黑衣女子倚在门边，发间别着几朵喇叭似的紫白大花。她把一只小陶罐放在柜上，罐口溢出一点金粉，甜香冲得你脑袋一晕：'
        + '“曼陀罗花粉，吾自己的。掺进酒里、丹里，叫人睡一夜、梦里有问必答——谁藏着什么身份，你一问便知。”'
        + '\n“吾不要灵石。执法堂在缉吾，借你的库房躲些日子，这罐归你。”',
      choices: () => [
        { label: '收下，让她在库房后头躲着', hint: '得三罐曼陀罗花粉（禁药）；执法堂关注 +5；她若被搜出，你是窝藏', run: (st, p) => {
          for (let i = 0; i < 3; i++) giveItem('datura_pollen', { q: 85 });
          addHeat(5); remember(p, '你让她在你的库房里躲着。', 20, 'helped'); st.flags.hid = true;
          return { text: '她冲你眨了眨眼，钻进库房后头。那股甜香在铺子里绕了一整天。', go: ['raid', [2, 4]], summary: '你收留了曼殊，收下了她的花粉。', mood: 'pleased' };
        } },
        { label: '花粉收下，人不留（80 灵石）', hint: `${costHint(80)}；得两罐曼陀罗花粉（禁药）；她自己去躲`, req: needStones(80), run: (st, p) => {
          spend(80, '收下曼殊的两罐花粉。'); for (let i = 0; i < 2; i++) giveItem('datura_pollen', { q: 80 });
          remember(p, '你买了她的花粉，没留她。', 2);
          return { text: '“也是笔生意。”她把灵石收进袖里，走了，香味留了很久。', go: ['raid', [2, 4]], summary: '你买下了曼殊的花粉。' };
        } },
        { label: '这东西我不碰', hint: '不沾这件事', run: (st, p) => {
          remember(p, '你不碰她的花粉。', -4); st.flags.refused = true;
          return { text: '“胆子没吾以为的大。”她收起陶罐，笑了笑。', go: ['raid', [2, 4]] };
        } },
      ],
    },

    // 执法堂上门缉毒
    raid: {
      when: 'day',
      who: () => MANSHU_LAW,
      text: st => '执法堂的巡查进门，鼻子抽了抽：“好香。”他把一张画像拍在柜上，画的正是那个黑衣女子：“曼陀罗花妖，私贩禁药。见过没有？”'
        + (st.flags.hid ? '\n库房后头静悄悄的，那股甜香却还没散干净。' : ''),
      choices: st => [
        ...(st.flags.hid ? [{ label: '说铺里点的是安神香', hint: `撒谎；香味是破绽${condText('me') ? `（${condText('me').replace(/。$/, '')}，更容易露馅）` : ''}；被识破执法堂关注 +15，她被带走`, run: (st, p) => {
          if (lieCaught(0.45)) {
            addHeat(15); shiftSt('law', -8);
            lifeNote(p, '被执法堂从一间当铺的库房里搜了出去。'); p.status = 'jailed';
            return { text: '巡查冷笑一声，径直走进库房。出来的时候，铁链上锁着一个黑衣女子，她回头看了你一眼。\n“窝藏禁药，记你一笔。”', end: true, summary: '执法堂从你库房里搜走了曼殊。' };
          }
          return { text: '巡查又抽了抽鼻子，没说什么，走了。', go: ['debt', [3, 5]] };
        } }] : [{ label: '没见过', hint: '照实说', run: () => ({ text: '巡查收起画像，走了。', go: ['debt', [3, 5]] }) }]),
        { label: '塞他一百五十灵石', hint: costHint(150), req: needStones(150), run: () => {
          spend(150, '打点执法堂巡查。');
          return { text: '他掂了掂灵石，把画像折起来揣进怀里：“这一片我搜过了。”', go: ['debt', [3, 5]] };
        } },
        { label: st.flags.hid ? '指指库房' : '告诉他她常在乱葬岗边出没', hint: '+180 灵石赏钱；执法堂交情 +10；关注 -10；妖族声望 -6', sin: ['betray', 2], run: (st, p) => {
          earn(180, '举报曼殊，执法堂赏钱。'); shiftSt('law', 10); addHeat(-10); adjustRep('yao', -6);
          remember(p, '你把她交给了执法堂。', -100, 'betrayed'); lifeNote(p, '被执法堂锁进了血狱。'); p.status = 'jailed';
          return { text: '铁链声响过一阵，铺子里的甜香慢慢散了。\n巡查临走时拍了拍你的肩：“识相。”', end: true, summary: '你把曼殊交给了执法堂。', mood: 'pleased' };
        } },
      ],
    },

    // 风头过后：她来还人情，也带来一笔交易
    debt: {
      when: 'night',
      cond: (st, p) => p.status === 'alive',
      text: st => '夜里，曼殊坐在你的柜台上，晃着脚：“执法堂那个巡查，吾去他梦里坐了坐，他这几天见了曼陀罗就绕道。”'
        + '\n她从袖里摸出两枚带刺的果子：“曼陀罗种。种进妖植盆，三夜开花，花粉你自己收——往后不必再求吾。'
        + (st.flags.hid ? '你替吾挡了一回，这个白送。' : '一百灵石，卖你。') + '”',
      choices: st => [
        { label: st.flags.hid ? '收下' : '买下（100 灵石）', hint: `得两枚曼陀罗种、一罐花粉${st.flags.hid ? '' : `；${costHint(100)}`}`, req: st.flags.hid ? undefined : needStones(100), run: (st, p) => {
          if (!st.flags.hid) spend(100, '向曼殊买曼陀罗种。');
          giveItem('datura_seed', { q: 90 }); giveItem('datura_seed', { q: 90 }); giveItem('datura_pollen', { q: 90 });
          remember(p, '你收下了她的花种。', 8); p.informant = true;
          let tail = '她跳下柜台，花瓣一合，人就不见了。往后执法堂要来巡查，你总会提前一夜闻到一股甜香。';
          if (strongEnough() && Math.random() < 0.35) {
            S.flags.inspectMul *= 0.8;
            tail += '\n后来，执法堂好几个巡查都说，路过你这条街就犯困。';
          }
          return { text: tail, end: true, summary: '曼殊成了你的耳目，执法堂来前总有风声。', mood: 'sly' };
        } },
        { label: '劝她离开杂役区', hint: '妖族声望 +4；她不再回来', run: (st, p) => {
          adjustRep('yao', 4); goodDeed(p, 1); remember(p, '你劝她离开杂役区。', 6);
          lifeNote(p, '离开杂役区，回了乱葬岗外的荒野。'); p.status = 'gone';
          return { text: '“你倒是替吾想。”她笑了笑，花瓣一合，“乱葬岗外头还有片好地方。”', end: true, summary: '你劝曼殊离开了杂役区。' };
        } },
      ],
    },
  },
});
