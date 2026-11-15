#!/usr/bin/env python3
"""鉴定物的图：底图（肉眼所见）＋每种作伪手法在照妖镜下的“镜下所见”补丁。
规格（区域、画面描述）写在 js/art.js 的 APPRAISE 里，这里只管出图与后期。

  python3 tools/art/appraise.py traces [--only pill_wax ...] [--redo]   遮罩局部改图，生成 art/raw/appraise/<图>_<手法>.png
  python3 tools/art/appraise.py post                                     底图、补丁、照妖镜 → assets/appraise/*.webp
  python3 tools/art/appraise.py sheet [--out 目录]                        联系表：每张底图上圈出区域，并排贴出各补丁合成后的样子

底图与照妖镜由 art/appraise_base.json 用 gpt_image.py batch 生成（底图以物品原图改图，保持同一件东西）。
补丁取改图结果里区域内的一块，按区域外圈与底图对齐颜色，再羽化边缘；改图若整体走了样，对齐误差会打出来。"""
import concurrent.futures as cf
import json, os, subprocess, sys, time
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '../..'))
RAW = os.path.join(GAME, 'art/raw/appraise')
OUT = os.path.join(GAME, 'assets/appraise')
SIZE = 1024
sys.path.insert(0, os.path.expanduser('~/.codex/skills/gpt-image/scripts'))

EDIT_PREFIX = ('Keep this photograph exactly the same: identical object, composition, framing, camera angle, lighting, colors and background. '
               'Only repaint the small area inside the mask, in the same photorealistic macro style, so that it reveals a forgery trace '
               'as if seen through a magic appraisal lens that lets you see through the surface: {d} '
               'The change must stay inside the masked area and blend seamlessly with the untouched surroundings. No text, no markings, no circles drawn.')
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def spec():
    js = r'''
const fs = require("fs"), vm = require("vm");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1], "utf8") + "\nglobalThis.__A = { APPRAISE, LOUPE };", ctx);
console.log(JSON.stringify(ctx.__A));'''
    out = subprocess.run(['node', '-e', js, os.path.join(GAME, 'js/art.js')], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def traces():
    for kind, s in spec()['APPRAISE'].items():
        for t in s['traces']:
            yield kind, s, t


def box(t, pad=1.0):
    x, y, r = t['at']
    R = r * SIZE * pad
    return x * SIZE, y * SIZE, R


def base_img(s):
    return Image.open(os.path.join(RAW, f"{s['img']}.png")).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)


def where(t):
    """区域在图上的方位，给不带遮罩的改图用"""
    x, y, r = t['at']
    h = 'left' if x < 0.4 else 'right' if x > 0.6 else 'center'
    v = 'upper' if y < 0.4 else 'lower' if y > 0.6 else 'middle'
    return (f'in one small spot only, in the {v} {h} part of the picture (a circle about {round(r * 200)} percent of the image width '
            f'centered {round(x * 100)} percent from the left and {round(y * 100)} percent from the top)')


def make_mask(t, path):
    """透明区为重绘区：区域圆略缩一圈，留出外圈好对齐颜色"""
    cx, cy, R = box(t, 0.82)
    m = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 255))
    ImageDraw.Draw(m).ellipse([cx - R, cy - R, cx + R, cy + R], fill=(0, 0, 0, 0))
    m.save(path)


