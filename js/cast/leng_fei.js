// 冷翡：隐藏人物。你给执法堂巡查下蛊被察觉、却没被当场锁拿，厉寒“告了病假”，冷长老派侄女来接手杂役区——
// 铁面、洁癖、清廉得油盐不进，偏偏怕虫。她是为了蛊案来的。中了你的情蛊，你的卷宗就永远递不上去了（见 js/gu.js）
'use strict';

// 到任：执法堂的巡查从此是她；厉寒的那些“方便”一笔勾销
function lengFeiTakeOffice(p) {
  S.flags.lawSwap = true;
  S.flags.enforcerPid = 'leng_fei';
  S.flags.enforcerOwned = false;
  p.official = true;
  const old = S.people.enforcer;
  if (old && old.status === 'alive') { old.status = 'gone'; lifeNote(old, '告了病假，说是心口总觉得有虫在爬，被冷长老送去后山静养。'); }
}

defineCharacter({
  id: 'leng_fei', name: '冷翡', faction: 'mo', sex: 'f', age: 26, title: '执法堂巡查使',
  portrait: 'leng_fei', hidden: true,
  art: 'a stern and coldly beautiful female law-enforcement inspector of a demonic sect, an adult woman about 26: sharp elegant face, thin straight brows, cold grey eyes, '
    + 'pale skin, glossy black hair pulled into a tight high bun pinned with a plain black iron hairpin, immaculate black official robes with crimson trim and a high collar buttoned to the chin, '
    + 'spotless white gloves, a slim silver needle case and a small lacquered law-hall token at her belt, rigid upright posture, a faint fastidious frown as if something here is not clean enough',
  moodArt: {
    // 受控雾由 tools/art/thrall_mist.py 合成，这里不让模型画雾
    thrall: 'dazed and entranced: eyes unfocused and glassy, blank face, stiff posture slackened, lips slightly parted. Nothing around the head',
    // 情蛊：脸红花痴、妩媚；官袍换成轻薄的丝袍（成年人，雅致不露骨）
    smitten: 'helplessly infatuated: deeply blushing cheeks up to the ears, soft dreamy half-lidded eyes gazing at the viewer, a shy coquettish smile, head tilted, '
      + 'one hand (glove removed) twirling a loosened strand of hair that has slipped from her bun; her stiff high-collared robe is replaced by a lighter, thinner, loosely tied '
      + 'black-and-crimson silk robe that shows her collarbones and shoulders, tasteful and elegant, no cleavage, no lingerie, no nudity',
  },
  bio: '执法堂冷长老的侄女，新任杂役区巡查使。铁面、洁癖、清廉得油盐不进——偏偏怕虫。她是为了蛊案来的。',
  intro: '一位为了蛊案上任的新巡查使。',
  savvy: 0.8, power: 58, eye: 3,
  traits: { greed: 0.05, integrity: 0.95, caution: 0.85 },
  start: { day: 1, node: 'arrive', chance: 1, cond: () => lawSwapDue() },
  // 校验工具用：模拟里替玩家把“给巡查下蛊被察觉”这件事做了
  trigger: () => { S.flags.guCaught = S.day - 2; },
  command: { label: '令她把你的卷宗压在案底', run: () => { S.flags.enforcerOwned = true; addHeat(-20); return '冷翡把你的卷宗从架上抽出来，压在了最底下，又用帕子仔仔细细擦了擦手。'; } },
  on: {
    start: (st, p) => lengFeiTakeOffice(p),
    death: () => { log('执法堂的新巡查使冷翡死了。冷长老震怒，杂役区接连查了好几天。', 'loss'); addHeat(15); },
  },

  nodes: {
    arrive: {
      when: 'day', mood: 'sly',
      text: () => '门口进来一位从没见过的女巡查。黑底朱边的官袍一直扣到下巴，白手套一尘不染，进门先拿帕子擦了擦柜台，才把一方执法堂令牌拍在上面。'
        + '\n“执法堂新任杂役区巡查使，冷翡。”声音冷得像井水，“厉寒告了病假——据说他回去以后，天天嚷着心口有虫在爬。冷长老派我来接手。”'
        + '\n她从袖里抽出一根三寸银针，往你柜台缝里拨了拨，又飞快地缩回手，脸色发白：“杂役区出了蛊案。我会查到底。”',
      choices: () => [
        { label: '恭恭敬敬应下', hint: '她记下了你', run: (st, p) => {
          remember(p, '新官上任头一天，你在柜前恭恭敬敬应了话。', 3);
          return { text: '“最好如此。”冷翡又擦了一遍手套，转身走了，走到门口还回头看了一眼门槛——像是怕有什么东西跟出来。', go: ['probe', [4, 6]], summary: '执法堂换了一位新巡查使冷翡，为蛊案而来。' };
        } },
        { label: '递上一盒安神香', hint: '她不收黑钱', run: (st, p) => {
          remember(p, '新官上任头一天，你就想给她递东西。', -4);
          return { text: '冷翡看了一眼，把香推回来：“收起来。我不吃这一套。”——推到一半又拿起来闻了闻：“……这香倒是不错。哪儿买的？”', go: ['probe', [4, 6]], summary: '执法堂换了一位新巡查使冷翡，油盐不进。', mood: 'angry' };
        } },
        ...(plantableGu().length ? [{ label: '让袖口里的蛊虫探个头', hint: '关注 +5；她会记住这一幕', run: (st, p) => {
          addHeat(5); remember(p, '你当着她的面，让一只蛊虫从袖口探出头来。', -8, 'scared');
          return { text: '冷翡“啊”地一声往后跳了三步，撞翻了门口的伞架。她扶着门框站稳，脸涨得通红：“你——你给我等着。”', go: ['probe', [3, 5]], summary: '你把新来的巡查使冷翡吓得撞翻了伞架。', mood: 'afraid' };
        } }] : []),
      ],
    },
    // 银铃查蛊：铺里明处有蛊，铃就响
    probe: {
      when: 'day', mood: 'sly',
      text: () => '冷翡又来了，这回腰间多挂了一只银铃——据说蛊虫近了，它自己会响。她站得离你的柜台远远的，伸长胳膊把铃往前递。',
      choices: () => {
        const shown = Object.values(S.items).filter(it => HELD(it) && ['gu', 'gu_egg', 'gu_venom'].includes(it.id) && it.pos.g !== 'hidden').length
          + S.machines.filter(m => m.type === 'gupot').length;
        return [
          { label: '由她查', hint: shown ? '铺里明处有蛊：关注 +12' : '铺里明处没有蛊', run: (st, p) => {
            if (shown) {
              addHeat(12); remember(p, '银铃在你铺里响个不停。', -6);
              return { text: '银铃“叮铃铃”响成一片。冷翡的脸一下白了，飞快地记了几笔，几乎是逃出门去的：“我还会再来！”', end: true, summary: '冷翡的银铃在你铺里响了，她记下了这笔账。', mood: 'afraid' };
            }
            remember(p, '银铃在你铺里一声没响，她冤枉了你。', 6);
            return { text: '银铃一声没响。冷翡狐疑地四下看了看，收起铃，难得地点了点头：“……打扰了。”', end: true, summary: '冷翡的银铃没在你铺里查出什么。' };
          } },
        ];
      },
    },
  },
});
