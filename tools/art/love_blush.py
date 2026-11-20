#!/usr/bin/env python3
"""情蛊神态的脸红，改成程序后加：模型画的脸红太淡，也常漫到鼻尖下巴。在两颊叠一层柔和的桃红，只染皮肤像素，不碰头发衣裳。
用法：python3 tools/art/love_blush.py <原图> <输出> "x,y,半径;x,y,半径" <浓淡0-255>
例：python3 tools/art/love_blush.py art/raw/chars/leng_fei_smitten.png art/raw/chars/leng_fei_smitten.png "320,152,13;377,141,13" 165
两颊的坐标按原图量（脸常是歪着的，左右颊各写各的）；先输出到别处看准了再覆盖原图，然后跑 postprocess。"""
import sys
from PIL import Image, ImageDraw, ImageFilter
src, out = sys.argv[1], sys.argv[2]
cheeks = [tuple(map(int, c.split(','))) for c in sys.argv[3].split(';')]   # x,y,半径;x,y,半径
alpha = int(sys.argv[4])
im = Image.open(src).convert('RGBA'); w, h = im.size; px = im.load()
m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
for x0, y0, r0 in cheeks: d.ellipse((x0 - r0, y0 - int(r0 * 0.6), x0 + r0, y0 + int(r0 * 0.6)), fill=alpha)
half = max(c[2] for c in cheeks); cx = sum(c[0] for c in cheeks) // len(cheeks); cy = sum(c[1] for c in cheeks) // len(cheeks)
m = m.filter(ImageFilter.GaussianBlur(half * 0.55))
skin = Image.new('L', (w, h), 0); sp = skin.load()
for y in range(max(0, cy - half), min(h, cy + half)):
    for x in range(max(0, cx - 2 * half), min(w, cx + 2 * half)):
        r, g, b, a = px[x, y]
        if a > 200 and r > 150 and r > g and r - b < 90: sp[x, y] = 255
skin = skin.filter(ImageFilter.GaussianBlur(2))
from PIL import ImageChops
m = ImageChops.multiply(m, skin)
pink = Image.new('RGBA', (w, h), (236, 92, 118, 255)); pink.putalpha(m)
Image.alpha_composite(im, pink).save(out)
