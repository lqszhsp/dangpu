#!/usr/bin/env python3
"""GitHub 介绍页“神态”那张图的高清特写：拿游戏里同一张脸的八种神态立绘当参考，让 gpt-image 重画成胸像特写，
抠掉绿幕，受控的那张补上头后的暗雾（同 tools/art/thrall_mist.py），存成 docs/readme/moods/<神态>.webp，再由 collage.py 拼图。
  python3 tools/readme/moods_closeup.py            画缺的、抠图、导出（已画好的跳过；要重画哪张，删掉 art/readme/moods/ 里对应的图）
  python3 tools/readme/moods_closeup.py post       只抠图、导出，不调接口
人物与 collage.py 的 MOODS_CID 是同一个；模型锁定 gpt-image-2.5-sunburst-adobe（不换模型，画风才一致）。
原图、参考图在主目录的 art/readme/moods/（不进仓库），先 source ~/.profile 拿到 GPT_IMAGE_BASE_URL / GPT_IMAGE_API_KEY。"""
import os, subprocess, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/readme'))
sys.path.insert(0, os.path.join(ROOT, 'tools/art'))
from collage import MOODS_CID as CID, MOODS

# art/ 不进仓库，原图只在主目录（git 的公共目录旁边）；在别的工作区跑也读写主目录的 art/
ART = os.path.join(os.path.dirname(subprocess.run(['git', '-C', ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
                                                  capture_output=True, text=True, check=True).stdout.strip()), 'art')
STAGE = os.path.join(ART, 'readme/moods')
OUT = os.path.join(ROOT, 'docs/readme/moods')
RAW = os.path.join(ART, 'raw/chars')
MODEL = 'gpt-image-2.5-sunburst-adobe'
BG = (36, 22, 34)

LOOK = ('Use the reference image as the exact same character: a young fox-spirit woman who looks in her early twenties, '
        'white fluffy fox ears, long black hair with red flowers and gold hairpins with dangling tassels, '
        'a red-and-cream embroidered hanfu robe. Keep her face, hair, ornaments and clothing identical to the reference. '
        'Recompose as a high-resolution head-and-shoulders close-up portrait, from the tips of the fox ears down to mid-chest, '
        'face large and centered, sharp detailed eyes, hair and embroidery, same realistic painterly xianxia style and warm lighting as the reference. '
        'Expression: {mood}. '
        'Background: flat solid pure green #00FF00 chroma-key screen, evenly lit, no shadow, no gradient, no smoke, no text, no frame.')
MOOD_TEXT = {
    '': 'calm and composed, neutral face, lips gently closed, looking at the viewer',
    'pleased': 'happy and pleased, a warm genuine smile, eyes slightly crinkled with joy',
    'angry': 'angry, brows sharply furrowed, glaring at the viewer, lips pressed tight',
    'afraid': 'frightened, wide eyes, raised brows, mouth open in shock, one hand raised to her collar as in the reference',
    'sly': 'sly and cunning, a knowing sideways smirk, narrowed eyes, one brow slightly raised',
    'smitten': ('lovestruck by a love charm: dreamy half-lidded adoring eyes, a soft shy smile, rosy pink blush on both cheeks, '
                'her hand resting against her cheek and the robe slipped off one shoulder as in the reference, elegant and tasteful'),
    'thrall': ('mind-controlled thrall: blank pure white eyes with no pupils, an expressionless vacant face, lips slightly parted, '
               'hair and clothes exactly as the reference; do NOT draw any mist, smoke or fog'),
    'wasted': 'exhausted and haggard: dark circles under the eyes, pale dull skin, a weary sad expression, a few loose strands of hair',
}

name = lambda m: f'{CID}{"_" + m if m else ""}'


def reference(m):
    """参考图：透明的原图垫在深色底上；原图没抠干净（受控那张是白底带雾）的，用游戏里抠好的立绘"""
    path = os.path.join(STAGE, f'ref_{name(m)}.png')
    if os.path.exists(path): return path
    src = os.path.join(RAW, name(m) + '.png')
    im = Image.open(src).convert('RGBA') if os.path.exists(src) else None
    if im is None or im.getchannel('A').getextrema()[0] >= 250:
        im = Image.open(os.path.join(ROOT, 'assets/chars', name(m) + '.webp')).convert('RGBA')
        im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, BG + (255,))
    bg.alpha_composite(im)
    bg.convert('RGB').save(path)
    return path


def draw():
    import json
    os.environ['GPT_IMAGE_MODEL'] = os.environ['GPT_IMAGE_FALLBACK'] = MODEL
    jobs = [{'id': f'readme:{name(m)}', 'prompt': LOOK.format(mood=MOOD_TEXT[m]), 'out': f'{name(m)}.png',
             'refs': [os.path.basename(reference(m))], 'size': '1024x1024', 'quality': 'high'} for m, _ in MOODS]
    man = os.path.join(STAGE, 'manifest.json')
    json.dump(jobs, open(man, 'w'), ensure_ascii=False, indent=1)
    gpt = os.path.expanduser('~/.codex/skills/gpt-image/scripts/gpt_image.py')
    subprocess.run([sys.executable, gpt, 'batch', man, '--jobs', '4', '--model', MODEL], check=True)


def fade_edges(p, band=120):
    """特写裁得紧，头后的雾顶到了画边、被切成直线：离画边 band 像素内的半透明（雾）渐渐淡掉，人物（不透明处）不动"""
    from PIL import ImageChops, ImageDraw
    im = Image.open(p).convert('RGBA')
    a = im.getchannel('A')
    ramp = Image.new('L', im.size, 255)
    d = ImageDraw.Draw(ramp)
    for i in range(band): d.rectangle([i, i, im.width - 1 - i, im.height - 1 - i], outline=int(255 * (i / band) ** 1.5))
    solid = a.point(lambda v: 255 if v >= 250 else 0)
    im.putalpha(ImageChops.lighter(ImageChops.multiply(a, ramp), ImageChops.multiply(a, solid)))
    im.save(p)


def post():
    import thrall_mist
    os.makedirs(OUT, exist_ok=True)
    base = os.path.join(ROOT, 'assets/chars', CID + '.webp')
    for m, _ in MOODS:
        p = os.path.join(STAGE, name(m) + '.png')
        if not os.path.exists(p): print('缺', p); continue
        # chroma_key 原地抠图（已抠过的会跳过），未抠的原图留在 art/screen/
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools/art/chroma_key.py'), p, '--ref', base], check=True)
        if m == 'thrall':
            thrall_mist.RAW = STAGE
            done = os.path.join(STAGE, '.misted')
            if not os.path.exists(done): thrall_mist.add_mist(CID); open(done, 'w').close()
            fade_edges(p)
        Image.open(p).convert('RGBA').save(os.path.join(OUT, f'{m or "calm"}.webp'), quality=90, method=6)
    print('导出到', OUT)


if __name__ == '__main__':
    os.makedirs(STAGE, exist_ok=True)
    if sys.argv[1:] != ['post']: draw()
    post()
