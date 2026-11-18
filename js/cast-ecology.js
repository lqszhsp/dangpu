// 共用四节点分支骨架；每位角色独有的处境、胁迫与结局保存在 js/cast/<id>.js。
'use strict';

// 每位角色登场时的处境：按 id 定，同一个人每局一样——有人带伤而来，有人被下了毒，多数人安然无恙
function ecologyArrival(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ['injured', 'poisoned', null, null, null][h % 5];
}

function ecologyCharacter(d) {
  const he = d.sex === 'f' ? '她' : '他';
  const arrival = ecologyArrival(d.id);
  // 夜里施压的人有多硬：施压的派系越凶，越难对付
  const enforcerDc = { law: 46, war: 44, dan: 38, heir: 36 }[d.clique] || 40;
  const address = { ren: '掌柜的', yao: '人族小掌柜', mo: '开铺的', xian: '店家' }[d.faction];
  const itemTitle = ITEMS[d.item].name;
  const supported = st => st.flags.backed || st.flags.tradeHelp;
  const close = (st, p, ending, text, summary) => {
    st.flags.outcome = ending;
    lifeNote(p, summary);
    return { text, end: true, summary: `${d.name}：${summary}` };
  };
  // 身边有没有治伤毒的东西
  const healItemFor = p => condSev(p, 'injured') ? ownItem(it => ['vine_fruit', 'pill_blood'].includes(it.id) && !it.fake && !it.laced)
    : ownItem(it => ['herb_blood', 'pill_qi'].includes(it.id) && !it.fake && !it.laced);
  const expose = (st, p) => {
    earn(160, `出卖${d.name}的证据。`); shiftSt(d.clique, 8);
    remember(p, '你把独立样证卖给了施压的一方。', -60, 'betrayed'); st.flags.sold = true;
    return { text: '买证的人没有留名，只留下正好的灵石。再有人来时，你只能拿出空匣。', go: ['aftermath', [3, 5]], summary: `你卖掉了${d.name}的证据。` };
  };
  return {
    // 立绘默认百炼 Qwen 画；个别重画过的写 artProvider: 'gpt'，走 cast.mjs art 的 GPT 流程（ecologyBatch 不变：并行上限照算）
    portrait: d.id, ecologyBatch: 'qwen3pro55', artProvider: 'bailian', artModel: 'qwen-image-3.0-pro', ...d,
    bio: `${d.age}岁，${d.title}。${d.problem}`, intro: `${d.name}带来的不是一笔普通典当：${d.problem}`,
    savvy: d.age < 18 ? 0.3 : 0.55, power: d.age < 18 ? 10 : d.faction === 'mo' ? 36 : 26, eye: 2,
    traits: { greed: 0.35, integrity: 0.65, caution: 0.7, wish: d.item, budgetMul: d.age < 18 ? 0.65 : 1 },
    // 登场日按原定先后压缩到第 6–38 日，让一局六十日内大多见得到；至多五个扩展故事并行；底图未安装者不提前登场；恶名在外的铺子没人来托付
    start: { day: Math.max(6, Math.round(d.start_day * 0.6)), node: 'meet', chance: 0.5,
      cond: () => ART_SET.has(`chars/${d.id}`) && fateTrusted() && Object.values(S.story)
        .filter(st => !st.done && CAST[st.tpl] && CAST[st.tpl].ecologyBatch === 'qwen3pro55').length < 5 },
    regular: true,
    lines: {
      first: `${address}，我是${d.name}，做${d.title}这一行的，先问问${itemTitle}。`,
      neutral: `${address}，今天的${itemTitle}是什么成色？`,
      warm: `上回的账我记着。${address}，这回照实说价。`, close: '走过几处门，才知道这里能坐下说实话。',
      cold: '只谈货，旧事先放着。', hostile: '这次把数目写清，别让旧账重演。',
      buy: '想收些{cat}，是手头的活要用，不是摆着好看。', sell: '这件{item}，开价{ask}灵石。你看了成色再回话。',
    },
    on: {
      start: (st, p) => { if (arrival) addCond(p, arrival, 1, arrival === 'injured' ? '被施压的人打伤' : '被人在饭食里下了药'); },
      sold: (st, p, it, price) => {
        if (st.done || st.flags.tradeHelp || it.id !== d.item || it.fake || it.laced) return;
        if (price <= knownValue(it)*priceMul(it.id)) {
          st.flags.tradeHelp = true;
          remember(p, '纠纷未了时，你按公道价给过一件急用的货。', 8, 'fair');
        }
      },
      death: (st, p) => {
        if (st.done) return;
        st.done = true; st.flags.outcome = 'death'; st.summary = `${d.name}没能等到纠纷了结。`;
        log(`${d.name}留下的那笔事，再没有人来取证。`, 'loss');
      },
    },
    nodes: {
      meet: {
        when: 'day',
        text: (st, p) => `${d.name}把随身的物件轻放在柜角，没急着开价。${condList(p).length ? `\n${he}${condSev(p, 'injured') ? '一条胳膊吊着，袖口还渗着血' : '嘴唇发紫，说两句就要停下来喘'}——${condText(p).replace(/。$/, '')}。` : ''}\n${d.problem}\n“${address}，帮我垫${d.cost}灵石，或者找一件${itemTitle}。若不放心，就先留下样证，对得上账再说。”`,
        choices: (st, p) => [
          // 他身上带着伤毒：先治人，再谈事
          ...(condList(p).length ? [{ label: `先替${he}治${condSev(p, 'injured') ? '伤' : '毒'}`,
            hint: `用掉一件${condSev(p, 'injured') ? '血藤果或血煞丹' : '血灵芝或回气丹'}；好感+12；${he}撑得住后面的事`,
            req: () => !!healItemFor(p) || `手里没有${condSev(p, 'injured') ? '血藤果、血煞丹' : '血灵芝、回气丹'}`, run: () => {
              takeItem(healItemFor(p)); cureCond(p, 'injured'); cureCond(p, 'poisoned'); goodDeed(p, 1);
              remember(p, '你先替他治了伤毒，才听他说事。', 12, 'helped'); st.flags.healed = true;
              return { text: `${he}缓过一口气：“明日我再来，把事情从头说清。”`, go: ['meet', 1] };
            } }] : []),
          { label: '垫付材料与跑腿钱', hint: `-${d.cost}灵石；善名+2；好感+15`, req: needStones(d.cost), run: () => {
            spend(d.cost, `替${d.name}垫付周转。`); goodDeed(p, 2); remember(p, '你先垫了这笔周转钱。', 15, 'helped');
            st.flags.backed = true;
            return { text: `${he}把数目逐项记在样证背面：“这笔不能让你白垫。”`, go: ['pressure', [2, 4]], summary: `你替${d.name}垫了周转钱。` };
          } },
          { label: `给一件${itemTitle}应急`, hint: `失去一件真品${itemTitle}；善名+2；好感+15`,
            req: () => !!ownItem(it => it.id === d.item && !it.fake && !it.laced) || `没有可用的真品${itemTitle}`,
            run: () => {
              takeItem(ownItem(it => it.id === d.item && !it.fake && !it.laced));
              goodDeed(p, 2); remember(p, '你给了一件手头急用的真货。', 15, 'helped'); st.flags.backed = true;
              return { text: `${he}检查封口后才收货，又把样证留了下来。`, go: ['pressure', [2, 4]] };
            } },
          { label: '暂不出资，只留样证核对', hint: '不花灵石；好感+3；后续仍需承担作证风险', run: () => {
            st.flags.examined = true; remember(p, '你没有先付钱，但肯替这件事留证。', 3);
            return { text: `你收了样证，没有收下${he}的一句空口担保。`, go: ['pressure', [3, 5]] };
          } },
          { label: '不接这笔事', hint: '不花灵石；好感-5；结束此故事', run: () => {
            remember(p, '你没有接下这笔纠纷。', -5);
            return close(st, p, 'declined', `${d.name}收好物件走了。${d.failure}`, `你没有介入，${d.failure}`);
          } },
        ],
      },
      pressure: {
        when: 'night',
        text: st => `入夜，${d.name}绕过亮着灯的街口来叩后门。\n${d.pressure}\n${supported(st) ? '你先前的资助已用上，对方因此连你的铺名也问了。' : '样证还压在柜底，对方已开始沿街追问。'}\n“${address}，样证留在这里，是帮我，也是给你添事。”`,
        choices: (st, p) => [
          { label: '做两份副证，留下独立存根', hint: '-20灵石；关注+5；好感+10；继续听证', req: needStones(20), run: () => {
            spend(20, `替${d.name}留两份存根。`); addHeat(5); st.flags.copied = true;
            remember(p, '你冒着被查问的风险替样证留了存根。', 10, 'helped');
            return { text: '一份放在货格，一份随旧账装订。天亮前，查问的人果然来了。', go: ['hearing', [2, 3]] };
          } },
          { label: '出门把追问的人打发走', hint: `成算约 ${Math.round(trialOdds(enforcerDc) * 100)}%（${condText('me') || '你状态尚好'}）；成则省掉作证风险，败则受伤、样证被抢${deathWarn('injured')}`, run: () => {
            const t = trial('me', enforcerDc);
            if (t.ok) {
              addHeat(6); shiftSt(d.clique, -5); st.flags.public = true; st.flags.fought = true;
              remember(p, '施压的人上门时，你出门把他们打发走了。', 18, 'helped');
              return { text: `你提着门闩出了后门。巷子里一阵乱响，追问的人捂着脸跑了，再没回来。\n${d.name}在门里听着，半晌说不出话。`, go: ['aftermath', [2, 4]] };
            }
            addCond('me', 'injured', t.margin < -15 ? 2 : 1, '在后巷与追问的人动手'); addHeat(8);
            st.flags.sold = true; st.flags.robbed = true;
            remember(p, '你想护住样证，没打过，样证被抢走了。', -10);
            return { text: `你刚出门就挨了一记闷棍。${condText('me')}\n等你爬起来，样证已经被搜走了。`, go: ['aftermath', [3, 5]] };
          } },
          { label: '把原证卖给施压者', sin: ['betray', 2], hint: '+160灵石；好感-60；派系好感+8；留下后账', run: () => expose(st, p) },
          { label: '归还样证，从此不再介入', hint: '不再花钱；好感-8；失去继续作证的机会', run: () => {
            remember(p, '风声紧时，你把样证还了回去。', -8);
            return close(st, p, 'withdrawn', `${d.name}把样证塞回衣内。${d.failure}`, `你在追问到来前退出，${d.failure}`);
          } },
        ],
      },
      hearing: {
        when: 'day', who: () => ({ name: '执法堂核契书吏', portrait: 'mo_enforcer', title: '核契来人', faction: 'mo' }),
        text: () => `戴铁面的书吏摊开两张收据：“${d.name}的事，双方说辞不同。你有存根，就把原来怎样写、后来怎样改说清。”\n${d.pressure}\n他按住纸角：“这不是让我主持公道，是你愿不愿意把铺名写在证后。”`,
        choices: (st, p) => [
          { label: '请独立验手，署铺名作证', hint: `-40灵石；关注+5；施压派系好感-6；保留证据${hasCond('me', 'poisoned') || condSev('me', 'deviation') || hasCond('me', 'exhausted') ? '；你心神不宁，书吏未必信你' : ''}`, req: needStones(40), run: () => {
            spend(40, `为${d.name}请独立验手。`); addHeat(5); shiftSt(d.clique, -6);
            // 心神不宁的证人，说话前后不一
            if (lieCaught(0.15)) {
              st.flags.compromise = true;
              return { text: `你说到一半，${hasCond('me', 'poisoned') ? '毒气上涌，眼前一黑' : '心神一晃'}，前后两句对不上。书吏抬眼看你：“掌柜的记性不大好。”\n验手只圈出了一半改动，事情没能彻底翻过来。`, go: ['aftermath', [3, 5]] };
            }
            st.flags.public = true;
            return { text: '验手对照两份存根，圈出改动处。你的铺名也写在纸尾。', go: ['aftermath', [3, 5]] };
          } },
          { label: '出钱作保，暂不追究旧账', hint: '-100灵石；施压派系好感+3；只保眼前，不揭旧账', req: needStones(100), run: () => {
            spend(100, `为${d.name}出和解保钱。`); shiftSt(d.clique, 3); st.flags.compromise = true;
            return { text: '书吏收钱，在新契上划去这一轮追索；旧契没有作废，只暂时收进柜底。', go: ['aftermath', [2, 4]] };
          } },
          { label: '交出存根，收一笔协查赏', sin: ['betray', 2], hint: '+160灵石；好感-60；施压派系好感+8', run: () => expose(st, p) },
        ],
      },
      aftermath: {
        when: 'night',
        text: st => st.flags.robbed ? `${d.failure}\n${d.name}来看你的伤，站在门口很久：“你替我挨了这一棍，可证没了。”`
          : st.flags.sold ? `${d.failure}\n${d.name}夜里来取原证，手停在空匣边：“钱是付清了。我的事呢？”`
          : st.flags.public ? `${d.success}\n${d.name}带着核验过的副证来，想请你决定原证往后交给谁。`
            : `${d.name}拿着新契来过目。眼前的追索停了，旧账上的字却仍能辨认。\n“躲过这回，不算把事情办完。”`,
        choices: (st, p) => st.flags.robbed ? [
          { label: '……', hint: `${he}记着你挨的那一棍`, run: () => {
            remember(p, '你为他挨了一棍，证还是没保住。', 15);
            return close(st, p, 'robbed', `${d.failure}\n${d.name}没怪你，只是再没提起这件事。`, `你为${d.name}动了手，没打过，证据被抢。${d.failure}`);
          } },
        ] : st.flags.sold ? [
          { label: '不追回原证，认下这笔交易', hint: '同族声望-5；关注+4；对方离开，不再登门买卖', run: () => {
            adjustRep(d.faction, -5); addHeat(4); p.status = 'gone';
            return close(st, p, 'betrayed', `${d.failure}\n${d.name}合上空匣，没再报价，也没再登门。`, `证据被你卖掉。${d.failure}`);
          } },
          { label: '补付200灵石追回一份旧存根', hint: '-200灵石；关注+8；好感只恢复5；不消除卖证记忆', req: needStones(200), run: () => {
            spend(200, `替${d.name}追回旧存根。`); addHeat(8); remember(p, '你卖证以后又花钱追回一份存根。', 5);
            return close(st, p, 'repaired_betrayal', `${d.name}收走追回的纸：“旧账还在，只是今天先不翻。”`, '你卖证又追回一份，损失和记恨并未消失。');
          } },
        ] : [
          { label: '原证还本人，不收保管费', hint: st.flags.compromise ? '善名+2；同族声望+2；好感+12；仅暂缓纠纷' : '善名+2；同族声望+4；好感+22；欠下一份人情', run: () => {
            goodDeed(p, 2); adjustRep(d.faction, st.flags.compromise ? 2 : 4);
            remember(p, '你归还原证，不向求助者索取额外保管费。', st.flags.compromise ? 12 : 22, 'helped');
            if (st.flags.compromise) return close(st, p, 'truce', `${d.name}收好新契与旧证：“先把今天过完，再说下一回。”`, '你促成临时和解，旧账未清。');
            p.owes = true;
            return close(st, p, 'protected', `${d.success}\n${he}带走原证，留下一个以后还能登门的理由。`, d.success);
          } },
          { label: '留副证，经本人同意做长期耳目', hint: '需筑基或势力足够；善名+2；同族声望+4；好感+22；无重宝保底',
            req: () => (strongEnough() && !!st.flags.public) || '需筑基或足够势力，且已公开核验证据', run: () => {
              p.informant = true; p.owes = true; goodDeed(p, 2); adjustRep(d.faction, 4);
              remember(p, '纠纷了结后，你与本人约好互通本行风声。', 22, 'helped');
              let extra = '';
              if (strongEnough() && supported(st) && Math.random() < 0.35) {
                extra = makeIntel('market') ? '另有一份本行行情送进了库房。' : '行情纸放不下，只得口头带过。';
              }
              return close(st, p, 'informant', `${d.success}\n${d.name}同意往后带来本行风声。${extra}`, `纠纷了结，${d.name}成了本行耳目。`);
            } },
        ],
      },
    },
  };
}
