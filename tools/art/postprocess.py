#!/usr/bin/env python3
"""把 art/raw 下 gpt-image 原图处理成游戏用的 webp，并生成清单 assets/art.js 与联系表。
- 物品：裁掉透明边，按格子大小（每格 256px）居中放进去
- 人物：裁掉透明边（脚落在图底，方便站位），高 1300
- 场景：1536×1024；shop_front 另切出柜台前景 counter_top（柜台线以上透明）
- 设备 512、图标 128
原图没有透明通道时，从四角泛洪抠掉纯色背景（兜底）。
用法：python3 tools/art/postprocess.py [--sheets /tmp/sheets] [--cut 0.8]"""
import hashlib, json, os, subprocess, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '../..'))
RAW = os.path.join(GAME, 'art/raw')
sys.path.insert(0, HERE)
from specs import TALL

CELL = 256
SIZES = {'beast_hide': (2, 2), 'xian_robe': (2, 2), 'bronze_mirror': (2, 2), 'soul_banner': (2, 3),
         'sword_std': (1, 3), 'xian_sword': (1, 3), 'iron_corpse': (1, 3), 'puppet_doll': (1, 3), 'corpse_king': (1, 3), 'demon_blade': (1, 3)}
GAME_SIZES = {}
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def game_sizes():
    """物品占几格，以游戏数据为准（data.js 与货品册里的 w×h）；读不到就只用上面的表"""
    try:
        out = subprocess.run(['node', '-e', '''
const fs = require("fs"), vm = require("vm"), dir = process.argv[1];
const html = fs.readFileSync(dir + "/index.html", "utf8");
const files = [...html.matchAll(/<script src="([^"]+)"><\\/script>/g)].map(m => m[1]).filter(f => !f.endsWith("ui.js"));
const ctx = { console, Math, JSON, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }; vm.createContext(ctx);
for (const f of files) { try { vm.runInContext(fs.readFileSync(dir + "/" + f, "utf8"), ctx); } catch (e) {} }
vm.runInContext("globalThis.__S = Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [v.icon || k, [v.w, v.h]]));", ctx);
console.log(JSON.stringify(ctx.__S));''', GAME], capture_output=True, text=True, timeout=60)
        return {k: tuple(v) for k, v in json.loads(out.stdout).items()}
    except Exception as e:
        print('读不到游戏里的物品尺寸，只用内置表：', e)
        return {}


def cells(name):
    for k in sorted(GAME_SIZES, key=len, reverse=True):
        if name == k or name.startswith(k + '_'): return GAME_SIZES[k]
    for k in sorted(SIZES, key=len, reverse=True):
        if name == k or name.startswith(k + '_'): return SIZES[k]
    for k in sorted(TALL, key=len, reverse=True):
        if name == k or name.startswith(k + '_'): return (1, 2)
    return (1, 1)


def checker_mask(rgb, levels=None):
    """“画出来的透明格”：两种无彩的灰交替。levels 为边缘上实测的两种灰度；返回这类像素的二值图"""
    r, g, b = rgb.split()
    mx, mn = ImageChops.lighter(ImageChops.lighter(r, g), b), ImageChops.darker(ImageChops.darker(r, g), b)
    flat = ImageChops.subtract(mx, mn).point(lambda v: 255 if v <= 10 else 0)
    if levels: near = mx.point(lambda v: 255 if any(abs(v - c) <= 16 for c in levels) else 0)
    else: near = mx.point(lambda v: 255 if v >= 190 else 0)
    # 先闭运算补上压缩噪点留下的小缺口，泛洪才不会在格子里断开
    return ImageChops.multiply(flat, near).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))


def border_levels(rgb, border):
    """边缘上无彩像素的两种主要灰度（格子的深浅两色）"""
    vals = []
    for p in border:
        c = rgb.getpixel(p)
        if max(c) - min(c) <= 10: vals.append(max(c))
    if len(vals) < len(border) * 0.6: return None
    vals.sort()
    split = (vals[0] + vals[-1]) / 2
    lo, hi = [v for v in vals if v <= split], [v for v in vals if v > split]
    return [sum(x) / len(x) for x in (lo, hi) if x]


