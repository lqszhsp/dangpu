# GitHub 介绍页里的拼图：人物群像、神态、物品品阶、拾荒地点，出到 docs/readme/。
# 每张出中英两版：<名>.webp 给中文页 README.zh-CN.md，<名>.en.webp 给英文首页 README.md
#   python3 tools/readme/collage.py               全部重出
#   python3 tools/readme/collage.py moods cast     只出其中几张（cast / moods / items / places）
# 神态那张用 MOODS_CID 这个人：年轻好看的女子，八种神态立绘都得齐（情蛊只有成年女子才有）。
# 有 docs/readme/moods/ 的高清特写（tools/readme/moods_closeup.py 用 gpt-image 重画的）就用特写，没有就裁游戏立绘
import os, re, json, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
MOODS_CID = 'yao_fox_f2'   # 狐妖：神态一眼分得清
MOODS = [('', '平常'), ('pleased', '欢喜'), ('angry', '恼怒'), ('afraid', '惊惧'), ('sly', '狡黠'), ('smitten', '情蛊'), ('thrall', '受控'), ('wasted', '萎靡')]
OUT = os.path.join(ROOT, 'docs/readme')
A = lambda *p: os.path.join(ROOT, 'assets', *p)
FONT = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
f = lambda s: ImageFont.truetype(FONT, s, index=2)  # SC
BG = (24, 14, 22)
GOLD = (226, 186, 110)
DIM = (170, 140, 150)

# 英文版的标签：中文 → 英文。人名用拼音
EN = {
    # 神态
    '平常': 'Neutral', '欢喜': 'Pleased', '恼怒': 'Angry', '惊惧': 'Afraid', '狡黠': 'Sly', '情蛊': 'Love-struck', '受控': 'Enthralled', '萎靡': 'Wasted',
    # 势力
    '人族': 'Mortals', '仙门': 'Immortal Sect', '魔宗': 'Demon Sect', '妖族': 'Yao Spirits',
    # 人物与身份
    '沈素心': 'Shen Suxin', '巷口女郎中': 'Alley Physician', '圆行': 'Yuanxing', '行脚僧': 'Wandering Monk',
    '鲁铁锤': 'Lu Tiechui', '街炉铁匠': 'Street Blacksmith', '苏采苓': 'Su Cailing', '采药女散修': 'Herb-Gathering Cultivator',
    '白传灯': 'Bai Chuandeng', '老妪传功长老': 'Elder of Teachings', '岳青石': 'Yue Qingshi', '镇岳院护山武修': 'Mountain Warden',
    '苏晚音': 'Su Wanyin', '回音谷箫师': 'Echo Valley Flautist', '段映火': 'Duan Yinghuo', '百炼山女铸器师': 'Forge Mistress',
    '屠百蛊': 'Tu Baigu', '肥硕养蛊师': 'Gu Breeder', '万锦罗': 'Wan Jinluo', '成年鬼市舞伶': 'Ghost Market Dancer',
    '鬼灯婆': 'Granny Ghostlamp', '老妪魂灯守': 'Soul-Lamp Keeper', '阎缝九': 'Yan Fengjiu', '粗粝女炼尸匠': 'Corpse Refiner',
    '敖巡澜': 'Ao Xunlan', '河龙巡水使': 'River Dragon Patrol', '兔采薇': 'Tu Caiwei', '兔妖采药少女': 'Rabbit Herb Girl',
    '丹翎羽': 'Dan Lingyu', '丹凤司羽使': 'Phoenix Envoy', '鸮更夜': 'Xiao Gengye', '鸮妖夜更': 'Owl Night Watch',
    # 品阶与货
    '下品': 'Low', '中品': 'Mid', '上品': 'High', '极品': 'Supreme',
    '筑基丹': 'Foundation Pill', '青铜古镜': 'Bronze Mirror', '古玉佩': 'Jade Pendant', '血婴丹': 'Blood Infant Pill',
    '骨笛': 'Bone Flute', '炼魂珠': 'Soul Pearl', '灵酒': 'Spirit Wine', '灵兽饲料': 'Beast Feed',
    # 地点
    '炼器坊废料场': 'Forge Scrapyard', '乱葬岗': 'Mass Graves', '万魔窟外围': 'Demon Caves', '古战场': 'Ancient Battlefield',
    '宗门废墟': 'Sect Ruins', '鬼市': 'Ghost Market',
}
LANGS = ('zh', 'en')


