#!/usr/bin/env python3
"""极品档图标改用底图程序合成：模型改图画光晕时常把光晕画在假的灰白格子上，抠不干净、边缘一圈锯齿；竖长物品还会被宽光晕挤小。
做法：底图抠干净 → 物件提亮、加暖 → 贴着轮廓加一圈金白光晕 → 撒几颗光点，存回 art/raw/items/<id>_top.png，postprocess 原样收下。
用法：python3 tools/art/top_glow.py <物品> [...]   例：python3 tools/art/top_glow.py spider_silk datura_seed
同一件东西每次合成一样（按名字定随机种子）。注意：之后再跑 goods.mjs art <id> --redo top 会被模型图覆盖。"""
import os, random, sys
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from postprocess import ensure_alpha

RAW = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../art/raw/items'))


def compose(name):
    base = ensure_alpha(Image.open(os.path.join(RAW, f'{name}.png')))
    w, h = base.size
    a = base.getchannel('A')
    # 物件：亮一些、暖一些、更饱和
    rgb = ImageEnhance.Brightness(base.convert('RGB')).enhance(1.12)
    rgb = ImageEnhance.Color(rgb).enhance(1.15)
    warm = Image.new('RGB', (w, h), (255, 214, 140))
    rgb = Image.blend(rgb, ImageChops.multiply(rgb, warm), 0.25)
    obj = rgb.convert('RGBA'); obj.putalpha(a)
    # 光晕：轮廓向外扩一圈再羽化，里亮外淡
    solid = a.point(lambda v: 255 if v > 60 else 0)
    bb = solid.getbbox() or (0, 0, w, h)
    size = max(bb[2] - bb[0], bb[3] - bb[1])
    near = solid.filter(ImageFilter.MaxFilter(_odd(size * 0.03))).filter(ImageFilter.GaussianBlur(size * 0.02))
    far = solid.filter(ImageFilter.MaxFilter(_odd(size * 0.06))).filter(ImageFilter.GaussianBlur(size * 0.05))
    halo_a = ImageChops.lighter(near.point(lambda v: int(v * 0.85)), far.point(lambda v: int(v * 0.45)))
    halo = Image.new('RGBA', (w, h), (255, 236, 180, 0)); halo.putalpha(halo_a)
    # 光点：撒在轮廓外沿
    rng = random.Random(name)
    sparks = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(sparks)
    edge = ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(_odd(size * 0.08))), solid)
    pts = [(x, y) for y in range(bb[1], bb[3], 7) for x in range(bb[0], bb[2], 7) if edge.getpixel((x, y))]
    for x, y in rng.sample(pts, min(len(pts), 14)):
        r = rng.uniform(2, 5) * size / 600
        d.ellipse((x - r, y - r, x + r, y + r), fill=rng.randint(170, 255))
    sparks = sparks.filter(ImageFilter.GaussianBlur(1.2))
    spark = Image.new('RGBA', (w, h), (255, 248, 220, 0)); spark.putalpha(sparks)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(halo); out.alpha_composite(obj); out.alpha_composite(spark)
    out.save(os.path.join(RAW, f'{name}_top.png'))
    print(f'{name}_top：由底图合成')


def _odd(v):
    v = max(3, int(v)); return v if v % 2 else v + 1


if __name__ == '__main__':
    for n in sys.argv[1:] or sys.exit(__doc__): compose(n)
