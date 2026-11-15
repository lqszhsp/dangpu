// 鲁半仙：瞎眼算命先生，其实是被清洗的执法堂书吏。他把一只漆盒寄在你这儿——里面是冷长老的黑账，和一张写着你铺名的抄家单
'use strict';

defineCharacter({
  id: 'lu_banxian', name: '鲁半仙', faction: 'ren', sex: 'm', title: '算命先生',
  portrait: 'lu_banxian',
  art: "an old blind fortune teller in his sixties with a strip of black cloth tied over his eyes, thin grey goatee, weathered face, shabby faded indigo Taoist robe, holding a bamboo pole with a blank white cloth fortune banner in one hand and an old bronze luopan compass in the other, a knowing faint smile",
  bio: '蒙着眼的算命先生，在杂役区街口摆摊，算得准得吓人。有人说他从前在执法堂抄过案卷。',
  intro: '一个算得太准的瞎眼算命先生。',
  savvy: 0.85, power: 22, eye: 3,
  traits: { greed: 0.35, integrity: 0.55, caution: 0.8, wish: 'spirit_wine' },
  start: { day: 8, node: 'fortune', chance: 0.4 },
  regular: true,
  lines: {
    first: '（他拄着竹竿，蒙着黑布的脸正对着你）小掌柜，你的命，有点意思。',
    neutral: ['小掌柜，今日宜开张，忌多嘴。', '老朽又来讨口茶喝。'],
    warm: ['小掌柜，你印堂比上回亮堂。', '老朽这双瞎眼，看人倒还准。'],
    close: ['小掌柜，有些话，老朽只跟你说。', '你我之间，不必算了。'],
    cold: '买卖归买卖。',
    hostile: '……老朽算过你的命。不好。',
    buy: ['有{cat}么？老朽眼瞎，鼻子不瞎。', '给老朽寻些{cat}，别拿次货糊弄瞎子。'],
  },
  command: { label: '令他替你算一卦朝堂风向', run: () => { const it = makeIntel('clique'); return it ? `鲁半仙掐着指头念叨了半晌，你记下一份${itemName(it)}。` : '他说了一堆，可你库房里连张纸都放不下。'; } },
  on: {
    // 送他灵酒，他“算”出一份行情
    gift: (st, p, it, res) => {
      if (res.caught || it.id !== 'spirit_wine') return;
      const m = makeIntel('market');
      if (m) log(`鲁半仙喝了你的灵酒，摇头晃脑地“算”出一份${itemName(m)}。`, 'gain');
    },
    // 漆盒在你柜底的那几夜
    night: (st, p) => st.flags.box && !st.done && ['hunt', 'opened'].includes(st.node) ? '漆盒压在柜底。夜里你总觉得它在发烫。' : null,
  },

  nodes: {
    fortune: {
      when: 'day',
      text: () => '一个蒙着黑布的老瞎子摸进铺子，竹竿在地上点了三下，正停在你面前。\n“小掌柜，老朽送你一卦，只收二十灵石。算得不准，分文不取。”',
      choices: (st, p) => [
        { label: '算一卦', hint: costHint(20), req: needStones(20), run: () => {
          spend(20, '请鲁半仙算了一卦。');
          const it = makeIntel('market');
          remember(p, '你请他算了一卦。', 6);
          return { text: `他掐着指头念了半天：“${it ? `东边的货要涨。${it.info.text}` : '东边的货要涨……可惜你这铺子，放不下更多东西了。'}”\n他收起灵石，压低声音，“还有一句不要钱的：你这铺子，过些日子要来一样东西。收不收，你自己掂量。”`,
            go: ['box', [2, 4]] };
        } },
        { label: '不信这个', run: () => {
          remember(p, '你不信他的卦。', -3);
          return { text: '老瞎子也不恼：“不信也好。只是这几日，夜里关好门。”', go: ['box', [2, 4]] };
        } },
      ],
    },

    box: {
      when: 'night',
      text: () => '三更天，有人叩门。鲁半仙站在门外，怀里抱着一只黑漆木盒，盒上贴着封条。\n“寄放七日，一百灵石。”他把盒子往前一递，“无论谁来问，无论你多想知道——别打开。”',
      choices: (st, p) => [
        { label: '收下漆盒', hint: '+100 灵石', run: () => {
          earn(100, '替鲁半仙保管漆盒的酬金。'); st.flags.box = true;
          remember(p, '你替他收下了漆盒。', 12);
          return { text: '他摸着门框走进夜色里，竹竿的笃笃声很快听不见了。', go: ['hunt', [2, 3]], summary: '你替他保管着一只来路不明的漆盒。' };
        } },
        { label: '不接', run: () => {
          remember(p, '你没接他的漆盒。', -5);
          return { text: '“也是，也是。”他叹了口气，抱着盒子走了。', go: ['news', [4, 6]] };
        } },
      ],
    },

    hunt: {
      when: 'day',
      who: () => ({ name: '执法堂暗探', portrait: 'mo_enforcer', title: '执法堂', faction: 'mo' }),
      text: () => '一个戴铁面的人走进来，没看货架，径直盯着你：“前几夜，有个瞎子来过你这儿，寄了一只漆盒。”\n“冷长老要那只盒子。交出来，执法堂记你一功；藏着——”他用指节敲了敲柜台，“窝藏要犯，一并论处。”'
        + (condSev('me', 'injured') ? '\n他的目光在你吊着的胳膊上停了停，嘴角动了一下。' : condSev('me', 'poisoned') ? '\n他看了看你发紫的嘴唇：“气色不好啊，掌柜的。”' : ''),
      choices: (st, p) => [
        { label: '交出漆盒', hint: '+150 灵石；执法堂好感 +15、关注 -10；鲁半仙必死', run: () => {
          earn(150, '把鲁半仙的漆盒交给执法堂。'); shiftSt('law', 15); addHeat(-10); karmaShift(-6);
          p.status = 'dead'; lifeNote(p, '被执法堂从街口拖走，再没回来。');
          remember(p, '你把他的漆盒交给了执法堂。', -100, 'betrayed');
          return { text: '暗探揣起盒子走了。第二天，街口的卦摊空了，只剩一根断掉的竹竿。', end: true, summary: '你把他的漆盒交给了执法堂。他死了。' };
        } },
        { label: '说没这回事', hint: '暗探未必信', run: () => {
          if (lieCaught(0.55)) {
            addHeat(18); shiftSt('law', -10); st.flags.box = false;
            p.status = 'jailed'; lifeNote(p, '执法堂从你铺子里搜出漆盒，循迹抓了他。');
            return { text: '暗探冷笑一声，掀开柜底，把漆盒拎了出来。“窝藏，记下了。”', end: true, summary: '你没能护住那只漆盒，他被抓了。' };
          }
          st.flags.lied = true;
          return { text: '暗探盯着你看了很久，转身走了。你后背全湿了。', go: ['back', [3, 4]] };
        } },
        // 动手：成败看你的修为、兵器与身上的伤毒
        { label: '趁他不备打晕他，连夜把漆盒送走', hint: `成算约 ${Math.round(trialOdds(42) * 100)}%（${condText('me') || '你状态尚好'}）；败了重伤、漆盒被夺${deathWarn('injured')}`, run: () => {
          const t = trial('me', 42);
          if (t.ok) {
            addHeat(12); st.flags.knocked = true;
            remember(p, '你为了那只漆盒，把执法堂的暗探打晕在柜台后。', 30, 'helped');
            return { text: `你抄起柜下的镇纸，一下砸在他后脑。铁面人软倒下去。\n天亮前，漆盒随一车腐骨出了杂役区。暗探醒来什么也没找到，只记住了你的脸。`, go: ['back', [3, 4]] };
          }
          addCond('me', 'injured', 2, '与执法堂暗探动手'); addHeat(20); shiftSt('law', -15);
          p.status = 'jailed'; lifeNote(p, '执法堂夺走漆盒，循迹抓了他。');
          return { text: `你刚抬手，铁面人一掌拍在你胸口——${condText('me') || ''}\n你撞翻了货架，眼睁睁看着他夹着漆盒扬长而去。`, end: true, summary: '你为他动了手，没打过执法堂的暗探，漆盒被夺，他被抓了。' };
        } },
        { label: '先稳住他，夜里打开漆盒', hint: '看看里面是什么', run: () => {
          remember(p, '你违背承诺，打开了他的漆盒。', -10);
          return { text: '你说要去后院找找，请暗探明日再来。夜里，你撕开了封条。', go: ['opened', 0] };
        } },
      ],
    },

    opened: {
      when: 'night',
      text: () => '盒里是一本账册：冷长老私吞抄没、暗通仙门的往来，一笔笔记得清清楚楚。\n账册最底下压着一张抄家单——第三行，是你铺子的名字。',
      choices: (st, p) => [
        { label: '把账册递给少宗主一系', hint: '执法堂权势大跌；少宗主一系好感 +25', run: () => {
          S.cliques.law.pw = clamp(S.cliques.law.pw - 25, 0, 100); shiftSt('heir', 25); shiftSt('law', -20); earn(200, '少宗主一系为冷长老的黑账付的谢礼。');
          st.flags.delivered = true;
          return { text: '天没亮，账册就到了血公子手里。他让人捎来两百灵石，还有一句话：“抄家单上那一行，划掉了。”', go: ['back', [2, 3]] };
        } },
        { label: '拿账册要挟冷长老', hint: `成算看你的势力（${playerPower()}）`, run: () => {
          if (Math.random() < clamp(playerPower() / 100, 0.1, 0.8)) {
            earn(600, '冷长老买回自己的黑账。'); addHeat(-25); shiftSt('law', 10); st.flags.sold = true;
            return { text: '冷长老亲自来了，一句话没说，放下六百灵石，拿走账册。抄家单当着你的面烧了。', go: ['back', [2, 3]] };
          }
          addHeat(30); shiftSt('law', -30);
          return { text: '你托人递话，第二天执法堂就围了你的铺子，账册被搜走。你在血狱里关了三天才被放出来。', go: ['back', [2, 3]] };
        } },
        { label: '原样封好', run: () => {
          st.flags.kept = true;
          return { text: '你把账册放回去，用浆糊把封条粘好。抄家单上那一行字，你一夜没睡着。', go: ['back', [2, 3]] };
        } },
      ],
    },

    back: {
      when: 'day',
      cond: (st, p) => p.status === 'alive',
      text: st => st.flags.knocked ? '鲁半仙来了，摸着漆盒的封条，长长出了一口气：“你为老朽打了执法堂的人。”\n他扯下蒙眼的黑布——那双眼睛好好的。“老朽从前是执法堂的书吏。这份情，老朽拿命记着。”'
        : st.flags.delivered ? '鲁半仙来了，这回他扯下了蒙眼的黑布——那双眼睛好好的。\n“老朽从前是执法堂的书吏，冷长老灭了老朽一家。”他冲你深深一揖，“账册的去处，比老朽想的还好。”'
        : st.flags.sold ? '鲁半仙站在门口，没进来：“账册卖了个好价钱吧？”\n他的声音很平静，“老朽算到了。”'
          : '鲁半仙摸进铺子，伸手摸了摸漆盒的封条，笑了：“好，好。七日到了。”',
      choices: st => st.flags.sold ? [
        { label: '……', run: (st, p) => {
          remember(p, '你拿他用命换来的账册换了灵石。', -60, 'betrayed');
          p.status = 'gone'; lifeNote(p, '离开了杂役区，不知所终。');
          return { text: '他转身走了。从那以后，街口再没人算卦。', end: true, summary: '你把他的账册卖给了冷长老。' };
        } },
      ] : [
        { label: '把漆盒还给他', run: (st, p) => {
          earn(200, '鲁半仙付清保管的酬金。');
          remember(p, st.flags.delivered ? '你把冷长老的黑账递到了该去的地方。' : '你守着漆盒，七日没让人拿走。', 40, 'helped');
          p.informant = true; p.owes = true; goodDeed(p, 3);
          // 好人好报：要你自己站得住，他才敢把命押在你身上
          if (strongEnough() && Math.random() < 0.35) {
            S.flags.savior = (S.flags.savior || 0) + 1; S.flags.deedMul *= 0.85;
            return { text: '他压低声音：“执法堂的抄家单，往后经老朽的手，你的名字不会出现。铺契的价钱，老朽也托人压了压。”', end: true,
              summary: '他是被清洗的执法堂书吏。他替你从抄家单上抹了名字，铺契也便宜了。' };
          }
          return { text: '他把剩下的两百灵石放在柜上：“往后街口有什么风声，老朽都替你听着。”', end: true, summary: '你守住了他的漆盒。他成了你的耳目。' };
        } },
      ],
    },

    news: {
      when: 'day',
      who: () => ({ name: '街坊', portrait: 'ren_merchant_f1', title: '杂役区街坊', faction: 'ren' }),
      text: () => '隔壁卖烧饼的探进头来：“听说了么？街口那个瞎子，前天夜里漂在水渠里，怀里还死死抱着个空盒子。”\n“执法堂说是失足。”他压低了声音，“哪有瞎子半夜去水渠边上的。”',
      choices: (st, p) => [
        { label: '……', run: () => {
          if (p.status === 'alive') { p.status = 'dead'; lifeNote(p, '死在水渠里，怀里抱着一只空盒子。'); }
          if (Math.random() < 0.5) { addHeat(10); return { text: '几天后，执法堂挨家挨户查了一遍“窝藏要犯”的铺子。你的铺子也在单子上。', end: true, summary: '你没接他的漆盒。他死了，抄家单上的名字还在。' }; }
          return { text: '你给他烧了一炷香。', end: true, summary: '你没接他的漆盒。他死在了水渠里。' };
        } },
      ],
    },
  },
});
