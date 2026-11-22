# GitHub 介绍页（README.md）里的拼图：人物群像、神态、物品品阶、拾荒地点，出到 docs/readme/
#   python3 tools/readme/collage.py               全部重出
#   python3 tools/readme/collage.py moods cast     只出其中几张（cast / moods / items / places）
# 神态那张用 MOODS_CID 这个人：年轻好看的女子，八种神态立绘都得齐（情蛊只有成年女子才有）
import os, re, json, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
MOODS_CID = 'yao_fox_f2'   # 狐妖：神态一眼分得清
OUT = os.path.join(ROOT, 'docs/readme')
os.makedirs(OUT, exist_ok=True)
A = lambda *p: os.path.join(ROOT, 'assets', *p)
FONT = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
f = lambda s: ImageFont.truetype(FONT, s, index=2)  # SC
BG = (24, 14, 22)
GOLD = (226, 186, 110)
DIM = (170, 140, 150)

def cast_info():
    info = {}
    for fn in sorted(os.listdir(os.path.join(ROOT, 'js/cast'))):
        s = open(os.path.join(ROOT, 'js/cast', fn), encoding='utf8').read()
        n, t, fa = (re.search(r'"%s":\s*"([^"]+)"' % k, s) for k in ('name', 'title', 'faction'))
        if n and t and fa: info[fn[:-3]] = (n.group(1), t.group(1), fa.group(1))
    return info

def portrait(path, w, h, top=0.0, frac=0.62):
    im = Image.open(path).convert('RGBA')
    ch = int(im.height * frac)
    y0 = int(im.height * top)
    im = im.crop((0, y0, im.width, min(im.height, y0 + ch)))
    s = min(w / im.width, h / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    return im

def card_bg(w, h, tint):
    g = Image.new('RGB', (w, h), BG)
    d = ImageDraw.Draw(g)
    for y in range(h):
        k = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(BG[i] * (1 - k * 0.3) + tint[i] * k * 0.35) for i in range(3)))
    return g

TINT = {'ren': (200, 150, 80), 'xian': (90, 150, 210), 'mo': (200, 40, 60), 'yao': (90, 180, 110)}
FNAME = {'ren': '人族', 'xian': '仙门', 'mo': '魔宗', 'yao': '妖族'}

