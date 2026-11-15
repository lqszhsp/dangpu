#!/usr/bin/env python3
"""Regenerate and stage only xian_spy_f1; install after inspecting both sheets."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont
from qwen_batch import GAME, MODEL, STYLE, NEGATIVE, key_green, request_slot, save_json, sha
from repair_spy_snake_gpt import EXPRESSIONS

ROOT = GAME / 'art/repairs/xian_spy_f1_qwen_20261115'
FACE = 'xian_spy_f1'
STATES = ['neutral', *EXPRESSIONS]
VEIL = ('Rebuild the ivory white face veil and its entire perimeter as clean continuous opaque '
        'woven silk, from just below the eyes down to the upper chest. The white cloth completely '
        'covers nose, mouth and chin. Natural soft cloth folds and subtle grey fabric shadows, '
        'clean smooth silhouette and clean joins to the cheeks and hair. Remove all black '
        'pixel blocks, dark smudges, smeared black outlines, jagged rectangular cutout artifacts '
        'and missing cloth near the sides of the scarf. No visible lips, nostrils, mouth outline '
        'or face printed on the scarf. No translucency, holes or painted black patches on the '
        'scarf. Keep natural dark hair behind the white veil; do not erase hair or dark robes. ')


def key(state):
    return FACE if state == 'neutral' else FACE + '_' + state


def green_reference(source, target):
    with Image.open(source) as original:
        image = original.convert('RGBA')
        image.thumbnail((950, 1400), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (1024, 1536), (0, 255, 0))
    canvas.paste(image, ((1024 - image.width) // 2, 1536 - image.height - 50), image)
    canvas.save(target, 'PNG')


def prepare():
    ROOT.mkdir(parents=True, exist_ok=True)
    snapshot = ROOT / 'before.json'
    if snapshot.exists():
        return
    records = {}
    for directory, suffix in [('art/raw/chars', '.png'), ('assets/chars', '.webp')]:
        for source in sorted((GAME / directory).glob('*' + suffix)):
            relative = str(source.relative_to(GAME))
            records[relative] = sha(source)
            if source.stem in {key(s) for s in STATES}:
                backup = ROOT / 'before' / relative
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, backup)
    save_json(snapshot, records)
    green_reference(ROOT / 'before/assets/chars/xian_spy_f1.webp', ROOT / 'original-reference.png')
    print('Backed up the seven existing states and recorded all character asset hashes.', flush=True)


def generate(state):
    folder = ROOT / 'provider' / key(state)
    marker = folder / 'complete.json'
    if marker.exists():
        record = json.loads(marker.read_text())
        assert sha(ROOT / record['image_file']) == record['sha256']
        return
    folder.mkdir(parents=True, exist_ok=True)
    lock = folder / 'in-flight.json'
    if lock.exists():
        raise RuntimeError('Unresolved request; inspect before retrying: ' + key(state))
    reference = ROOT / ('original-reference.png' if state == 'neutral' else 'neutral-reference.png')
    assert reference.exists(), reference
    prompt = ('Edit and regenerate this exact mature Chinese female spy, approximately 35 years old. '
              'Keep her recognizable eyes, face proportions, silver hair ornaments, updo, dark '
              'navy patterned long cloak, pale blue layered robes, embroidered dark belt, '
              'two arms lowered naturally at her sides, body proportions and full-body framing. '
              + VEIL + STYLE)
    prompt += ('Calm neutral eyes.' if state == 'neutral' else
               'Use the same newly repaired scarf and identity. Change only her exposed eyes, '
               'brows and forehead to express: ' + EXPRESSIONS[state] +
               ' The lower face remains completely hidden by the same opaque white cloth.')
    negative = NEGATIVE + ', black paint on white scarf, smeared black pixels, blocky scarf edges, visible mouth through veil, transparent veil'
    seed = 161150 + STATES.index(state)
    cmd = ['bl', 'image', 'edit', '--model', MODEL, '--image', str(reference), '--prompt', prompt,
           '--negative-prompt', negative, '--size', '1024*1536', '--seed', str(seed), '--n', '1',
           '--prompt-extend', 'false', '--watermark', 'false', '--out-dir', str(folder),
           '--out-prefix', key(state), '--output', 'json', '--timeout', '240']
    env = os.environ.copy()
    for name in ('HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY', 'all_proxy',
                 'BAILIAN_SKILL_NAME', 'BAILIAN_SKILL_VERSION'):
        env.pop(name, None)
    env.update(BAILIAN_CALLER_TYPE='script', BAILIAN_CALLER_NAME='codex', NO_COLOR='1')
    if env.get('DASHSCOPE_API_KEY', '').startswith('sk-sp-'):
        cmd += ['--base-url', 'https://token-plan.cn-beijing.maas.aliyuncs.com']
    save_json(folder / 'request.json', dict(model=MODEL, prompt=prompt, negative_prompt=negative,
              reference=str(reference.relative_to(ROOT)), reference_sha256=sha(reference),
              size='1024*1536', seed=seed, state=state))
    request_slot()
    with lock.open('x') as handle:
        json.dump({'started_at': datetime.now(timezone.utc).isoformat()}, handle)
    print('START ' + key(state), flush=True)
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
    (folder / 'response.json').write_text(result.stdout)
    (folder / 'cli.stderr.log').write_text(result.stderr)
    if result.returncode:
        save_json(folder / 'failure.json', {'exit_code': result.returncode})
        raise RuntimeError('Generation failed; inspect logs without blind retry: ' + key(state))
    candidates = [p for p in folder.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')]
    assert len(candidates) == 1, candidates
    source = candidates[0]
    with Image.open(source) as image:
        image.verify()
    save_json(marker, dict(asset_id=key(state), state=state, model=MODEL,
              image_file=str(source.relative_to(ROOT)), sha256=sha(source)))
    lock.unlink()
    print('DONE ' + key(state), flush=True)


def preview():
    cleaned = ROOT / 'cleaned'
    cleaned.mkdir(exist_ok=True)
    records = []
    for state in STATES:
        marker = ROOT / 'provider' / key(state) / 'complete.json'
        if not marker.exists():
            continue
        record = json.loads(marker.read_text())
        source = ROOT / record['image_file']
        assert sha(source) == record['sha256']
        with Image.open(source) as raw:
            image = key_green(raw)
        image.save(cleaned / (key(state) + '.png'), 'PNG')
        image.save(cleaned / (key(state) + '.webp'), 'WEBP', quality=90, method=6)
        for suffix in ('.png', '.webp'):
            p = cleaned / (key(state) + suffix)
            records.append(dict(path=str(p.relative_to(ROOT)), sha256=sha(p)))
    save_json(ROOT / 'manifest.json', records)
    if (cleaned / (FACE + '.png')).exists():
        green_reference(cleaned / (FACE + '.png'), ROOT / 'neutral-reference.png')
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
    for detail in (False, True):
        cw, ch = (270, 390) if detail else (220, 460)
        sheet = Image.new('RGB', (cw * 7, ch * 2), (48, 38, 53))
        draw = ImageDraw.Draw(sheet)
        for row in range(2):
            for column, state in enumerate(STATES):
                source = (ROOT / 'before/assets/chars' / (key(state) + '.webp') if row == 0
                          else cleaned / (key(state) + '.png'))
                if not source.exists():
                    continue
                with Image.open(source) as raw:
                    image = raw.convert('RGBA')
                if detail:
                    image = image.crop((int(image.width * .21), 0, int(image.width * .79), int(image.height * .30)))
                image.thumbnail((cw - 12, ch - 35), Image.Resampling.LANCZOS)
                sheet.paste(image, (column * cw + (cw - image.width) // 2, row * ch + 5), image)
                draw.text((column * cw + 7, (row + 1) * ch - 28),
                          ('BEFORE ' if row == 0 else 'AFTER ') + state, font=font, fill='white')
        sheet.save(ROOT / ('comparison-faces.jpg' if detail else 'comparison-full.jpg'), quality=95)
    edge_sheet = Image.new('RGB', (270 * 7, 390 * 2))
    draw = ImageDraw.Draw(edge_sheet)
    for row, background in enumerate(((28, 28, 32), (240, 240, 240))):
        draw.rectangle((0, row * 390, edge_sheet.width, (row + 1) * 390), fill=background)
        for column, state in enumerate(STATES):
            path = cleaned / (key(state) + '.png')
            if not path.exists():
                continue
            with Image.open(path) as source:
                image = source.convert('RGBA')
            image = image.crop((int(image.width * .21), 0, int(image.width * .79), int(image.height * .30)))
            image.thumbnail((258, 355), Image.Resampling.LANCZOS)
            edge_sheet.paste(image, (column * 270 + (270 - image.width) // 2, row * 390 + 5), image)
            draw.text((column * 270 + 7, (row + 1) * 390 - 28), state, font=font,
                      fill='white' if row == 0 else 'black')
    edge_sheet.save(ROOT / 'veil-edges-dark-light.jpg', quality=97)
    print('Preview ready: ' + str(ROOT), flush=True)


def install():
    before = json.loads((ROOT / 'before.json').read_text())
    records = json.loads((ROOT / 'manifest.json').read_text())
    assert len(records) == 14, 'Need all seven reviewed states'
    existing = ROOT / 'installed.json'
    if existing.exists():
        return verify()
    for record in records:
        source = ROOT / record['path']
        target = GAME / ('art/raw/chars' if source.suffix == '.png' else 'assets/chars') / source.name
        assert sha(source) == record['sha256']
        assert sha(target) == before[str(target.relative_to(GAME))], target
    installed = []
    for record in records:
        source = ROOT / record['path']
        target = GAME / ('art/raw/chars' if source.suffix == '.png' else 'assets/chars') / source.name
        shutil.copy2(source, target)
        installed.append(dict(path=str(target.relative_to(GAME)), sha256=sha(target)))
    save_json(existing, dict(face=FACE, model=MODEL, states=STATES, assets=installed,
              installed_at=datetime.now(timezone.utc).isoformat()))
    verify()


def verify():
    installed = json.loads((ROOT / 'installed.json').read_text())
    targets = {record['path'] for record in installed['assets']}
    assert len(targets) == 14
    art_source = (GAME / 'assets/art.js').read_text()
    for state in STATES:
        assert 'chars/' + key(state) + '"' in art_source
    for record in installed['assets']:
        source = GAME / record['path']
        assert sha(source) == record['sha256']
        with Image.open(source) as image:
            image.load()
            assert image.format == ('PNG' if source.suffix == '.png' else 'WEBP')
            assert image.mode == 'RGBA' and image.height == 1300
            assert image.getchannel('A').getextrema() == (0, 255)
            # Central scarf is solid foreground, never a transparent hole.
            alpha = image.getchannel('A')
            assert alpha.crop((int(image.width * .46), int(image.height * .13),
                               int(image.width * .54), int(image.height * .20))).getextrema()[0] == 255
    before = json.loads((ROOT / 'before.json').read_text())
    for relative, digest in before.items():
        source = ROOT / 'before' / relative if relative in targets else GAME / relative
        assert sha(source) == digest, relative
    report = dict(face=FACE, model=MODEL, states=7, png=7, webp=7,
                  height=1300, transparent_backgrounds=True, opaque_white_veil=True,
                  preserved_other_character_files=len(before) - 14,
                  archived_original_files=14, registration_valid=True)
    save_json(ROOT / 'verification.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['base', 'variants', 'preview', 'install', 'verify'])
    phase = parser.parse_args().phase
    if phase == 'base':
        prepare()
        generate('neutral')
        preview()
    elif phase == 'variants':
        with ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(generate, STATES[1:]))
        preview()
    else:
        {'preview': preview, 'install': install, 'verify': verify}[phase]()