def cmd_traces():
    import gpt_image
    only, redo = [a for a in sys.argv[2:] if not a.startswith('--')], '--redo' in sys.argv
    tmp = os.path.join(RAW, 'masks'); os.makedirs(tmp, exist_ok=True)
    jobs = []
    for kind, s, t in traces():
        name = f"{s['img']}_{t['key']}"
        if only and name not in only: continue
        out = os.path.join(RAW, name + '.png')
        if os.path.exists(out) and not redo: continue
        # 改图的参考图须与遮罩同尺寸
        src = os.path.join(tmp, s['img'] + '_src.png')
        if not os.path.exists(src): base_img(s).save(src)
        mask = os.path.join(tmp, name + '.png'); make_mask(t, mask)
        jobs.append((name, src, mask, t, out))

    def run(j):
        name, src, mask, t, out = j
        models = [gpt_image.DEFAULT_MODEL] + [m for m in gpt_image.FALLBACK if m != gpt_image.DEFAULT_MODEL]
        # 先带遮罩改；中转站对遮罩常报错，连败就不带遮罩、用文字说清位置（反正只取区域那一块）
        tries = [(m, True) for m in models[:2]] + [(m, False) for m in models] * 2
        err = None
        for a, (model, use_mask) in enumerate(tries):
            prompt = EDIT_PREFIX.format(d=t['art'])
            if not use_mask: prompt = prompt.replace('inside the mask', where(t)).replace('inside the masked area', where(t))
            try:
                gpt_image.edit([src], prompt, out, model=model, size='1024x1024', quality='high', mask=mask if use_mask else None)
                return name, 'ok', f"{model}{' 遮罩' if use_mask else ' 无遮罩'}"
            except Exception as e:
                err = repr(e)[:200]
                print(f'  {name} 第{a + 1}次失败 {model}: {err}', flush=True)
            time.sleep(min(60, 8 * 2 ** min(a, 3)))
        return name, 'fail', err
    with cf.ThreadPoolExecutor(4) as ex:
        for name, st, info in ex.map(run, jobs): print(f'[{st}] {name} {info}', flush=True)


def ring_mask(cx, cy, r0, r1, size):
    m = Image.new('L', size, 0); d = ImageDraw.Draw(m)
    d.ellipse([cx - r1, cy - r1, cx + r1, cy + r1], fill=255); d.ellipse([cx - r0, cy - r0, cx + r0, cy + r0], fill=0)
    return m


def patch(s, t):
    """从改图里取区域一块：外圈与底图对齐颜色，羽化成圆。返回 (RGBA 图, 外圈误差)"""
    base = base_img(s)
    ed = Image.open(os.path.join(RAW, f"{s['img']}_{t['key']}.png")).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    cx, cy, R = box(t)
    ring = ring_mask(cx, cy, R * 0.85, R, (SIZE, SIZE))
    mb, me = ImageStat.Stat(base, ring).mean, ImageStat.Stat(ed, ring).mean
    shift = [b - e for b, e in zip(mb, me)]
    ed = Image.merge('RGB', [c.point(lambda v, k=k: max(0, min(255, round(v + k)))) for c, k in zip(ed.split(), shift)])
    err = sum(ImageStat.Stat(ImageChops.difference(base, ed), ring).mean) / 3
    w = round(2 * R)
    crop = ed.crop([round(cx - R), round(cy - R), round(cx - R) + w, round(cy - R) + w])
    a = Image.new('L', (w * 4, w * 4), 0)
    ImageDraw.Draw(a).ellipse([w * 4 * 0.14, w * 4 * 0.14, w * 4 * 0.86, w * 4 * 0.86], fill=255)
    a = a.filter(ImageFilter.GaussianBlur(w * 4 * 0.06)).resize((w, w), Image.LANCZOS)
    crop.putalpha(a)
    return crop, err


def cmd_post():
    os.makedirs(OUT, exist_ok=True)
    A = spec()['APPRAISE']
    for s in A.values():
        base_img(s).save(os.path.join(OUT, f"{s['img']}.webp"), quality=86)
    for kind, s, t in traces():
        if not os.path.exists(os.path.join(RAW, f"{s['img']}_{t['key']}.png")):
            print('缺', s['img'], t['key']); continue
        p, err = patch(s, t)
        p.save(os.path.join(OUT, f"{s['img']}_{t['key']}.webp"), quality=88)
        print(f"{s['img']}_{t['key']}: 外圈误差 {err:.1f}{'  ← 偏大，看一眼' if err > 18 else ''}")
    loupe()