def enclosed_checker(m, rgb, levels, min_px=300):
    """胳膊与身子之间这类围住的空当，格子和边缘不连通，泛洪抠不到。
    把 m 里剩下的每块格子色区域量一量：深浅两种灰各占三成以上才是真格子，标成 128 一并抠掉；
    白衣、白发、灰布多半只有一种灰，留着（标 64，免得重复量）"""
    mx = ImageChops.lighter(ImageChops.lighter(*rgb.split()[:2]), rgb.split()[2])
    lo, hi = levels
    w, h = m.size
    for y in range(0, h, 6):
        for x in range(0, w, 6):
            if m.getpixel((x, y)) != 255: continue
            ImageDraw.floodfill(m, (x, y), 32, thresh=0)
            region = m.point(lambda v: 255 if v == 32 else 0)
            hist = mx.histogram(mask=region)
            n = sum(hist)
            dark = sum(hist[max(0, int(lo) - 16):int(lo) + 17])
            light = sum(hist[max(0, int(hi) - 16):int(hi) + 17])
            real = n >= min_px and dark >= n * 0.3 and light >= n * 0.3
            ImageDraw.floodfill(m, (x, y), 128 if real else 64, thresh=0)


def ensure_alpha(im, enclosed=False):
    im = im.convert('RGBA')
    if im.getchannel('A').getextrema()[0] < 250: return im
    w, h = im.size
    rgb = im.convert('RGB')
    border = [(x, y) for x in range(0, w, 16) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 16) for x in (0, w - 1)]
    levels = border_levels(rgb, border)
    m = checker_mask(rgb, levels)
    if sum(m.getpixel(p) for p in border) / 255 > len(border) * 0.6:
        # 模型把透明底画成了灰白格子：只抠与边缘连通的格子，人物身上的白发白衣不受影响
        for p in border:
            if m.getpixel(p) == 255: ImageDraw.floodfill(m, p, 128, thresh=0)
        # 只给人物立绘抠围住的格子：物品图上的灰白斑纹会被误认
        # 真格子是两种浅灰（实测差 12–60）；两种“灰”几乎一样（差不到 8，模型给了一整片纯黑、纯白底）就不是格子，
        # 偏暗的（浅的那格不到 150）更不是——这时再去抠围住的“格子”，会把黑发、深色衣裳当成格子挖成窟窿
        if enclosed and levels and len(levels) == 2 and levels[1] - levels[0] >= 8 and levels[1] >= 150: enclosed_checker(m, rgb, levels)
        bg = m.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(5))
    else:
        # 纯色底：四角泛洪
        tmp = rgb.copy()
        for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
            ImageDraw.floodfill(tmp, corner, (255, 0, 254), thresh=28)
        r, g, b = tmp.split()
        bg = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0)),
                                 b.point(lambda v: 255 if v == 254 else 0))
    im.putalpha(ImageChops.invert(bg).filter(ImageFilter.GaussianBlur(1)))
    return im


def trim(im, pad=0):
    bb = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    return im.crop(bb) if bb else im


