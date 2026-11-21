#!/usr/bin/env python3
"""受控神态的头顶黑雾，改成程序后加：gpt-image 画半透明的雾时常把雾画在假的灰白格子上，抠不干净。
先让模型画不带雾的受控神态（抠图干净），再用本脚本在头后面铺一团淡淡的暗雾，存回带透明的原图，postprocess 原样收下。
用法：python3 tools/art/thrall_mist.py <面孔> [...]   例：python3 tools/art/thrall_mist.py hui_qiaosuo
处理 art/raw/chars/<面孔>_thrall.png；同一张脸每次加出来的雾一样（按名字定随机种子）。"""
import os, random, sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from postprocess import ensure_alpha

RAW = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../art/raw/chars'))


def add_mist(name):
    path = os.path.join(RAW, f'{name}_thrall.png')
    fig = ensure_alpha(Image.open(path), enclosed=True)
    w, h = fig.size
    a = fig.getchannel('A')
    l, t, r, b = a.getbbox()
    # 头：人物最上面约六分之一；横向取这一段不透明像素的 10%–90% 分位，免得抠图边上几点残渣把头量宽
    head_h = (b - t) // 6
    xs = sorted(x for y in range(t, t + head_h, 2) for x in range(l, r, 2) if a.getpixel((x, y)) > 200)
    if not xs: xs = [(l + r) // 2]
    x0, x1 = xs[len(xs) // 10], xs[len(xs) * 9 // 10]
    # 头旁边举着幡、扛着扁担的：最上面这一段不止一个头。按身子的中线挑离它最近的那一团（中间断开 ≥ 12 像素就算两团）
    mid = sum(x for y in range(t + (b - t) // 3, t + (b - t) // 2, 4) for x in range(l, r, 4) if a.getpixel((x, y)) > 200)
    cnt = sum(1 for y in range(t + (b - t) // 3, t + (b - t) // 2, 4) for x in range(l, r, 4) if a.getpixel((x, y)) > 200)
    body = mid / cnt if cnt else (l + r) / 2
    runs, start = [], xs[0]
    for p0, p1 in zip(xs, xs[1:] + [10 ** 9]):
        if p1 - p0 >= 12: runs.append((start, p0)); start = p1
    if len(runs) > 1:
        x0, x1 = min(runs, key=lambda rr: 0 if rr[0] <= body <= rr[1] else min(abs(rr[0] - body), abs(rr[1] - body)))
    cx, cy, rad = (x0 + x1) // 2, t + head_h // 2, max(60, (x1 - x0) * 0.9)
    rng = random.Random(name)
    mist = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mist)
    for _ in range(90):
        ang, dist = rng.uniform(0, 6.283), rng.uniform(0.2, 1.0) * rad
        x, y = cx + dist * rng.uniform(-1.2, 1.2), cy + dist * rng.uniform(-1.0, 0.7)
        s = rng.uniform(0.12, 0.32) * rad
        d.ellipse((x - s, y - s, x + s, y + s), fill=rng.randint(40, 110))
    mist = mist.filter(ImageFilter.GaussianBlur(rad * 0.18)).point(lambda v: min(150, int(v * 1.6)))
    layer = Image.new('RGBA', (w, h), (58, 48, 70, 0))
    layer.putalpha(mist)
    layer.alpha_composite(fig)
    layer.save(path)
    print(f'{name}_thrall：头在 ({cx}, {cy})，雾半径 {int(rad)}')


if __name__ == '__main__':
    for n in sys.argv[1:] or sys.exit(__doc__): add_mist(n)