def loupe():
    """照妖镜：镜片画成纯绿，抠掉；量出镜片圆心半径、镜柄末端，换算成相对镜片半径的比例"""
    src = os.path.join(RAW, 'loupe.png')
    if not os.path.exists(src): print('缺照妖镜原图'); return
    im = Image.open(src).convert('RGBA')
    px = im.load(); W, H = im.size
    green = lambda p: p[3] > 0 and p[1] > 140 and p[1] > p[0] * 1.5 and p[1] > p[2] * 1.5
    cand = [(x, y) for y in range(0, H, 3) for x in range(0, W, 3) if green(px[x, y])]
    if not cand: print('照妖镜：没找到绿色镜片'); return
    # 从绿色的中位点泛洪，只取镜片那一片（别处零星的绿不算）
    seed = (sorted(c[0] for c in cand)[len(cand) // 2], sorted(c[1] for c in cand)[len(cand) // 2])
    seen, stack, xs, ys = {seed}, [seed], [], []
    while stack:
        x, y = stack.pop()
        xs.append(x); ys.append(y)
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and green(px[q]):
                seen.add(q); stack.append(q)
    for x, y in seen: px[x, y] = (0, 0, 0, 0)
    # 镜片外沿一圈去绿边、并略扩一点洞
    for y in range(max(0, min(ys) - 6), min(H, max(ys) + 7)):
        for x in range(max(0, min(xs) - 6), min(W, max(xs) + 7)):
            r, g, b, a = px[x, y]
            if a and g > max(r, b) + 20: px[x, y] = (r, max(r, b), b, a)
    gx, gy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    gr = (max(xs) - min(xs) + max(ys) - min(ys)) / 4
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    im = im.crop(bb)
    gx, gy = gx - bb[0], gy - bb[1]
    w, h = im.size
    k = 600 / w
    im = im.resize((600, round(h * k)), Image.LANCZOS)
    im.save(os.path.join(OUT, 'loupe.webp'), quality=90)
    print('LOUPE = ' + json.dumps({'w': round(600 / (gr * k), 3), 'h': round(h * k / (gr * k), 3),
                                   'cx': round(gx * k / (gr * k), 3), 'cy': round(gy * k / (gr * k), 3),
                                   'end': round((h - gy) / gr, 3)}) + '  （以镜片半径为 1）')


def cmd_sheet():
    out = arg('--out', os.path.join(GAME, 'art/audit'))
    os.makedirs(out, exist_ok=True)
    A = spec()['APPRAISE']
    for kind, s in A.items():
        base = base_img(s)
        marked = base.copy(); d = ImageDraw.Draw(marked)
        for t in s['traces']:
            cx, cy, R = box(t); d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(255, 60, 60), width=4)
            d.text((cx - R + 6, cy - R + 6), t['key'], fill=(255, 255, 0))
        tiles = [marked]
        for t in s['traces']:
            p = os.path.join(RAW, f"{s['img']}_{t['key']}.png")
            if not os.path.exists(p): continue
            pt, _ = patch(s, t)
            cx, cy, R = box(t)
            comp = base.copy(); comp.paste(pt, (round(cx - R), round(cy - R)), pt)
            # 只看区域附近，放大两倍
            z = comp.crop([cx - R * 1.4, cy - R * 1.4, cx + R * 1.4, cy + R * 1.4]).resize((512, 512), Image.LANCZOS)
            zb = base.crop([cx - R * 1.4, cy - R * 1.4, cx + R * 1.4, cy + R * 1.4]).resize((512, 512), Image.LANCZOS)
            pair = Image.new('RGB', (1024, 512)); pair.paste(zb, (0, 0)); pair.paste(z, (512, 0))
            tiles.append(pair)
        sh = Image.new('RGB', (1024, sum(t.size[1] for t in tiles)), (20, 20, 20)); y = 0
        for t in tiles: sh.paste(t, (0, y)); y += t.size[1]
        sh.thumbnail((1024, 4096))
        sh.save(os.path.join(out, f"appraise_{s['img']}.jpg"), quality=85)
        print(os.path.join(out, f"appraise_{s['img']}.jpg"))


if __name__ == '__main__':
    {'traces': cmd_traces, 'post': cmd_post, 'sheet': cmd_sheet}[sys.argv[1] if len(sys.argv) > 1 else 'post']()
