#!/usr/bin/env python3
"""抠纯色幕布：让模型把背景画成一整片纯绿（或纯蓝），再按“这一色压过另外两色多少”算透明度，边缘去溢色。
gpt-image 画“透明底”时常给假的灰白格子、或一整片纯黑，抠图会把黑发、深色衣裳一并挖掉；纯色幕布抠起来稳。
用法：python3 tools/art/chroma_key.py <原图.png> [...] [--key green|blue] [--despill] [--repair] [--tone] [--ref 底图]（--tone：不透明处也压到人物惯常的色调，薄纱被画成幕布色调时用）（--repair：已抠好的再还原一遍颜色；去溢色按底图里人物自己的色调，默认找 assets/chars/<面孔>.webp）
原图就地改成带透明的 PNG（postprocess 见到已有透明度就原样收下）。"""
import os
import shutil
import sys
from PIL import Image, ImageChops


# 幕布色：哪一通道是幕布、另两通道是什么
CH = {'green': 1, 'blue': 2}
SCREEN_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../art/screen'))


def key_out(im, key='green', ratio=None, opaque_cap=False):
    im = im.convert('RGBA')
    ch = list(im.split()[:3])
    k = CH[key]
    other = ImageChops.lighter(*[c for i, c in enumerate(ch) if i != k])
    dom = ImageChops.subtract(ch[k], other)
    # 幕布色压过另两色 18 以内的算人物，压过 83 以上的算幕布，中间渐变
    alpha = dom.point(lambda v: round((1 - min(1, max(0, (v - 18) / 65))) * 255))
    out = Image.merge('RGBA', (*ch, alpha))
    return fix_colors(out, im, key, ratio, opaque_cap=opaque_cap)


def base_ratio(ref, key):
    """人物自己的色调：底图里，幕布那一通道落在另两通道之间的什么位置（0 = 贴着低的那个，1 = 顶到高的那个），取中位数。
    红衣裳底图里蓝几乎贴着绿（≈0），去溢色就该压到那儿；压到跟红一样高就成了紫"""
    k = CH[key]; im = ref.convert('RGBA'); px = im.load(); w, h = im.size; v = []
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            c = px[x, y]
            if c[3] < 240: continue
            o = [c[i] for i in range(3) if i != k]; hi, lo = max(o), min(o)
            if hi - lo > 20: v.append(min(1, max(0, (c[k] - lo) / (hi - lo))))
    v.sort()
    # 中位数给溢色用；上四分位给半透明处封顶（纱、飘带上本色可以稍偏一点，但不该比人物惯常的色调更偏幕布色）
    return (v[len(v) // 2], v[len(v) * 3 // 4]) if v else (1.0, 1.0)


def fix_colors(out, src, key, ratio=None, cap_only=False, opaque_cap=False):
    """两步还原颜色：
    半透明处（薄纱、飘带、发丝）：看到的颜色 = a×本色 + (1-a)×幕布色，把幕布色除回去（src 为没抠的原图；缺了就由透明度反推幕布那一通道）。
    溢色（幕布那一通道高过另两通道）：压回人物自己的色调（ratio，见 base_ratio）；没给底图就压平到另两通道里高的那个"""
    k = CH[key]; r_, r_hi = (1.0, 1.0) if ratio is None else ratio
    o = out.load(); s = src.load() if src is not None else None
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = o[x, y]
            if a < 20: continue
            c = list(s[x, y][:3]) if s is not None else [r, g, b]
            if cap_only:
                # 已经还原过的图：只给半透明处封顶，不再除第二遍幕布色
                if a < 255:
                    oth = [c[i] for i in range(3) if i != k]; hi, lo = max(oth), min(oth)
                    c[k] = min(c[k], lo + r_hi * (hi - lo))
                    o[x, y] = (*[max(0, min(255, round(v))) for v in c], a)
                continue
            if a < 255:
                # 半透明处：只把幕布那一通道压掉，另两通道照原样（不除透明度）。
                # 模型画的薄纱、阴影本来就暗，透明度又是从幕布色压过另两色多少估出来的，并不准：
                # 把另两通道也除以透明度，暗的纱会被放大成刺眼的黄、橙（实测褐色纱 74,57,118 → 123,95,27）
                if s is None: c[k] = max(c[i] for i in range(3) if i != k) + 18 + 65 * (1 - a / 255)
            oth = [c[i] for i in range(3) if i != k]; hi, lo = max(oth), min(oth)
            if c[k] > hi or (s is None and a == 255 and c[k] == hi and hi - lo > 25):
                c[k] = lo + r_ * (hi - lo)
            elif a < 255 or opaque_cap:
                # opaque_cap：不透明处也封顶——薄纱透着幕布，模型直接画成了不透明的偏色（红纱透蓝幕画成紫）
                c[k] = min(c[k], lo + r_hi * (hi - lo))
            o[x, y] = (*[max(0, min(255, round(v))) for v in c], a)
    return out


def despill(r, g, b, key='green'):
    """只压平（不看人物色调）：幕布那一色压回另两色里高的那个"""
    ch = [r, g, b]; k = CH[key]
    ch[k] = ImageChops.darker(ch[k], ImageChops.lighter(*[c for i, c in enumerate(ch) if i != k]))
    return ch


def ref_for(p, ref):
    """人物底图：--ref 给了就用它；“xx_smitten.png” 这类神态图默认找 assets/chars/xx.webp"""
    if ref: return ref
    name = os.path.basename(p)[:-4]
    base = name.rsplit('_', 1)[0] if '_' in name else name
    q = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../assets/chars', base + '.webp'))
    return q if os.path.exists(q) else None


if __name__ == '__main__':
    args = sys.argv[1:]
    key = 'green'
    if '--key' in args:
        i = args.index('--key'); key = args[i + 1]; del args[i:i + 2]
    only_despill = '--despill' in args
    if only_despill: args.remove('--despill')
    repair = '--repair' in args
    if repair: args.remove('--repair')
    cap_only = '--cap' in args
    if cap_only: args.remove('--cap')
    opaque_cap = '--tone' in args
    if opaque_cap: args.remove('--tone')
    ref = None
    if '--ref' in args:
        i = args.index('--ref'); ref = args[i + 1]; del args[i:i + 2]
    for p in args:
        im = Image.open(p)
        if repair:
            # 已经抠好、没留原图的：由透明度反推幕布那一通道，把半透明处的本色还原
            rr = base_ratio(Image.open(ref_for(p, ref)), key) if ref_for(p, ref) else None
            fix_colors(im.convert('RGBA'), None, key, rr, cap_only).save(p)
            print('unmixed', p, key)
        elif only_despill:
            # 已经抠好的图：只补一遍去溢色（透明度不动）
            r, g, b, a = im.convert('RGBA').split()
            Image.merge('RGBA', (*despill(r, g, b, key), a)).save(p)
            print('despilled', p, key)
        elif im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 250:
            # 已经抠过的（有透明了）：再抠一遍会把抠掉的地方当成黑底、整张变不透明
            print('skip (already keyed)', p)
        else:
            # 先留一份没抠的原图（art/screen/），抠坏了能重抠，不必重画
            os.makedirs(SCREEN_DIR, exist_ok=True)
            shutil.copy2(p, os.path.join(SCREEN_DIR, os.path.basename(p)))
            rr = base_ratio(Image.open(ref_for(p, ref)), key) if ref_for(p, ref) else None
            key_out(im, key, rr, opaque_cap).save(p)
            print('keyed', p, key, '' if rr is None else f'色调 {rr[0]:.2f}/{rr[1]:.2f}')