def grid_cast():
    info = cast_info()
    pick = {'ren': ['shen_suxin', 'yuanxing', 'lu_tiechui', 'su_cailing'],
            'xian': ['bai_chuandeng', 'yue_qingshi', 'su_wanyin', 'duan_yinghuo'],
            'mo': ['tu_baigu', 'wan_jinluo', 'gui_dengpo', 'yan_fengjiu'],
            'yao': ['ao_xunlan', 'tu_caiwei', 'dan_lingyu', 'xiao_gengye']}
    cw, ch, lab = 240, 330, 62
    cols = 8
    order = []
    for i in range(4):
        for fa in ('ren', 'xian', 'mo', 'yao'):
            order.append((fa, pick[fa][i]))
    rows = (len(order) + cols - 1) // cols
    W, H = cw * cols, (ch + lab) * rows
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    for k, (fa, cid) in enumerate(order):
        x, y = (k % cols) * cw, (k // cols) * (ch + lab)
        img.paste(card_bg(cw - 6, ch + lab - 6, TINT[fa]), (x + 3, y + 3))
        p = portrait(A('chars', cid + '.webp'), cw - 10, ch)
        img.paste(p, (x + (cw - p.width) // 2, y + ch - p.height), p)
        n, t, _ = info[cid]
        d.text((x + cw // 2, y + ch + 16), n, font=f(26), fill=GOLD, anchor='mm')
        d.text((x + cw // 2, y + ch + 46), f'{FNAME[fa]} · {t}', font=f(16), fill=DIM, anchor='mm')
        d.rectangle([x + 3, y + 3, x + cw - 4, y + ch + lab - 4], outline=TINT[fa] + (0,), width=1)
    img.save(os.path.join(OUT, 'cast.webp'), quality=86)

def moods():
    cid = MOODS_CID
    lst = [('', '平常'), ('pleased', '欢喜'), ('angry', '恼怒'), ('afraid', '惊惧'), ('sly', '狡黠'), ('smitten', '情蛊'), ('thrall', '受控'), ('wasted', '萎靡')]
    cw, ch, lab = 230, 300, 48
    W = cw * len(lst)
    img = Image.new('RGB', (W, ch + lab), BG)
    d = ImageDraw.Draw(img)
    for k, (m, name) in enumerate(lst):
        x = k * cw
        img.paste(card_bg(cw - 6, ch + lab - 6, (150, 60, 90)), (x + 3, 3))
        p = portrait(A('chars', f'{cid}{"_" + m if m else ""}.webp'), cw - 6, ch, frac=0.45)
        img.paste(p, (x + (cw - p.width) // 2, ch - p.height), p)
        d.text((x + cw // 2, ch + 22), name, font=f(24), fill=GOLD, anchor='mm')
    img.save(os.path.join(OUT, 'moods.webp'), quality=86)

def items():
    data = open(os.path.join(ROOT, 'js/data.js'), encoding='utf8').read()
    name = lambda i: re.search(r'\b%s:\s*\{ name: \'([^\']+)\'' % i, data) or re.search(r'\b%s:\s*\{\s*name:\s*\'([^\']+)\'' % i, data)
    have = sorted(fn[:-9] for fn in os.listdir(A('items')) if fn.endswith('_top.webp'))
    want = ['pill_found', 'bronze_mirror', 'jade_pendant', 'gu', 'blood_infant', 'bone_flute', 'soul_pearl', 'spirit_wine', 'demon_core', 'talisman']
    ids = [i for i in want if i in have]
    for i in have:
        if len(ids) >= 8: break
        if i not in ids and name(i): ids.append(i)
    ids = ids[:8]
    tiers = [('_low', '下品'), ('', '中品'), ('_high', '上品'), ('_top', '极品')]
    cs, lab_w, head = 150, 110, 56
    W, H = lab_w + cs * len(ids), head + cs * len(tiers)
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    for c, i in enumerate(ids):
        m = name(i)
        d.text((lab_w + c * cs + cs // 2, head // 2), m.group(1) if m else i, font=f(22), fill=GOLD, anchor='mm')
    for r, (suf, tn) in enumerate(tiers):
        y = head + r * cs
        d.text((lab_w // 2, y + cs // 2), tn, font=f(26), fill=[(150, 140, 140), (200, 200, 200), (120, 190, 255), (255, 200, 90)][r], anchor='mm')
        for c, i in enumerate(ids):
            x = lab_w + c * cs
            d.rounded_rectangle([x + 6, y + 6, x + cs - 6, y + cs - 6], 10, fill=(40, 26, 36), outline=(80, 56, 70))
            p = Image.open(A('items', f'{i}{suf}.webp')).convert('RGBA')
            p.thumbnail((cs - 20, cs - 20), Image.LANCZOS)
            img.paste(p, (x + (cs - p.width) // 2, y + (cs - p.height) // 2), p)
    img.save(os.path.join(OUT, 'items.webp'), quality=88)
    return ids

def places():
    lst = [('loc_scrapyard', '炼器坊废料场'), ('loc_graveyard', '乱葬岗'), ('loc_beastcave', '万魔窟外围'), ('loc_battlefield', '古战场'), ('loc_ruins', '宗门废墟'), ('ghost_market', '鬼市')]
    tw, th = 420, 260
    cols = 3
    W, H = tw * cols, (th) * ((len(lst) + cols - 1) // cols)
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    for k, (fn, name) in enumerate(lst):
        x, y = (k % cols) * tw, (k // cols) * th
        p = Image.open(A('scene', fn + '.webp')).convert('RGB')
        s = max(tw / p.width, th / p.height)
        p = p.resize((int(p.width * s) + 1, int(p.height * s) + 1), Image.LANCZOS)
        p = p.crop(((p.width - tw) // 2, (p.height - th) // 2, (p.width - tw) // 2 + tw, (p.height - th) // 2 + th))
        img.paste(p, (x, y))
        shade = Image.new('RGBA', (tw, 50), (0, 0, 0, 150))
        img.paste(shade, (x, y + th - 50), shade)
        d.text((x + tw // 2, y + th - 25), name, font=f(24), fill=GOLD, anchor='mm')
        d.rectangle([x, y, x + tw - 1, y + th - 1], outline=BG, width=3)
    img.save(os.path.join(OUT, 'places.webp'), quality=84)

JOBS = {'cast': grid_cast, 'moods': moods, 'items': items, 'places': places}
for k in sys.argv[1:] or JOBS:
    r = JOBS[k]()
    print(k, r if r else 'ok')
