#!/usr/bin/env python3
"""Stage, review, and install GPT-image repairs for the six spy/snake faces."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

GAME = Path(__file__).resolve().parents[2]
ROOT = GAME / 'art/repairs/spy_snake_gpt_image_20261115'
sys.path.insert(0, str(GAME / 'tools/art'))
from postprocess import ensure_alpha, trim

FACES = ['xian_spy', 'xian_spy_f1', 'xian_spy_f2',
         'yao_snake', 'yao_snake_f1', 'yao_snake_f2']
MOODS = ['neutral', 'pleased', 'angry', 'afraid', 'sly', 'wasted', 'thrall']
STYLE = ('Cinematic photorealistic Chinese xianxia costume-drama film still, real human actor '
         'and practical costume/prosthetic effects, detailed fabric and skin. Exactly one person, '
         'full body from hair ornament to both feet, same standing pose, same hand positions, '
         'same props, hairstyle, costume, camera distance and proportions as the reference. '
         'Looking at the viewer. Warm red light from the left and cool purple rim light. '
         'Isolated on a genuinely transparent alpha background, no scenery, floor, shadow, '
         'checkerboard, text, watermark or extra people. Leave clear margins around the whole body. ')
CAST = {
    'xian_spy': 'The same young adult Chinese woman, silver hair crown, embroidered dark cloak and pale blue/ivory layered robes. ',
    'xian_spy_f1': 'The same mature Chinese woman around 35, stern eyes, silver hair ornaments, long dark cloak and simple pale blue robes. ',
    'xian_spy_f2': 'The same young adult Chinese woman, slender build, dark hair crown, dark cloak over layered pale blue robes. ',
    'yao_snake': 'The same adult Chinese woman, recognizable face and elegant updo, snake hair ornament, jade earrings, green embroidered robes, hands clasped at her waist. ',
    'yao_snake_f1': 'The same rugged middle-aged Chinese MAN, masculine facial structure, black mustache and short goatee, weathered face, topknot, dark green robes, holding the original scroll. ',
    'yao_snake_f2': 'The same young adult Chinese MAN, masculine face and broad shoulders, long dark hair, snake crown, dark green scale-pattern robes, jade belt and the original hand pose. ',
}


def feature(face):
    if face.startswith('xian_spy'):
        color = 'charcoal-black' if face.endswith('f2') else 'pale ivory-white'
        return (f'Rebuild the lower-face veil as real OPAQUE {color} woven silk cloth, '
                'suspended from both sides below the eyes, covering the entire nose, mouth, '
                'cheeks and chin, hanging naturally onto the upper chest. The upper edge rests '
                'high on the nose bridge directly under the eyes. Cloth is the foremost surface '
                'over the lower face: continuous visible silk weave, believable hanging folds '
                'and embroidered fabric, not facial skin. Absolutely NO visible lips, teeth, '
                'nostrils, mouth outline, face print, embossed face, or second face on the cloth. '
                'The veil itself is NOT transparent or translucent; only the image background '
                'is transparent. Brow, eyes and forehead remain fully exposed and expressive. ')
    return ('Make this unmistakably a snake demon in human form: prominent contiguous patches '
            'of raised overlapping emerald-green snake scales across BOTH temples and lateral '
            'cheekbones, continuing down the sides and front of the neck to the collar. Scales '
            'are physical three-dimensional prosthetic skin with highlights and shadows, '
            'individual scales clearly visible, not faint freckles, lace, tattoos or face paint. '
            'Golden yellow-green irises with clearly defined razor-thin vertical black snake '
            'pupils, alert serpentine gaze. Both exposed hands and fingers also have visible '
            'fine green scales. Preserve a recognizable attractive HUMAN face, human head and '
            'two human legs under the original green robes; preserve the original sex and age. '
            'Keep the scale pattern strong enough to read at game portrait size. ')


EXPRESSIONS = {
    'pleased': 'Pleased and relieved, gently raised cheeks and warm relaxed smiling eyes.',
    'angry': 'Furious, brows sharply knitted, fierce focused glare, tense brow and forehead.',
    'afraid': 'Frightened, wide alarmed eyes, brows raised and drawn together, pale forehead.',
    'sly': 'Sly and calculating, one eyebrow slightly raised, knowingly narrowed mischievous eyes.',
    'wasted': 'Exhausted and ill, pronounced dark under-eye circles, heavy tired eyelids, pale exposed skin and beads of sweat on the forehead. Remains standing.',
    'thrall': 'Magically mind-controlled: both eyes are completely milky white without pupils or visible irises, blank vacant gaze, delicate dark veins at the exposed temples and neck. Remains standing.',
}


def name(face, mood):
    return face if mood == 'neutral' else f'{face}_{mood}'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cutout(source, protect=None):
    im = source.convert('RGBA')
    if im.getchannel('A').getextrema()[0] < 250:
        return im
    # Some provider outputs contain a baked, finely antialiased grey checkerboard.
    # Remove only neutral background pixels connected to the image border.
    r, g, b = im.convert('RGB').split()
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    neutral = ImageChops.subtract(hi, lo).point(lambda v: 255 if v <= 18 else 0)
    bright = lo.point(lambda v: 255 if v >= 140 else 0)
    mask = ImageChops.multiply(neutral, bright)
    w, h = im.size
    border = ([(x, y) for x in range(0, w, 8) for y in (0, h - 1)]
              + [(x, y) for y in range(0, h, 8) for x in (0, w - 1)])
    if sum(mask.getpixel(p) == 255 for p in border) / len(border) < .9:
        return ensure_alpha(im)
    if protect is not None:
        assert protect.size == im.size
        mask = ImageChops.multiply(mask, ImageChops.invert(protect))
    for p in border:
        if mask.getpixel(p) == 255:
            ImageDraw.floodfill(mask, p, 128, thresh=0)
    background = mask.point(lambda v: 255 if v == 128 else 0)
    im.putalpha(ImageChops.invert(background).filter(ImageFilter.GaussianBlur(.4)))
    return im


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def prepare():
    ROOT.mkdir(parents=True, exist_ok=True)
    snapshot = ROOT / 'before.json'
    if not snapshot.exists():
        records = {}
        for folder, suffix in [('art/raw/chars', '.png'), ('assets/chars', '.webp')]:
            for path in sorted((GAME / folder).glob('*' + suffix)):
                relative = path.relative_to(GAME)
                records[str(relative)] = sha(path)
                if any(path.stem == name(f, m) for f in FACES for m in MOODS):
                    backup = ROOT / 'before' / relative
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, backup)
        write_json(snapshot, records)
    (ROOT / 'references').mkdir(exist_ok=True)
    (ROOT / 'generated').mkdir(exist_ok=True)
    bases, variants = [], []
    for face in FACES:
        ref = ROOT / 'references' / f'{face}.png'
        if not ref.exists():
            source = ROOT / 'before/assets/chars' / f'{face}.webp'
            with Image.open(source) as im:
                im.convert('RGBA').save(ref, 'PNG')
        common = dict(size='1024x1536', background='transparent', quality='high',
                      model='gpt-image-2.5-sunburst-adobe')
        bases.append(dict(id=face, out=f'generated/{face}.png',
                          refs=[f'references/{face}.png'], **common,
                          prompt='Edit and regenerate the reference character. ' + STYLE + CAST[face]
                          + feature(face) + 'Calm neutral expression.'))
        for mood in MOODS[1:]:
            rules = feature(face)
            if mood == 'thrall' and face.startswith('yao_snake'):
                rules = ('Keep the same prominent green scales on temples, cheeks, neck and hands, '
                         'same snake-demon anatomy. For this state ONLY, eyes are entirely milky '
                         'white without pupils; all other snake features remain unchanged. ')
            mask_note = ('Preserve the exact THICK, FOLDED, FULLY OPAQUE silk face scarf of the '
                         'reference. Never replace it with thin gauze. No lips, nose, mouth '
                         'or facial contours may appear on or through the solid fabric. '
                         'Express the emotion ONLY with exposed eyes, brows and forehead; '
                         'the lower face stays completely hidden behind the same opaque cloth. '
                         if face.startswith('xian_spy') else '')
            variants.append(dict(id=name(face, mood), out=f'generated/{name(face, mood)}.png',
                                 refs=[f'generated/{face}.png'], **common,
                                 prompt='Edit the reference: exactly the same person and identity. '
                                 + STYLE + CAST[face] + rules + 'Change only the expression/state: '
                                 + EXPRESSIONS[mood] + ' ' + mask_note))
    write_json(ROOT / 'bases.json', bases)
    write_json(ROOT / 'variants.json', variants)
    print(f'Prepared {len(bases)} bases and {len(variants)} variants; original assets backed up.')


def redo_veils():
    attempts = ROOT / 'attempts/first-pass-veils'
    attempts.mkdir(parents=True, exist_ok=True)
    jobs = []
    for face in FACES[:3]:
        old = ROOT / 'generated' / f'{face}.png'
        saved = attempts / old.name
        if not saved.exists():
            shutil.move(old, saved)
        color = 'charcoal black' if face.endswith('f2') else 'ivory white'
        jobs.append(dict(id=f'{face}:opaque-veil', refs=[str(saved.relative_to(ROOT))],
                         out=f'generated/{face}.png', size='1024x1536',
                         background='transparent', quality='high',
                         model='gpt-image-2.5-sunburst-adobe',
                         prompt=(f'Fix ONLY the face covering of this exact woman. Replace the '
                                 f'ENTIRE existing sheer veil with a THICK, TRIPLE-LAYER, FULLY '
                                 f'OPAQUE {color} SILK SCARF. Ancient Chinese folded silk face '
                                 'covering. The only visible facial features are her eyes, brows '
                                 'and forehead. Upper edge immediately below the eyes. Thick '
                                 'overlapping diagonal cloth folds cover ALL of the nose and '
                                 'mouth, then the scarf hangs down to the chest. Paint out EVERY '
                                 'trace of the previous nose, lips and mouth with solid fabric. '
                                 'There must be NO skin color, nose ridge, nostrils, lips, teeth '
                                 'or face-shaped shadows below the eyes. The entire lower face '
                                 'is obscured by visible opaque folded silk, like a thick folded '
                                 'bedsheet. No thin gauze, no translucency, no facial silhouette '
                                 'inside the fabric. Preserve her exact eyes, hair, crown, '
                                 'costume, body, hand pose, full-body composition and lighting. '
                                 'Transparent image background, opaque face scarf.')))
    write_json(ROOT / 'opaque-veils.json', jobs)
    print('Prepared three thicker silk face-covering edits.')


def picture(path, face_only=False):
    with Image.open(path) as source:
        im = trim(cutout(source))
    if face_only:
        w, h = im.size
        im = im.crop((int(w * .17), 0, int(w * .83), int(h * .29)))
    return im


def sheets():
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    for family in ['xian_spy', 'yao_snake']:
        faces = [f for f in FACES if f.startswith(family)]
        for detail in [False, True]:
            cw, ch = (230, 320) if detail else (210, 400)
            sheet = Image.new('RGB', (7 * cw, 3 * ch), (43, 34, 49))
            draw = ImageDraw.Draw(sheet)
            for row, face in enumerate(faces):
                for col, mood in enumerate(MOODS):
                    key = name(face, mood)
                    path = ROOT / 'generated' / f'{key}.png'
                    if not path.exists():
                        continue
                    im = picture(path, detail)
                    im.thumbnail((cw - 12, ch - 45), Image.Resampling.LANCZOS)
                    x, y = col * cw + (cw - im.width) // 2, row * ch
                    sheet.paste(im, (x, y), im)
                    draw.text((col * cw + 5, y + ch - 39), face, fill='white', font=font)
                    draw.text((col * cw + 5, y + ch - 20), mood, fill='#d5b8db', font=font)
            path = ROOT / f'{family}-{"faces" if detail else "full"}.jpg'
            sheet.save(path, quality=94)
            print(path)
    for detail in [False, True]:
        cw, ch = (240, 320) if detail else (240, 460)
        sheet = Image.new('RGB', (6 * cw, 2 * ch), (43, 34, 49))
        draw = ImageDraw.Draw(sheet)
        for col, face in enumerate(FACES):
            for row in range(2):
                path = (ROOT / 'before/assets/chars' / f'{face}.webp' if row == 0
                        else ROOT / 'generated' / f'{face}.png')
                if not path.exists():
                    continue
                im = picture(path, detail)
                im.thumbnail((cw - 12, ch - 42), Image.Resampling.LANCZOS)
                x, y = col * cw + (cw - im.width) // 2, row * ch
                sheet.paste(im, (x, y), im)
                draw.text((col * cw + 5, y + ch - 37), face, fill='white', font=font)
                draw.text((col * cw + 5, y + ch - 19), 'BEFORE' if row == 0 else 'GPT IMAGE', fill='#d5b8db', font=font)
        path = ROOT / f'base-comparison-{"faces" if detail else "full"}.jpg'
        sheet.save(path, quality=94)
        print(path)


def install():
    before = json.loads((ROOT / 'before.json').read_text())
    target_names = {name(f, m) for f in FACES for m in MOODS}
    prepared = []
    for key in sorted(target_names):
        generated = ROOT / 'generated' / f'{key}.png'
        with Image.open(generated) as source:
            source.load()
            im = cutout(source)
        alpha = im.getchannel('A')
        assert alpha.getextrema() == (0, 255), f'Invalid transparency: {key}'
        im = trim(im)
        assert .2 < im.width / im.height < 1.1, f'Unexpected framing: {key}'
        size = (round(im.width * 1300 / im.height), 1300)
        prepared.append((key, im, size))
    # Validate every target before replacing any original, and preserve concurrent edits.
    for key, _, _ in prepared:
        for folder, suffix in [('art/raw/chars', '.png'), ('assets/chars', '.webp')]:
            relative = f'{folder}/{key}{suffix}'
            if relative in before:
                assert sha(GAME / relative) == before[relative], f'Asset changed during generation: {relative}'
            else:
                assert not (GAME / relative).exists(), f'New concurrent asset: {relative}'
    installed = []
    for key, im, size in prepared:
        raw, runtime = GAME / 'art/raw/chars' / f'{key}.png', GAME / 'assets/chars' / f'{key}.webp'
        im.save(raw, 'PNG')
        im.resize(size, Image.Resampling.LANCZOS).save(runtime, 'WEBP', quality=90, method=6)
        for path in [raw, runtime]:
            installed.append(dict(path=str(path.relative_to(GAME)), sha256=sha(path)))
    for relative, digest in before.items():
        if Path(relative).stem not in target_names:
            assert sha(GAME / relative) == digest, f'Unrelated character changed: {relative}'
    filled = [record['path'] for record in installed if record['path'] not in before]
    write_json(ROOT / 'installed.json', dict(faces=FACES, states=MOODS, assets=installed,
                                            filled_missing_originals=filled,
                                            unrelated_character_assets_unchanged=True))
    print(f'Installed {len(prepared)} PNG originals and {len(prepared)} WebP runtime assets.')


def normalize():
    for path in sorted((ROOT / 'generated').glob('*.png')):
        with Image.open(path) as source:
            if source.convert('RGBA').getchannel('A').getextrema()[0] < 250:
                continue
            protect = None
            if path.stem.startswith('xian_spy'):
                face = next(f for f in reversed(FACES[:3])
                            if path.stem == f or path.stem.startswith(f + '_'))
                reference = ROOT / 'generated' / f'{face}.png'
                if reference != path:
                    with Image.open(reference) as base:
                        alpha = base.convert('RGBA').getchannel('A')
                    if alpha.size == source.size:
                        protect = alpha.point(lambda v: 255 if v > 250 else 0).filter(ImageFilter.MinFilter(11))
            im = cutout(source, protect)
        assert im.getchannel('A').getextrema() == (0, 255), str(path)
        saved = ROOT / 'attempts/opaque-background' / path.name
        saved.parent.mkdir(parents=True, exist_ok=True)
        if not saved.exists():
            shutil.copy2(path, saved)
        im.save(path, 'PNG')
        print('Normalized transparent background:', path.name)


def restore_white_veil():
    # Keep the known foreground interior from the registered first-pass cutout.
    # This prevents white cloth connected to the baked grid from being keyed out.
    raw = ROOT / 'attempts/opaque-background/xian_spy_f1.png'
    reference = ROOT / 'attempts/first-pass-veils/xian_spy_f1.png'
    with Image.open(raw) as source:
        im = cutout(source)
    with Image.open(reference) as source:
        alpha = source.convert('RGBA').getchannel('A')
    assert alpha.size == im.size
    interior = alpha.point(lambda v: 255 if v > 250 else 0).filter(ImageFilter.MinFilter(11))
    im.putalpha(ImageChops.lighter(im.getchannel('A'), interior))
    im.save(ROOT / 'generated/xian_spy_f1.png', 'PNG')
    print('Preserved the white silk foreground using the registered first-pass matte.')


def verify():
    before = json.loads((ROOT / 'before.json').read_text())
    installed = json.loads((ROOT / 'installed.json').read_text())
    target_names = {name(f, m) for f in FACES for m in MOODS}
    for record in installed['assets']:
        path = GAME / record['path']
        assert sha(path) == record['sha256'], record['path']
        with Image.open(path) as source:
            source.load()
            assert source.format == ('PNG' if path.suffix == '.png' else 'WEBP'), str(path)
            assert source.mode == 'RGBA', str(path)
            assert source.getchannel('A').getextrema() == (0, 255), str(path)
            if path.suffix == '.webp':
                assert source.height == 1300, str(path)
            if path.stem.startswith('xian_spy'):
                w, h = source.size
                cloth = source.getchannel('A').crop((int(w*.47), int(h*.14), int(w*.53), int(h*.19)))
                assert cloth.getextrema()[0] >= 250, f'White veil lost opacity: {path}'
    untouched = 0
    for relative, digest in before.items():
        if Path(relative).stem not in target_names:
            assert sha(GAME / relative) == digest, f'Unrelated character changed: {relative}'
            untouched += 1
    result = dict(faces=6, states_per_face=7, png=42, webp=42,
                  valid_formats=True, transparent_backgrounds=True, webp_height=1300,
                  opaque_spy_face_coverings=True, unchanged_other_character_files=untouched,
                  filled_missing_originals=installed['filled_missing_originals'])
    write_json(ROOT / 'verification.json', result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['prepare', 'redo-veils', 'normalize', 'restore-white-veil', 'sheets', 'install', 'verify'])
    stage = parser.parse_args().stage
    {'prepare': prepare, 'redo-veils': redo_veils, 'normalize': normalize,
     'restore-white-veil': restore_white_veil, 'sheets': sheets, 'install': install,
     'verify': verify}[stage]()
