// 蛊虫精通：养蛊人独门的手艺，别处学不来——养蛊攒经验自动升重。蛊不能当面往人身上放，只能掺进吃食里（加料，见 js/intrigue.js）：
// 谁吃下去谁中蛊——买去转送别人的，中蛊的就是吃的那个人；不懂蛊的人掺进去的只是一只死虫，你自己吃了也什么都不会发生。
// 中蛊的人或听话、或被蛊噬成重伤，蛊要不了人命，跟你动手跌一境、与你打交道也多半不再给你添堵。情蛊一生只认一名女子，她死你也活不成。
// 执法堂的人吃下你的蛊可能察觉；察觉了却没被锁拿，执法堂会换一位新巡查来（见 js/cast/leng_fei.js）
'use strict';

// 升到第 n 重要的累计经验；养蛊的每样活计各记多少
const GU_XP = [0, 0, 60, 180, 400];
const GU_XP_GAIN = { hatch: 2, feed: 1, grown: 6, egg: 3, venom: 2, shed: 10, devour: 4, love: 12 };

const guLv = () => techLv('gumaster');
const guXpNext = () => GU_XP[guLv() + 1];

// 只有养蛊人攒得了经验，攒够自动升重
function guXp(kind, n = 1) {
  if (!S.perks.gumaster || !n) return;
  S.guXp = (S.guXp || 0) + GU_XP_GAIN[kind] * n;
  while (guLv() < TECHS.gumaster.max && S.guXp >= guXpNext()) {
    S.tech.gumaster = guLv() + 1;
    log(`养蛊日久，你的蛊虫精通升至第${cn(guLv())}重。`, 'gold');
  }
}

// ───────────── 谁能中情蛊 ─────────────

// 未成年的一概不算：有名有姓的看年纪（或写明 minor），路人看面孔与称呼
function isMinor(p) {
  const d = CAST[p.pid];
  if (d) return d.age != null ? d.age < 18 : !!d.minor;
  return /kid/.test(faceOf(p) || '') || /少年|少女|孩/.test(p.title || '');
}
const isAdultWoman = p => !!p && sexOf(p) === 'f' && !isMinor(p);

// 执法堂的人：下蛊可能被察觉
const LAWMEN = ['enforcer', 'leng_fei'];
const isLawman = p => LAWMEN.includes(p.pid);

// ───────────── 下蛊：掺进吃食，谁吃谁中 ─────────────

// 手里的蛊：养大的蛊，和情蛊（货品册里那对同心蛊：三重时自己炼，鬼市也有现成的）
const isLoveGu = it => it.id === 'love_gu';
const plantableGu = () => Object.values(S.items).filter(it => HELD(it) && (it.id === 'gu' || isLoveGu(it)) && !it.fake);
const guReach = () => S.cult.lv + (guLv() >= 4 ? 1 : 0);
const isGuLace = kind => kind === 'control' || kind === 'love';

// 能不能把这只蛊掺进吃食：能返回 null，否则返回缘由
function guLaceBlock(add) {
  if (!guLv()) return '你不懂蛊：掺进去也只是一只死虫，谁吃了都不会中蛊';
  if (isLoveGu(add)) {
    if (guLv() < 3) return '蛊虫精通三重才驾驭得住情蛊';
    if (S.loveGu) return `情蛊一生只认一人——你心口的母蛊已经认了${S.people[S.loveGu].name}`;
  } else if (guStage(add) > guLv()) return `${itemName(add)}太凶，蛊虫精通${cn(guStage(add))}重才驾驭得住`;
  return null;
}

// 执法堂的人：吃下你的蛊，种上种不上都可能察觉
const lawSpotOdds = () => clamp(0.4 - 0.06 * guLv(), 0.1, 0.4);

