// 鉴定小游戏：鉴定物是一张写实底图，肉眼看真赝一模一样；照妖镜能透过表皮看见作伪的痕迹，
// 镜中所见与肉眼所见不一处，便是赝品。每种作伪手法在图上有固定的一处（at：[x, y, 半径]，按图宽计），
// 补丁图由 tools/art/appraise.py 按 art 描述遮罩改图生成（assets/appraise/<img>_<key>.webp）
'use strict';

const APPRAISE = {
  pill: {
    name: '筑基丹', img: 'pill',
    traces: [
      { key: 'wax', label: '蜡衣包金', at: [0.72, 0.60, 0.085],
        text: '廉价丹丸裹一层黄蜡，贴金箔充作金丹。照妖镜透进蜡衣，金皮裂口翘起，底下是灰绿的药胎。',
        art: 'the gold skin of the pill turns semi-transparent and is revealed to be only a thin sheet of gold leaf laid over a layer of yellow wax; a small crack in the gold leaf curls up at its edge, and through the translucent wax a dull grey-green cheap pill core is visible underneath.' },
      { key: 'carve', label: '后刻丹纹', at: [0.60, 0.43, 0.10],
        text: '真丹的云纹是丹火里自然结成，圆润与丹皮一体；仿品成丹后拿针刀刻出，镜下刀口带毛刺、深浅不一，沟里残着金粉。',
        art: 'the raised cloud relief is revealed to have been scratched in afterwards with a needle knife: sharp V-shaped cut grooves with tiny burrs, uneven depth, small slips where the blade overshot the line, and fine gold powder residue left in the grooves.' },
      { key: 'seam', label: '合模压制', at: [0.25, 0.33, 0.085],
        text: '整批仿丹用两半铜模压成，丹身一圈留下一道细细的合模线与挤出的薄边，再怎么打磨也磨不尽。',
        art: 'a clearly visible mold parting seam cuts straight across this part of the pill, interrupting the cloud relief: a raised thin ridge of squeezed-out flash material along the seam, the cloud pattern slightly misaligned on the two sides of the seam, and coarse sanding scratches across it where someone tried to file it down.' },
      { key: 'glow', label: '萤粉假光', at: [0.50, 0.71, 0.085],
        text: '真丹的灵光由丹心透出；仿品的光是丹座内沿抹的一层萤石粉，镜下光从底下来，粉粒一颗颗发亮。',
        art: 'the warm glow at the foot of the pill is revealed to come from a smear of glowing phosphor mineral powder painted on the inner rim of the gilded stand: individual glowing grains and brush smears on the stand, while the pill surface just above it is dull and lifeless.' },
    ],
  },
  jade: {
    name: '古玉佩', img: 'jade',
    traces: [
      { key: 'qin', label: '染色仿沁', at: [0.27, 0.60, 0.085],
        text: '真沁是土色顺着玉的肌理千百年慢慢渗进去，由深到浅；仿沁拿颜料煮烤进去，镜下颜色浮在表面、积在裂纹里，边界生硬。',
        art: 'the brown discoloration in the jade is revealed as artificial dye: the color sits on the surface and is concentrated in hairline cracks as dark lines with hard edges, with tiny pooled dried droplets of dye, and no gradual diffusion into the stone.' },
      { key: 'tool', label: '快砣赶工', at: [0.62, 0.37, 0.09],
        text: '前朝玉器是手工砣具一点点磨出来的，线条深浅有变化；仿品用快砣一气呵成，镜下沟槽里是一圈圈均匀的旋纹，沟边崩出小口。',
        art: 'the carving of the dragon head is revealed as cheap machine work: every carved groove is lined with clearly visible fine concentric spiral scratch rings left by a fast spinning grinding wheel, the grooves have identical mechanical depth, and the groove edges are rough with many small white chipped flakes and fresh white grinding powder stuck in the grooves.' },
      { key: 'glue', label: '断口补胶', at: [0.45, 0.58, 0.07],
        text: '断过的玉佩，缺处用调了色的胶补上。照妖镜透进去，胶与玉分界分明，胶里还裹着气泡。',
        art: 'the dragon claw is revealed as a repair made of tinted translucent resin instead of jade: a visible fracture line where it joins the jade, small round air bubbles trapped inside the resin, slightly glossier and more yellow than the stone.' },
      { key: 'acid', label: '酸咬做旧', at: [0.70, 0.80, 0.085],
        text: '拿酸咬出一层白皮装作“鸡骨白”的老玉，镜下是密密的蜂窝小坑，坑壁新鲜锐利，没有包浆。',
        art: 'the jade surface is revealed as acid-etched to fake age: a dense honeycomb of tiny round pits, a chalky white powdery crust, fresh sharp-edged pit walls, and no smooth polished patina.' },
    ],
  },
  mirror: {
    name: '青铜古镜', img: 'mirror',
    traces: [
      { key: 'rust', label: '刷胶假锈', at: [0.36, 0.60, 0.08],
        text: '真锈从铜里长出来，层层硬结；假锈是胶调铜绿粉刷上去的。照妖镜透过锈层，底下露出黄澄澄的新铜。',
        art: 'the green patina here is revealed as a fake coating peeling away: a glossy transparent glue film with brush stroke ridges holding green powder, and where it has flaked off, bright shiny new yellow-gold brass metal is clearly exposed underneath, smooth and clean with no corrosion at all, sharply contrasting with the dark old bronze around.' },
      { key: 'knob', label: '后焊镜钮', at: [0.59, 0.47, 0.07],
        text: '镜钮是另铸了焊上的：镜下钮座一圈灰白的锡焊，焊瘤与锉痕都在。',
        art: 'along the right edge of the bronze lion-head knob, where it sits on the flat mirror, a conspicuous thick lumpy bead of bright silver-white tin solder fills the joint, clearly a different metal from the brown bronze: molten drips running onto the mirror surface, coarse file scratches across the solder, and a dark crack line separating the knob from the mirror.' },
      { key: 'lobe', label: '翻砂补配', at: [0.82, 0.70, 0.10],
        text: '缺了一瓣，翻砂新铸一瓣拼上。镜下这一瓣纹饰发软、满是砂眼，与原镜之间有一道接缝。',
        art: 'this rim lobe is revealed as a recast replacement: its relief is soft and blurred and covered in tiny sand-casting pinholes, with a thin straight join seam where it meets the original mirror, and the bronze is a slightly different color.' },
      { key: 'chisel', label: '錾刀补纹', at: [0.47, 0.185, 0.07],
        text: '铸纹磨平了，有人拿錾子重新刻深：镜下刀口是 V 形，沟底露出新铜的亮色，不似铸出来的纹路圆润。',
        art: 'the key-fret band has been re-cut with a chisel: sharp V-shaped fresh cuts with bright shiny copper at the bottom of the grooves, small chisel stop marks, and crisp unworn edges unlike the soft rounded cast pattern around it.' },
    ],
  },
};