def fit(im, W, H, margin=0.06):
    im = trim(im)
    s = min(W * (1 - 2 * margin) / im.width, H * (1 - 2 * margin) / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(im, ((W - im.width) // 2, (H - im.height) // 2), im)
    return out


def save(im, dir, name, q=82):
    os.makedirs(os.path.join(GAME, 'assets', dir), exist_ok=True)
    im.save(os.path.join(GAME, 'assets', dir, f'{name}.webp'), 'WEBP', quality=q, method=6)


def process():
    global GAME_SIZES
    GAME_SIZES = game_sizes()
    done = []
    for dir in ['items', 'chars', 'scene', 'machines', 'ui']:
        src = os.path.join(RAW, dir)
        if not os.path.isdir(src): continue
        for f in sorted(os.listdir(src)):
            if not f.endswith('.png'): continue
            name, path = f[:-4], os.path.join(src, f)
            out = os.path.join(GAME, 'assets', dir, f'{name}.webp')
            if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(path):
                done.append(f'{dir}/{name}'); continue
            im = Image.open(path)
            if dir == 'items':
                w, h = cells(name)
                save(fit(ensure_alpha(im), w * CELL, h * CELL), dir, name)
            elif dir == 'chars':
                im = trim(ensure_alpha(im, enclosed=True))
                s = 1300 / im.height
                save(im.resize((round(im.width * s), 1300), Image.LANCZOS), dir, name, 80)
            elif dir == 'scene':
                im = im.convert('RGB')
                # 场景一律裁成 3:2（界面的画框就是 3:2），居中裁
                W, H = im.size
                if W / H > 1.5: im = im.crop(((W - round(H * 1.5)) // 2, 0, (W + round(H * 1.5)) // 2, H))
                elif W / H < 1.5: im = im.crop((0, (H - round(W / 1.5)) // 2, W, (H + round(W / 1.5)) // 2))
                im = im.resize((1536, 1024), Image.LANCZOS)
                save(im, dir, name, 78)
                if name == 'shop_front':
                    # 柜台面以下是前景；右侧天平立得高，一并算进前景（从左盘起算，别把右门扇上的打烊牌切进来）
                    cut = float(arg('--cut', '0.755'))
                    fg = im.convert('RGBA')
                    a = Image.new('L', im.size, 0)
                    W, H = im.size
                    ImageDraw.Draw(a).rectangle([0, int(H * cut), W, H], fill=255)
                    ImageDraw.Draw(a).rectangle([int(W * 0.795), int(H * 0.39), int(W * 0.985), H], fill=255)
                    fg.putalpha(a.filter(ImageFilter.GaussianBlur(3)))
                    save(fg, dir, 'counter_top', 80)
                    done.append('scene/counter_top')
            elif dir == 'machines':
                save(fit(ensure_alpha(im), 512, 512, 0.04), dir, name)
            else:
                save(fit(ensure_alpha(im), 128, 128, 0.04), dir, name, 85)
            done.append(f'{dir}/{name}')
    # 清单以 assets 里实际有的 webp 为准（counter_top 这类派生图也算上）
    done = sorted(f'{d}/{f[:-5]}' for d in ['items', 'chars', 'scene', 'machines', 'ui']
                  if os.path.isdir(os.path.join(GAME, 'assets', d)) for f in os.listdir(os.path.join(GAME, 'assets', d)) if f.endswith('.webp'))
    # 图片在浏览器里缓存一天：每张带上内容摘要，重画过的图换了网址，不会拿旧图配新代码
    rev = {n: hashlib.md5(open(os.path.join(GAME, 'assets', f'{n}.webp'), 'rb').read()).hexdigest()[:6] for n in done}
    with open(os.path.join(GAME, 'assets/art.js'), 'w') as fp:
        fp.write('// 由 tools/art/postprocess.py 生成：已有的写实图（webp）清单\nconst ART_LIST = ' + json.dumps(done) + ';\n'
                 '// 每张图的内容摘要，asset() 拼进网址\nconst ART_REV = ' + json.dumps(rev, separators=(',', ':')) + ';\n')
    print(f'{len(done)} webp')
    return done


def sheets(outdir):
    os.makedirs(outdir, exist_ok=True)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    except Exception: font = ImageFont.load_default()
    for dir in ['items', 'chars', 'scene', 'machines', 'ui']:
        d = os.path.join(GAME, 'assets', dir)
        names = sorted(f for f in os.listdir(d) if f.endswith('.webp')) if os.path.isdir(d) else []
        if not names: continue
        T = 200 if dir in ('chars', 'scene') else 150
        cols = 8
        for page in range(0, len(names), cols * 6):
            chunk = names[page:page + cols * 6]
            rows = (len(chunk) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * T, rows * (T + 18)), (40, 30, 45))
            dr = ImageDraw.Draw(sheet)
            for i, n in enumerate(chunk):
                im = Image.open(os.path.join(d, n)).convert('RGBA')
                im.thumbnail((T - 6, T - 6))
                x, y = (i % cols) * T, (i // cols) * (T + 18)
                sheet.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2), im)
                dr.text((x + 3, y + T), n[:-5][:22], fill=(240, 220, 160), font=font)
            sheet.save(os.path.join(outdir, f'{dir}_{page // (cols * 6) + 1}.jpg'), quality=85)


if __name__ == '__main__':
    process()
    if '--sheets' in sys.argv: sheets(arg('--sheets', '/tmp/sheets'))