// 掺了蛊的吃食被 p 吃下去。蛊是你亲手掺的、你又懂蛊才种得上；种不上的蛊死在肚里，什么也不会发生。
// 返回 { text, cls } 写进夜里的消息；没种上、或不是你的蛊，返回 {}
function guTakes(p, it, name, knew) {
  if (it.lacedBy !== 'me' || !guLv()) return {};
  const love = it.laced === 'love';
  let text = '', cls = 'good';
  const block = love ? (!isAdultWoman(p) || S.loveGu ? 'skip' : null)
    : p.loveGu || guBound(p) ? 'skip' : npcLevel(p) > guReach() ? 'strong' : null;
  if (!block) {
    if (love) {
      p.loveGu = { day: S.day };
      S.loveGu = p.pid;
      p.aff = 100;
      remember(p, `吃了${name}，心口忽然一热——从此眼里就只有你了。`, 0, 'loved');
      if (knew) commitSin('harm', { p, w: 2, what: `给${p.name}种情蛊`, virtue: 6 });
      text = `${p.name}吃下了藏着情蛊的${name}。母蛊在你心口轻轻一跳——从今往后，你们是一条命了。`;
    } else {
      const stage = it.laceStage || 0, gu = GU_STAGES[stage].name;
      p.controlled = { day: S.day, by: 'gu', stage };
      remember(p, `吃了${name}，肚里像有什么东西在爬。`, 0);
      if (knew) commitSin('harm', { p, w: 1 + Math.min(2, stage), what: `给${p.name}下${gu}`, virtue: 3 + 2 * stage });
      text = `${p.name}吃下了藏着${gu}的${name}，中了你的蛊。`;
    }
  } else if (block === 'strong') {
    text = `${p.name}吃下了藏着蛊的${name}——${ta(p)}是${realmName(npcLevel(p))}，蛊种不上，死在了肚里。`;
    cls = 'warn';
  }
  // 执法堂的人：察觉了，关注大涨；没被当场锁拿，过几日执法堂会换一位新巡查来
  if (isLawman(p) && Math.random() < lawSpotOdds()) {
    addHeat(45);
    text = `${text ? text + '\n' : ''}${p.name}察觉吃下的东西不对，执法堂的卷宗上添了你的名字（关注 +45）。`;
    cls = 'bad';
    if (p.pid === 'enforcer' && !S.flags.guCaught) S.flags.guCaught = S.day;
    checkHeat();
  }
  return text ? { text, cls } : {};
}

// 不从的下场：蛊噬其心，重伤——只到重伤，要不了命
function guBite(p) {
  const s = condSev(p, 'injured');
  if (s < 2) addCond(p, 'injured', 2 - s, '蛊虫噬心');
  guHold(p);
  return `${p.name}咬牙不从，心口的蛊猛地一噬——${ta(p)}捂着胸口跪倒在地，吐了一口黑血，伤得不轻。`;
}

// ───────────── 中蛊的人 ─────────────

// 蛊要宿主活着：中了你的蛊的人，伤再重也被蛊吊着一口气，压在重伤，不到垂危
function guHold(p) {
  const c = p && p.conds && p.conds.injured;
  if (c && c.sev > 2 && guAnyHost(p)) { c.sev = 2; c.day = S.day; }
}
const guAnyHost = p => !!(p && ((p.controlled && p.controlled.by === 'gu') || p.loveGu));

const guBound = p => !!(p && p.controlled && p.controlled.by === 'gu');
const guAny = p => guBound(p) || !!(p && p.loveGu);

// 与你打交道时，抹掉对你不利的事的几率：情蛊全抹；寻常的蛊看手艺，修为高过你的人压得住一些
function guShield(p) {
  if (!p) return 0;
  if (p.loveGu) return 1;
  if (!guBound(p)) return 0;
  return clamp(0.5 + 0.1 * guLv() - (npcLevel(p) > S.cult.lv ? 0.2 : 0), 0, 0.95);
}
const guShrug = p => guShield(p) > 0 && Math.random() < guShield(p);

// 跟你动手时，中了蛊的人跌一境
const guDrop = p => guAny(p) ? 1 : 0;

// 情蛊的那位见了你，永远是一副脸红心跳的样子（没画好的先用高兴的神态）
function smittenMood(p) {
  return ART_SET.has(`chars/${faceOf(p)}_smitten`) ? 'smitten' : 'pleased';
}

// ───────────── 情蛊同命 ─────────────

// 她死了，你心口的母蛊也跟着死——你也就死了
function loveBondCheck() {
  const p = S.loveGu && S.people[S.loveGu];
  if (!p || S.over || p.status !== 'dead') return;
  S.over = { win: false, cause: 'lovegu', scene: ART_SET.has('scene/end_lovegu') ? 'end_lovegu' : 'end_death', title: '情蛊同命',
    text: `${p.name}咽气的那一刻，你心口的母蛊翻了个身，再没动过。南疆的老话说得一点不错：情蛊认的不是一个人，是两条命。`
      + `第二天街坊推开当铺的门，只见柜上并排摆着两只茶碗——一碗凉透了，一碗你一直留给${ta(p)}。仵作验完，在卷宗上写下死因“相思”，`
      + `执法堂不知该定个什么罪，只好把案子归进“风月”一栏，至今无人结案。你欠${landlordName()}的那期租子，到底也没还上。` };
}

// ───────────── 执法堂换人 ─────────────

// 下蛊被执法堂察觉、却没被当场锁拿：过两三日，新巡查到任（冷翡的故事线开场即换人）
const lawSwapDue = () => !!S.flags.guCaught && !S.flags.lawSwap && !S.over && S.day >= S.flags.guCaught + 2;
