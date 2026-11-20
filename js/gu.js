// 蛊虫精通：养蛊人独门的手艺，别处学不来——养蛊攒经验自动升重；会下蛊：下中的人或听话、或被蛊噬成重伤，
// 蛊要不了人命，中蛊的人跟你动手跌一境、与你打交道也多半不再给你添堵。情蛊一生只认一名女子，她死你也活不成。
// 给执法堂的人下蛊可能被察觉；察觉了却没被锁拿，执法堂会换一位新巡查来（见 js/cast/leng_fei.js）
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

// ───────────── 下蛊 ─────────────

// 能下的蛊：养大的蛊，和情蛊（货品册里那对同心蛊：三重时自己炼，鬼市也有现成的）
const isLoveGu = it => it.id === 'love_gu';
const plantableGu = () => Object.values(S.items).filter(it => HELD(it) && (it.id === 'gu' || isLoveGu(it)) && !it.fake);
const guReach = () => S.cult.lv + (guLv() >= 4 ? 1 : 0);

// 能不能拿这只蛊给他下：能返回 null，否则返回缘由；情蛊对未成年人不列出来（hidden）
function plantBlock(p, it) {
  if (!guLv()) return '你不懂下蛊';
  if (p.status !== 'alive') return `${ta(p)}已不在了`;
  if (!p.visits) return `还没和${ta(p)}打过照面`;
  if (p.plantDay === S.day) return `今日已对${ta(p)}下过手`;
  if (isLoveGu(it)) {
    if (guLv() < 3) return '蛊虫精通三重才驾驭得住情蛊';
    if (!isAdultWoman(p)) return '情蛊只认成年女子，近不了这人的身';
    if (S.loveGu === p.pid) return `情蛊早已在${ta(p)}心头`;
    if (S.loveGu) return `情蛊一生只认一人——它绕着${p.name}转了一圈，又爬回了你袖中`;
  } else {
    if (p.loveGu) return `${ta(p)}心里已有情蛊，别的蛊不敢近`;
    if (p.controlled && p.controlled.by === 'gu') return `${ta(p)}身上已种着你的蛊`;
    if (guStage(it) > guLv()) return `${itemName(it)}太凶，蛊虫精通${cn(guStage(it))}重才驾驭得住`;
  }
  if (npcLevel(p) > guReach()) return `${p.name}是${realmName(npcLevel(p))}，蛊近不了${ta(p)}的身${guLv() < 4 ? '（蛊虫精通四重可下到高你一境的人）' : ''}`;
  return null;
}
const plantHidden = (p, it) => isLoveGu(it) && isMinor(p);

// 成算：手艺、修为差距、蛊的道行；对方越精越难；交情好的不设防
function plantOdds(p, it) {
  const gap = S.cult.lv - npcLevel(p);
  return clamp(0.3 + 0.12 * guLv() + 0.15 * gap + 0.05 * guStage(it) + (isLoveGu(it) ? 0.1 : 0) - 0.2 * (p.savvy || 0.4) + clamp(p.aff, -50, 50) / 250, 0.05, 0.95);
}

// 执法堂的人：种上种不上，都可能被察觉
const lawSpotOdds = () => clamp(0.4 - 0.06 * guLv(), 0.1, 0.4);

function plantGu(p, it) {
  const why = plantBlock(p, it);
  if (why) return { err: why };
  const err = exert('plantgu');
  if (err) return { err };
  p.plantDay = S.day;
  const name = itemName(it), love = isLoveGu(it), ok = Math.random() < plantOdds(p, it);
  let text, cls = 'good';
  if (ok) {
    if (love) {
      p.loveGu = { day: S.day };
      S.loveGu = p.pid;
      p.aff = 100;
      remember(p, '那天在你铺子里，心口忽然一热——从此眼里就只有你了。', 0, 'loved');
      commitSin('harm', { p, w: 2, what: `给${p.name}种情蛊`, virtue: 6 });
      text = `你指尖一弹，情蛊没入${p.name}的衣襟。${ta(p)}怔了一怔，再抬眼看你时，脸一下红到了耳根。母蛊在你心口轻轻一跳——从今往后，你们是一条命了。`;
    } else {
      p.controlled = { day: S.day, by: 'gu', stage: guStage(it), tox: it.tox };
      remember(p, `你在${ta(p)}身上种下了${name}。`, 0);
      commitSin('harm', { p, w: 1 + Math.min(2, guStage(it)), what: `给${p.name}下${name}`, virtue: 3 + 2 * guStage(it) });
      text = `${name}钻进${p.name}的袖口，没了踪影。${ta(p)}眼神空了一瞬，再看你时，已经不大敢直视了。`;
    }
    if (it.laced) { laceEffect(p, it, name, true); text += `蛊身上${LACE[it.laced].verb}，一并入了${ta(p)}的身。`; }
  } else {
    remember(p, '有人想在他身上下蛊，他疑心是你。', -30, 'controlled');
    text = `${name}刚爬上${p.name}的衣角，就被${ta(p)}一掌拍落、碾死在地。${ta(p)}狐疑地盯着你看了半晌。`;
    cls = 'bad';
    if (Math.random() < 0.4) startScandal(p, 'control');
  }
  destroyItem(it);
  // 执法堂的人：察觉了，关注大涨；没被当场锁拿，过几日执法堂会换一位新巡查来
  if (isLawman(p) && Math.random() < lawSpotOdds()) {
    addHeat(45);
    text += `\n${p.name}${ok ? '回衙之后' : '当场'}就察觉了不对，执法堂的卷宗上添了你的名字（关注 +45）。`;
    cls = 'bad';
    if (p.pid === 'enforcer' && !S.flags.guCaught) S.flags.guCaught = S.day;
    checkHeat();
  }
  return { ok, text, cls };
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
