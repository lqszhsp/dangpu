#!/usr/bin/env python3
"""照妖镜的荧光图：作伪补丁与底图逐像素比较，改动过的地方就是作伪痕迹，做成一张荧光（紫外灯下发亮）的图。
游戏里镜片内整体压成紫外灯下的暗紫，作伪处叠这张荧光图，一眼就看得出来。
产出 assets/appraise/<img>_<key>_uv.webp，与补丁同尺寸、同位置；补丁重画后重跑一次。
用法：python3 tools/art/appraise_uv.py [--preview 预览.png]"""
import os, re, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '../..'))
DIR = os.path.join(ROOT, 'assets/appraise')
GLOW = (190, 255, 60)   # 荧光黄绿


def traces():
    """从 js/art.js 读出每处作伪的 [底图, key, x, y, r]"""
    src = open(os.path.join(ROOT, 'js/art.js'), encoding='utf8').read()
    out = []
    for block in re.finditer(r"img: '(\w+)',\s*traces: \[(.*?)\n    \],", src, re.S):
        img = block.group(1)
        for k, x, y, r in re.findall(r"key: '(\w+)'.*?at: \[([\d.]+), ([\d.]+), ([\d.]+)\]", block.group(2), re.S):
            out.append((img, k, float(x), float(y), float(r)))
    return out


def uv(img, key, x, y, r):
    base = Image.open(os.path.join(DIR, f'{img}.webp')).convert('RGB')
    patch = Image.open(os.path.join(DIR, f'{img}_{key}.webp')).convert('RGBA')
    W = base.width
    box = (round((x - r) * W), round((y - r) * W))
    crop = base.crop((box[0], box[1], box[0] + patch.width, box[1] + patch.height))
    # 差异：亮度差为主，补丁自带的羽化边缘按 alpha 削掉
    diff = ImageChops.difference(patch.convert('RGB'), crop).convert('L')
    diff = ImageChops.multiply(diff, patch.getchannel('A'))
    diff = diff.filter(ImageFilter.GaussianBlur(patch.width * 0.006))
    # 拉开对比：细微的差别不亮，真正改过的地方亮透。按这块补丁自己的差异定上限，改得再细的作伪也亮得起来
    hist = diff.histogram(); n = sum(hist); acc = 0; p97 = 255
    for v, c in enumerate(hist):
        acc += c
        if acc >= n * 0.97: p97 = v; break
    hi = max(28, min(70, p97)); lo = hi * 0.25
    core = diff.point(lambda v: 0 if v <= lo else 255 if v >= hi else int((v - lo) * 255 / (hi - lo)))
    halo = core.filter(ImageFilter.GaussianBlur(patch.width * 0.03)).point(lambda v: min(255, int(v * 1.6)))
    a = ImageChops.lighter(core, halo.point(lambda v: int(v * 0.7)))
    # 圆形边界：补丁外缘不出光
    m = Image.new('L', patch.size, 0)
    ImageDraw.Draw(m).ellipse((patch.width * 0.04, patch.height * 0.04, patch.width * 0.96, patch.height * 0.96), fill=255)
    a = ImageChops.multiply(a, m.filter(ImageFilter.GaussianBlur(patch.width * 0.04)))
    out = Image.new('RGBA', patch.size, GLOW + (0,))
    # 越亮的地方越偏白，像荧光饱和
    white = core.point(lambda v: int(v * 0.45))
    rgb = Image.composite(Image.new('RGB', patch.size, (245, 255, 210)), Image.new('RGB', patch.size, GLOW), white)
    out = rgb.convert('RGBA'); out.putalpha(a)
    out.save(os.path.join(DIR, f'{img}_{key}_uv.webp'), 'WEBP', quality=90, method=6)
    return out, a.getbbox(), sum(a.histogram()[40:]) / (patch.width * patch.height)


def main():
    rows = []
    for t in traces():
        im, bb, cover = uv(*t)
        print(f'{t[0]}_{t[1]}：荧光覆盖 {cover:.0%}')
        rows.append((t, im))
    if '--preview' in sys.argv:
        S = 220
        sheet = Image.new('RGB', (S * 3, S * len(rows)), (20, 10, 30))
        for i, ((img, key, *_), im) in enumerate(rows):
            p = Image.open(os.path.join(DIR, f'{img}_{key}.webp')).convert('RGBA').resize((S, S))
            g = im.resize((S, S))
            dark = Image.new('RGBA', (S, S), (40, 20, 70, 255)); dark.alpha_composite(p)
            sheet.paste(p.convert('RGB'), (0, i * S))
            gl = Image.new('RGBA', (S, S), (0, 0, 0, 255)); gl.alpha_composite(g)
            sheet.paste(gl.convert('RGB'), (S, i * S))
            mix = dark.copy(); mix.alpha_composite(g)
            sheet.paste(mix.convert('RGB'), (2 * S, i * S))
        sheet.save(sys.argv[sys.argv.index('--preview') + 1])


if __name__ == '__main__':
    main()