// 照妖镜图（assets/appraise/loupe.webp）的量度，以镜片半径为 1：图宽高、镜片圆心、镜片圆心到柄尾
const LOUPE = { w: 2.657, h: 6.248, cx: 1.326, cy: 1.353, end: 4.895 };

// 生成一件可鉴定物的破绽：真品没有；赝品用了 1–2 种手法。
// 每处破绽有“隐蔽度”，最隐蔽的一处等于做工；鉴定术不到这一重，照妖镜里也看不出来。flip：摆放朝向
function rollFeats(kind, fake, grade = 1) {
  const spec = APPRAISE[kind], feats = {}, subtle = {};
  if (fake) {
    const keys = spec.traces.map(t => t.key).sort(() => Math.random() - 0.5);
    const n = grade >= 3 ? 1 : Math.random() < 0.6 ? 1 : 2;
    keys.slice(0, n).forEach((k, i) => {
      feats[k] = 1;
      subtle[k] = i === 0 ? grade : 1 + Math.floor(Math.random() * grade);
    });
  }
  return { feats, subtle, flip: Math.random() < 0.5 };
}

// 旧存档里的鉴定物记的是矢量图时代的特征，按真伪与做工重掷一次
function ensureFeats(it) {
  const kind = ITEMS[it.id].appraise, keys = APPRAISE[kind].traces.map(t => t.key);
  if (it.feats && Object.keys(it.feats).every(k => keys.includes(k)) && it.flip != null) return;
  Object.assign(it, rollFeats(kind, !!it.fake, it.grade || 1));
}

// 以某一重鉴定术在照妖镜里看到的破绽：[{ key, op }]。看不穿的不在其列；刚够得着的看着淡些
function visibleFeats(it, lv) {
  ensureFeats(it);
  return Object.keys(it.feats).filter(k => (it.subtle[k] || 1) <= lv)
    .map(k => ({ key: k, op: Math.min(1, 0.72 + 0.14 * (lv - (it.subtle[k] || 1))) }));
}

// 鉴定物的画面：底图，加上照妖镜里才显出的破绽（seen 为空即肉眼所见）
function appraiseImg(kind, seen = [], flip = false) {
  const spec = APPRAISE[kind], src = n => `assets/appraise/${n}.webp`;
  const traces = seen.map(({ key, op }) => {
    const [x, y, r] = spec.traces.find(t => t.key === key).at;
    return `<img class="ap-trace" src="${src(`${spec.img}_${key}`)}" alt="" draggable="false"
      style="left:${((x - r) * 100).toFixed(2)}%;top:${((y - r) * 100).toFixed(2)}%;width:${(r * 200).toFixed(2)}%;opacity:${op.toFixed(2)}">`;
  }).join('');
  return `<div class="ap-img${flip ? ' flip' : ''}"><img src="${src(spec.img)}" alt="" draggable="false">${traces}</div>`;
}
