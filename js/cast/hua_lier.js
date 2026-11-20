// 花狸儿：刚学会化形的小猫妖，爹娘被灵兽阁捉走，一个人在屋檐上过活，拿“捡来的”东西换鱼干。
// 灵兽阁的人满杂役区捉野妖崽子——护她要担私藏妖物的罪名，卖她只值五十灵石
'use strict';

const LIER_CATCHER = { name: '灵兽阁弟子', portrait: 'mo_disciple', title: '灵兽阁捕役', faction: 'mo' };
// 她那块玉佩还在你铺里摆着么
const lierPendant = st => { const it = st.flags.pendant && S.items[st.flags.pendant]; return it && HELD(it) ? it : null; };

defineCharacter({
  id: 'hua_lier', name: '花狸儿', faction: 'yao', sex: 'f', title: '小猫妖',
  portrait: 'hua_lier',
  // 孩子：画成可爱俏皮的童星，衣着严实；神态里不画成瘾、黑筋
  artSubject: 'a little girl (child actress)',
  art: 'a cute cheerful little cat-spirit girl who looks about ten years old, small and round-faced, big bright amber cat eyes, '
    + 'fluffy orange-and-white cat ears and a long striped orange tail, messy short hair tied with a red ribbon, a smudge of dust on one cheek, '
    + 'a simple patched orange cotton jacket and loose trousers fully covering arms and legs, cloth shoes, holding a small dried fish in both hands, wholesome and innocent',
  minor: true,
  moodArt: {
    wasted: 'sick and worn out: pale face, tired droopy eyes, ears flat and drooping, hugging herself as if cold',
    thrall: 'dazed and entranced: eyes glazed with a soft purple glow, blank sleepy face, a faint purple mist around her head',
  },
  bio: '刚学会化形的小猫妖，耳朵尾巴还收不回去。爹娘被灵兽阁捉了去，她一个人在杂役区的屋檐上过活，靠“捡”东西换鱼干。',
  intro: '一个耳朵尾巴还藏不住的小猫妖，拿“捡来的”东西来换吃的。',
  savvy: 0.25, power: 12, eye: 1,
  traits: { greed: 0.4, integrity: 0.4, caution: 0.3, wish: 'spirit_fruit', budgetMul: 0.4 },
  start: { day: 6, node: 'meet', chance: 0.4, cond: () => ART_SET.has('chars/hua_lier') },   // 立绘装好才登场
  regular: true,
  lines: {
    first: '（柜台边冒出两只毛茸茸的耳朵）小掌柜，你这儿有没有鱼干呀？',
    neutral: ['小掌柜，吾又来啦。', '今天屋顶上可冷了。'],
    warm: ['小掌柜，吾替你看着门，坏人来了吾就挠他。', '（她蹭了蹭柜台角）你这儿暖和。'],
    close: ['小掌柜是好人，吾记着。', '吾长大了，也要开一间铺子，就开在你隔壁。'],
    cold: '……吾就买个东西。',
    hostile: '（她躲在门外，只露出一只眼睛）你把吾卖了。',
    buy: ['有{cat}吗？吾攒了好久的灵石。', '吾想要{cat}，便宜点好不好？'],
    sell: '这个{item}是吾捡的，换{ask}灵石……不，换鱼干也行。',
  },
  on: {
    death: (st, p) => { adjustRep('yao', -10); log('那只小花猫死了。屋檐上空了。', 'loss'); },
  },

  nodes: {
    // 头一回：拿一块“捡来的”玉佩换鱼干——丝绦还是新的，多半是从哪位贵人腰上摘的
    meet: {
      when: 'day',
      item: { id: 'jade_pendant', extra: { q: 72, fake: false } },
      text: () => '柜台边冒出两只毛茸茸的耳朵，接着是一张脏兮兮的小脸。一个耳朵尾巴都没藏住的小猫妖踮着脚，把一块古玉佩推到柜上：'
        + '“小掌柜，这个……捡的。换三条鱼干，行不行？”\n玉佩上的丝绦还是新的——多半是从哪位贵人腰上“捡”的。',
      choices: () => [
        { label: '收下，给她六十灵石和一包鱼干', hint: `${costHint(60)}；玉佩是赃物，卖出时小心`, req: needStones(60), run: (st, p) => {
          spend(60, '收下花狸儿的古玉佩。'); st.flags.pendant = (keepCounterItem({ stolen: 5, cost: 60, boughtDay: S.day }) || {}).uid;
          goodDeed(p, 1); remember(p, '你给了她六十灵石，还有一包鱼干。', 15, 'fair');
          st.flags.fed = true;
          return { text: '她抱着鱼干愣了好一会儿，尾巴慢慢竖了起来：“小掌柜……你是好人。”', go: ['chase', [2, 4]], summary: '你收下了花狸儿的玉佩，没亏待她。' };
        } },
        { label: '就给三条鱼干，玉佩留下', hint: '几乎白得一块古玉佩（赃物）；她会记着', req: needStones(3), run: (st, p) => {
          spend(3, '三条鱼干换下一块古玉佩。'); st.flags.pendant = (keepCounterItem({ stolen: 5, cost: 3, boughtDay: S.day }) || {}).uid;
          remember(p, '你用三条鱼干换走了她的玉佩。', -6, 'lowballed');
          st.flags.cheated = true;
          return { text: '她叼着鱼干跑了，跑到门口回头看了一眼柜上的玉佩。', go: ['chase', [2, 4]], summary: '你三条鱼干换下了花狸儿的玉佩。' };
        } },
        { label: '不收赃物，塞给她一把灵果', hint: `${costHint(10)}；善名 +1`, req: needStones(10), run: (st, p) => {
          spend(10, '给了花狸儿一把灵果。'); goodDeed(p, 1); remember(p, '你没收她的东西，还给了她灵果。', 10, 'helped');
          st.flags.refused = true;
          return { text: '“不要就不要嘛。”她把玉佩揣回怀里，抓起灵果，一溜烟上了对面的屋檐。', go: ['chase', [2, 4]], summary: '你没收花狸儿的赃物，给了她一把灵果。' };
        } },
      ],
    },

    // 灵兽阁上门捉野妖崽子：报信有赏，私藏论罪
    chase: {
      when: 'day',
      who: () => LIER_CATCHER,
      text: st => {
        const pend = lierPendant(st);
        return '一个外门弟子拎着铁笼进门，笼底垫着干草：“灵兽阁收野妖崽子。有只小花猫在这一片偷东西，耳朵尾巴都没藏住——你见过没有？”\n'
          + '“报个信，五十灵石；藏着不报，按私藏妖物论。”'
          + (pend ? '\n他的目光在你柜里那块古玉佩上停了一下，没说话。' : '');
      },
      choices: st => [
        { label: '说没见过', hint: `撒谎；被看穿则执法堂关注 +8${condText('me') ? `（${condText('me').replace(/。$/, '')}，更容易露馅）` : ''}`, run: () => {
          const caught = lieCaught(0.35 + (lierPendant(st) ? 0.2 : 0));
          if (caught) { addHeat(8); st.flags.suspect = true; }
          return { text: caught ? '他盯着你看了半晌，冷笑一声：“行，你没见过。”出门时，他在你门框上贴了张黄纸。' : '他“啧”了一声，拎着空笼子走了。',
            go: ['hide', 0] };
        } },
        { label: '塞他三十灵石，请他去别处找', hint: costHint(30), req: needStones(30), run: () => {
          spend(30, '打点灵兽阁的捕役。'); st.flags.bribed = true;
          return { text: '他掂了掂灵石：“这一片，我今天就不来了。”', go: ['hide', 0] };
        } },
        { label: '指给他看她常蹲的那片屋檐', hint: '+50 灵石；妖族声望 -8', sin: ['betray', 1], run: (st, p) => {
          earn(50, '向灵兽阁报信，得赏五十灵石。'); adjustRep('yao', -8);
          remember(p, '你把她常蹲的屋檐指给了灵兽阁。', -100, 'betrayed');
          lifeNote(p, '被灵兽阁装进了铁笼。'); p.status = 'gone';
          return { text: '当天傍晚，对面屋檐上传来一阵乱响，接着是铁笼落锁的声音。\n后来，再没有小花猫来柜台边要鱼干。', end: true, summary: '你把花狸儿的去处告诉了灵兽阁。', mood: 'pleased' };
        } },
      ],
    },

    // 当夜：她挠你的后窗
    hide: {
      when: 'night',
      cond: (st, p) => p.status === 'alive',
      mood: 'afraid',
      text: st => '半夜，后窗被轻轻挠了三下。花狸儿缩在窗台上，尾巴炸成一团：“他们……把隔壁的大黄也捉走了。小掌柜，吾能不能在你这儿躲两天？”'
        + (st.flags.cheated ? '\n她看你的眼神有点躲闪——上回那三条鱼干，她记着呢。' : '')
        + (st.flags.suspect ? '\n你想起门框上那张黄纸。' : ''),
      choices: st => [
        { label: '收留她，让她睡在柜台底下', hint: `执法堂关注 +${st.flags.suspect ? 8 : 3}；灵兽阁可能回来搜`, run: (st, p) => {
          addHeat(st.flags.suspect ? 8 : 3); goodDeed(p, 3); remember(p, '那晚你开了窗，收留了她。', 25, 'helped');
          st.flags.kept = true;
          return { text: '她钻进柜台底下，团成一团，不一会儿就打起了小呼噜。', go: ['raid', [2, 4]], summary: '你收留了花狸儿。', mood: 'pleased' };
        } },
        { label: '给她干粮和路钱，送她出城回妖域', hint: `${costHint(40)}；妖族声望 +5`, req: needStones(40), run: (st, p) => {
          spend(40, '送花狸儿出城的干粮和路钱。'); adjustRep('yao', 5); goodDeed(p, 2);
          remember(p, '你连夜送她出了城。', 20, 'helped'); lifeNote(p, '回了妖域。'); p.status = 'gone';
          return { text: '天亮前，你把她送到城墙根的狗洞边。她钻出去，又回头冲你挥了挥爪子。', end: true, summary: '你连夜送花狸儿出了城。', mood: 'pleased' };
        } },
        { label: '把窗关上', run: (st, p) => {
          remember(p, '那晚你没开窗。', -15);
          return { text: '挠窗的声音停了。第二天，屋檐上空空的。', end: true, summary: '那晚你没给花狸儿开窗。', mood: 'afraid' };
        } },
      ],
    },

    // 灵兽阁带灵犬回来搜：藏得住藏不住，看暗格、看你身上的伤（血腥味盖不住），也可以硬挡
    raid: {
      when: 'day',
      who: () => LIER_CATCHER,
      text: () => '灵兽阁的人又来了，这回牵着一条鼻子贴着地的灵犬：“有人看见那只小花猫往你这儿钻。搜一搜，没意见吧？”\n柜台底下，一点动静都没有。'
        + (condSev('me', 'injured') ? '\n灵犬冲你吊着的胳膊嗅了嗅，喉咙里低低地吼。' : ''),
      choices: () => [
        { label: '让他搜', hint: `藏得住多半没事${S.grids.hidden ? '（有暗格，更稳）' : ''}${condSev('me', 'injured') ? '；你身上有伤，血腥味容易引狗' : ''}`, run: (st, p) => {
          if (!hideRoll(0.5)) return { text: '灵犬绕着柜台转了三圈，打了个喷嚏。他骂了一声，走了。', go: ['grow', [5, 8]] };
          addHeat(10); adjustRep('yao', -3);
          lifeNote(p, '被灵兽阁从当铺里搜了出去。'); p.status = 'gone';
          return { text: '灵犬一头扎进柜台底下。铁笼落锁的时候，她一声都没叫，只是看着你。\n“私藏妖物，记你一笔。”', end: true, summary: '灵兽阁从你的柜台底下搜走了花狸儿。' };
        } },
        { label: '拦在门口，不让他进', hint: `成算约 ${Math.round(trialOdds(34) * 100)}%（${condText('me') || '你状态尚好'}）；拦不住要挨一顿，人也保不住`, run: (st, p) => {
          const t = trial('me', 34);
          if (t.ok) { addHeat(6); return { text: `你把门板一横：“我这儿是当铺，不是灵兽圈。”\n他看了看你，又看了看门外围过来的街坊，牵着狗走了。（${partsText(t.s)}）`, go: ['grow', [5, 8]] }; }
          addCond('me', 'injured', 1, '拦灵兽阁的人'); addHeat(10);
          lifeNote(p, '被灵兽阁从当铺里搜了出去。'); p.status = 'gone';
          return { text: `他一掌把你推进货架。灵犬从柜台底下拖出了那团小花猫。${condText('me')}`, end: true, summary: '你没拦住灵兽阁的人，花狸儿被带走了。' };
        } },
        { label: '塞他一百灵石', hint: costHint(100), req: needStones(100), run: () => {
          spend(100, '又打点了灵兽阁一回。');
          return { text: '他收了灵石，冲柜台底下看了一眼，牵着狗走了：“下回藏严实点。”', go: ['grow', [5, 8]] };
        } },
      ],
    },

    // 风头过了：她在你铺子里扎下根来
    grow: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      mood: 'pleased',
      text: st => '花狸儿蹲在房梁上，耳朵一抖一抖：“小掌柜，库房的老鼠吾都替你抓光了。”她跳下来，从怀里掏出一卷发黄的纸。'
        + '\n“屋顶上捡的——这回真是捡的！”'
        + (st.flags.cheated ? '\n“上回那块玉佩……算啦，吾不跟你计较了。”' : ''),
      choices: () => [
        { label: '收下，往后这儿就是你的窝', hint: '得一份藏宝图；她替你看门、捎消息', run: (st, p) => {
          makeIntel('treasure'); p.informant = true; adjustRep('yao', 5); goodDeed(p, 1);
          remember(p, '你说往后这儿就是她的窝。', 20, 'helped');
          let tail = '她在柜台底下给自己铺了个窝，夜里听见什么动静，都会跑来告诉你。';
          // 够强才有的好报：她找到了爹娘的下落，妖族记下你这份情
          if (strongEnough() && Math.random() < 0.4) {
            adjustRep('yao', 15); S.flags.foxBlessing = true;
            tail += '\n后来她顺着那卷纸找到了爹娘被关的地方。妖域那边传话过来：这间铺子，妖族护着。';
          }
          lifeNote(p, '在一间当铺的柜台底下安了家。');
          return { text: tail, end: true, summary: '花狸儿留在了你的铺子里。' };
        } },
      ],
    },
  },
});