def tr(s, lang):
    if lang == 'zh': return s
    if s not in EN: sys.exit(f'collage.py：“{s}”没有英文，补进 EN')
    return EN[s]


def save(img, base, lang, quality):
    img.save(os.path.join(OUT, f'{base}{".en" if lang == "en" else ""}.webp'), quality=quality)


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

def grid_cast(lang):
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
        d.text((x + cw // 2, y + ch + 16), tr(n, lang), font=f(26 if lang == 'zh' else 22), fill=GOLD, anchor='mm')
        # 英文身份长，只写身份，势力看卡片的底色
        d.text((x + cw // 2, y + ch + 46), f'{FNAME[fa]} · {t}' if lang == 'zh' else tr(t, lang), font=f(16 if lang == 'zh' else 15), fill=DIM, anchor='mm')
        d.rectangle([x + 3, y + 3, x + cw - 4, y + ch + lab - 4], outline=TINT[fa] + (0,), width=1)
    save(img, 'cast', lang, 86)

def moods(lang):
    """两行四列的大卡片：高清特写放得下一张清楚的脸"""
    close = os.path.join(OUT, 'moods')
    cols, cw, ch, lab = 4, 460, 500, 64
    rows = (len(MOODS) + cols - 1) // cols
    img = Image.new('RGB', (cw * cols, (ch + lab) * rows), BG)
    d = ImageDraw.Draw(img)
    for k, (m, name) in enumerate(MOODS):
        x, y = (k % cols) * cw, (k // cols) * (ch + lab)
        img.paste(card_bg(cw - 8, ch + lab - 8, (150, 60, 90)), (x + 4, y + 4))
        hi = os.path.join(close, f'{m or "calm"}.webp')
        p = portrait(hi, cw - 8, ch - 4, frac=1.0) if os.path.exists(hi) \
            else portrait(A('chars', f'{MOODS_CID}{"_" + m if m else ""}.webp'), cw - 8, ch - 4, frac=0.45)
        # 特写顶到卡片外的部分（受控那张头后的雾）裁掉，卡片四边淡出，免得雾在卡片边上切成一道直线
        card = Image.new('RGBA', (cw - 8, ch + lab - 8), (0, 0, 0, 0))
        card.alpha_composite(p, ((cw - 8 - p.width) // 2, ch - 4 - p.height))
        fade = Image.new('L', card.size, 255)
        fd = ImageDraw.Draw(fade)
        for i in range(24): fd.rectangle([i, i, card.width - 1 - i, card.height - 1 - i], outline=int(255 * i / 24))
        card.putalpha(Image.composite(card.getchannel('A'), Image.new('L', card.size, 0), fade))
        img.paste(card, (x + 4, y + 4), card)
        d.text((x + cw // 2, y + ch + lab // 2), tr(name, lang), font=f(34 if lang == 'zh' else 30), fill=GOLD, anchor='mm')
    save(img, 'moods', lang, 90)

def items(lang):
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
        d.text((lab_w + c * cs + cs // 2, head // 2), tr(m.group(1), lang) if m else i, font=f(22 if lang == 'zh' else 17), fill=GOLD, anchor='mm')
    for r, (suf, tn) in enumerate(tiers):
        y = head + r * cs
        d.text((lab_w // 2, y + cs // 2), tr(tn, lang), font=f(26 if lang == 'zh' else 22), fill=[(150, 140, 140), (200, 200, 200), (120, 190, 255), (255, 200, 90)][r], anchor='mm')
        for c, i in enumerate(ids):
            x = lab_w + c * cs
            d.rounded_rectangle([x + 6, y + 6, x + cs - 6, y + cs - 6], 10, fill=(40, 26, 36), outline=(80, 56, 70))
            p = Image.open(A('items', f'{i}{suf}.webp')).convert('RGBA')
            p.thumbnail((cs - 20, cs - 20), Image.LANCZOS)
            img.paste(p, (x + (cs - p.width) // 2, y + (cs - p.height) // 2), p)
    save(img, 'items', lang, 88)
    return ids

def places(lang):
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
        d.text((x + tw // 2, y + th - 25), tr(name, lang), font=f(24), fill=GOLD, anchor='mm')
        d.rectangle([x, y, x + tw - 1, y + th - 1], outline=BG, width=3)
    save(img, 'places', lang, 84)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    JOBS = {'cast': grid_cast, 'moods': moods, 'items': items, 'places': places}
    for k in sys.argv[1:] or JOBS:
        r = [JOBS[k](lang) for lang in LANGS][0]
        print(k, r if r else 'ok')
