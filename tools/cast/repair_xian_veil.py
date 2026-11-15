#!/usr/bin/env python3
"""Generate unveiled xian_spy expressions, then composite a 70%-opaque veil last.
No mutation of f1/f2 or installation before visual review.
"""
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from qwen_batch import GAME, ROOT as BATCH, MODEL, MOODS, NEGATIVE, STYLE, key_green, request_slot, save_json, sha

ROOT = GAME/'art/repairs/xian_spy_veil'
STATES = ['neutral', *MOODS]
OPACITY = 0.70
BASE = GAME/'art/raw/chars/xian_spy.png'


def asset(state):
    return 'xian_spy' if state == 'neutral' else 'xian_spy_'+state


def call_edit(state, reference, prompt):
    folder = ROOT/'unveiled'/state
    complete = folder/'complete.json'
    if complete.exists():
        return ROOT/json.loads(complete.read_text())['image_file']
    folder.mkdir(parents=True, exist_ok=True)
    lock = folder/'in-flight.json'
    if lock.exists():
        raise RuntimeError('Unresolved veil-repair call: '+state)
    request_slot()
    save_json(folder/'request.json', {'model': MODEL, 'state': state, 'prompt': prompt,
              'reference': str(reference.relative_to(ROOT)), 'reference_sha256': sha(reference),
              'seed': 154000+STATES.index(state), 'n': 1, 'size': '1024*1536'})
    env = os.environ.copy()
    for key in ('HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY', 'all_proxy',
                'BAILIAN_SKILL_NAME', 'BAILIAN_SKILL_VERSION'):
        env.pop(key, None)
    env.update(BAILIAN_CALLER_TYPE='script', BAILIAN_CALLER_NAME='codex', NO_COLOR='1')
    cmd = ['bl', 'image', 'edit', '--model', MODEL, '--image', str(reference), '--prompt', prompt,
           '--negative-prompt', NEGATIVE+', face veil, mask over nose, cloth over mouth',
           '--size', '1024*1536', '--seed', str(154000+STATES.index(state)), '--n', '1',
           '--prompt-extend', 'false', '--watermark', 'false', '--out-dir', str(folder),
           '--out-prefix', asset(state)+'_unveiled', '--output', 'json', '--timeout', '240']
    if env.get('DASHSCOPE_API_KEY', '').startswith('sk-sp-'):
        cmd += ['--base-url', 'https://token-plan.cn-beijing.maas.aliyuncs.com']
    with lock.open('x') as fp:
        json.dump({'started_at': datetime.now(timezone.utc).isoformat()}, fp)
    print('START UNVEILED '+state, flush=True)
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
    (folder/'response.json').write_text(result.stdout); (folder/'cli.stderr.log').write_text(result.stderr)
    if result.returncode:
        save_json(folder/'failure.json', {'exit_code': result.returncode, 'review_required': True})
        raise RuntimeError('Unveiled generation failed; inspect '+state+' log, no automatic retry')
    candidates = [p for p in folder.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')]
    if len(candidates) != 1:
        raise RuntimeError('Expected one unveiled output: '+state)
    with Image.open(candidates[0]) as image:
        image.verify()
    save_json(complete, {'state': state, 'model': MODEL,
              'image_file': str(candidates[0].relative_to(ROOT)), 'sha256': sha(candidates[0])})
    lock.unlink()
    print('DONE UNVEILED '+state, flush=True)
    return candidates[0]


def generate():
    if len(list((BATCH/'provider').glob('*/complete.json'))) != 385:
        raise RuntimeError('Wait for current 55-character batch to reach 385/385')
    ROOT.mkdir(parents=True, exist_ok=True)
    before = ROOT/'before.json'
    if not before.exists():
        records = {}
        for state in STATES:
            for directory, suffix in [('art/raw/chars', '.png'), ('assets/chars', '.webp')]:
                p = GAME/directory/(asset(state)+suffix)
                records[str(p.relative_to(GAME))] = sha(p)
        save_json(before, records)
    reference = ROOT/'old-neutral-reference.png'
    if not reference.exists():
        with Image.open(BASE) as raw:
            image = raw.convert('RGBA')
            image.putalpha(image.getchannel('A').point(lambda v: round(max(0, min(1, (v-80)/175))*255)))
            image = image.crop(image.getchannel('A').getbbox())
            image.thumbnail((950, 1400), Image.Resampling.LANCZOS)
            canvas = Image.new('RGB', (1024, 1536), (0, 255, 0))
            canvas.paste(image, ((1024-image.width)//2, 1536-image.height-50), image)
            canvas.save(reference)
    base_prompt = ('Edit the reference: the same clearly adult Chinese female immortal sect agent, same eyes, '
                   'face shape, dark updo and silver hair crown, dark embroidered travelling cape over pale blue '
                   'and ivory robes, same full-body standing pose, hands and camera. REMOVE THE FACE VEIL '
                   'COMPLETELY, from below the eyes down to the chest. Show a naturally proportioned bare human '
                   'face with visible nose, mouth, cheeks and chin. Restore only the normal robe collar below '
                   'her chin. No face cloth, no scarf, no mask and no facial jewelry. Neutral calm expression. '+STYLE)
    base = call_edit('neutral', reference, base_prompt)
    clean_reference = ROOT/'unveiled-neutral-reference.png'
    if not clean_reference.exists():
        with Image.open(base) as image:
            subject = key_green(image)
        subject.thumbnail((950, 1400), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (1024, 1536), (0, 255, 0))
        canvas.paste(subject, ((1024-subject.width)//2, 1536-subject.height-50), subject)
        canvas.save(clean_reference)
    for state in STATES[1:]:
        prompt = ('Same specific adult Chinese actress, same recognizable eyes, nose, mouth, face shape, '
                  'hair, crown, cape, costume, pose, props, framing and lighting. Her face remains COMPLETELY '
                  'UNVEILED with nose, lips and chin visible. Edit only facial expression and visible state: '+MOODS[state]+'. '
                  'Do not add any mask, face cloth or scarf; the veil will be composited separately later. '+STYLE)
        call_edit(state, clean_reference, prompt)
    print('Seven unveiled faces ready; inspect and define anchors.json before composite', flush=True)


def draw_veil(size, anchors):
    # High-resolution smooth cloth silhouette; alpha is exactly round(.70*255) inside.
    w, h = size
    points = anchors['polygon']
    scale = 3
    coverage = Image.new('L', (w*scale, h*scale), 0)
    ImageDraw.Draw(coverage).polygon([(round(x*scale), round(y*scale)) for x, y in points], fill=255)
    coverage = coverage.resize(size, Image.Resampling.LANCZOS)
    alpha = coverage.point(lambda value: round(value*OPACITY))
    bbox = coverage.getbbox()
    cloth = Image.new('RGBA', size, (0, 0, 0, 0))
    # Fabric folds and subtle weave are independent of the facial features beneath the layer.
    patch = Image.new('RGBA', (bbox[2]-bbox[0], bbox[3]-bbox[1]))
    colors = []
    for y in range(patch.height):
        for x in range(patch.width):
            horizontal = x/max(1, patch.width-1)
            fold = 7*math.sin(x/14+y/160)+3*math.sin(x/5+y/90)
            weave = (x+y)%3-1
            colors.append((round(202+8*(1-horizontal)+fold+weave),
                           round(201-4*(1-horizontal)+fold+weave),
                           round(210+7*horizontal+fold+weave), 255))
    patch.putdata(colors); cloth.paste(patch, (bbox[0], bbox[1])); cloth.putalpha(alpha)
    return cloth


def composite():
    config = json.loads((ROOT/'anchors.json').read_text())
    if config.get('opacity') != OPACITY:
        raise RuntimeError('User specified veil opacity 0.70')
    (ROOT/'final').mkdir(exist_ok=True); (ROOT/'veil-layers').mkdir(exist_ok=True)
    records = []
    # Full-body and face comparisons: unveiled -> final; old faces in separate sheet.
    face_sheet = Image.new('RGB', (7*220, 2*300), (39, 29, 44))
    old_sheet = Image.new('RGB', (7*220, 2*300), (39, 29, 44))
    draw = ImageDraw.Draw(face_sheet); old_draw = ImageDraw.Draw(old_sheet)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    for index, state in enumerate(STATES):
        record = json.loads((ROOT/'unveiled'/state/'complete.json').read_text())
        with Image.open(ROOT/record['image_file']) as source:
            source = source.convert('RGBA')
        anchor = config['states'][state]
        layer = draw_veil(source.size, anchor)
        layer.save(ROOT/'veil-layers'/(state+'.png'))
        final = Image.alpha_composite(source, layer)  # veil is always the final/topmost image layer
        subject = key_green(final)
        png = ROOT/'final'/(asset(state)+'.png'); webp = png.with_suffix('.webp')
        subject.save(png, 'PNG'); subject.save(webp, 'WEBP', quality=90, method=6)
        for row, pic in enumerate((source, final)):
            face = pic.crop(tuple(anchor['face_crop'])); face.thumbnail((210, 270))
            face_sheet.paste(face, (index*220+(220-face.width)//2, row*300), face if face.mode=='RGBA' else None)
            draw.text((index*220+5, row*300+278), state+(' bare' if row==0 else ' veil70'), font=font, fill='white')
        for row, pic in enumerate((Image.open(GAME/'art/raw/chars'/(asset(state)+'.png')).convert('RGBA'), subject)):
            box = pic.getchannel('A').getbbox() or (0, 0, *pic.size)
            pic = pic.crop(box); pic = pic.crop((0, 0, pic.width, round(pic.height*.29)))
            pic.thumbnail((210, 270))
            old_sheet.paste(pic, (index*220+(220-pic.width)//2, row*300), pic)
            old_draw.text((index*220+5, row*300+278), state+(' old' if row==0 else ' veil70'), font=font, fill='white')
        records.append({'asset_id': asset(state), 'state': state, 'png': str(png.relative_to(ROOT)),
                        'webp': str(webp.relative_to(ROOT)), 'png_sha256': sha(png), 'webp_sha256': sha(webp),
                        'veil_layer': f'veil-layers/{state}.png', 'veil_opacity': OPACITY})
    face_sheet.save(ROOT/'unveiled-vs-veiled.jpg', quality=94)
    old_sheet.save(ROOT/'before-after.jpg', quality=94)
    save_json(ROOT/'manifest.json', {'model': MODEL, 'workflow': 'unveiled expressions then final top-layer veil',
              'veil_opacity': OPACITY, 'generated_images': 7, 'images': records})
    print('COMPOSITED 7 faces with a 70%-opaque final veil layer; inspect comparison before install')


def install():
    if (ROOT/'installed.json').exists():
        print('SKIP veil repair already installed'); return
    before = json.loads((ROOT/'before.json').read_text())
    manifest = json.loads((ROOT/'manifest.json').read_text())
    if len(manifest['images']) != 7:
        raise RuntimeError('All seven states required')
    for file, digest in before.items():
        if sha(GAME/file) != digest:
            raise RuntimeError('Old masked identity changed during repair; refusing overwrite: '+file)
    for e in manifest['images']:
        assert sha(ROOT/e['png']) == e['png_sha256'] and sha(ROOT/e['webp']) == e['webp_sha256']
    for file in before:
        archived = ROOT/'archive'/file
        archived.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(GAME/file, archived)
    for e in manifest['images']:
        shutil.copy2(ROOT/e['png'], GAME/'art/raw/chars'/(e['asset_id']+'.png'))
        shutil.copy2(ROOT/e['webp'], GAME/'assets/chars'/(e['asset_id']+'.webp'))
    save_json(ROOT/'installed.json', {'images': 7, 'model': MODEL, 'veil_opacity': OPACITY,
              'replaced_existing_only': True, 'before_sha256': before,
              'installed_at': datetime.now(timezone.utc).isoformat()})
    print('INSTALLED xian_spy neutral + six states; f1/f2 untouched; old files archived')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['generate', 'composite', 'install'], required=True)
    phase = parser.parse_args().phase
    {'generate': generate, 'composite': composite, 'install': install}[phase]()
