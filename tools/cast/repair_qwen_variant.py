#!/usr/bin/env python3
"""Deferred single-variant repair explicitly requested by the user.
Generate only after the 55-character batch; inspect before --phase install.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess

from PIL import Image
from qwen_batch import GAME, ROOT as BATCH, MODEL, MOODS, NEGATIVE, STYLE, key_green, save_json, sha

KEY = 'ren_cultivator_f2_wasted'
ROOT = GAME/'art/repairs'/KEY
RAW = GAME/'art/raw/chars'/f'{KEY}.png'
WEBP = GAME/'assets/chars'/f'{KEY}.webp'
BASE = GAME/'art/raw/chars/ren_cultivator_f2.png'


def generate():
    if len(list((BATCH/'provider').glob('*/complete.json'))) != 385:
        raise RuntimeError('User requested this repair after the ongoing 55-character batch; wait until 385/385')
    if (ROOT/'complete.json').exists():
        print('SKIP already generated repair; inspect before installation')
        return
    ROOT.mkdir(parents=True, exist_ok=True)
    lock = ROOT/'in-flight.json'
    if lock.exists():
        raise RuntimeError('Unresolved earlier repair invocation; inspect before retrying')
    reference = ROOT/'neutral-reference.png'
    with Image.open(BASE) as raw:
        image = raw.convert('RGBA')
        image.putalpha(image.getchannel('A').point(lambda v: round(max(0, min(1, (v-80)/175))*255)))
        image = image.crop(image.getchannel('A').getbbox())
        image.thumbnail((950, 1400), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (1024, 1536), (0, 255, 0))
        canvas.paste(image, ((1024-image.width)//2, 1536-image.height-50), image)
        canvas.save(reference)
    prompt = ('Edit the reference image of this specific young adult Chinese female rogue cultivator. '
              'Keep exactly the same actress, recognizable facial bone structure, dark braided hair, hairpin, '
              'tattered grey-purple layered robes, waist gourd and sword, folded-arm standing pose, '
              'camera, lighting and full-body proportions. Exactly two arms and two hands in the original pose. '
              'Only change her facial state to: '+MOODS['wasted']+'. '
              'Make hollow cheeks and dark under-eye circles clearly visible, visibly ill and exhausted, '
              'but still unmistakably the same woman, not a different casting. '+STYLE)
    env = os.environ.copy()
    for key in ('HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY', 'all_proxy',
                'BAILIAN_SKILL_NAME', 'BAILIAN_SKILL_VERSION'):
        env.pop(key, None)
    env.update(BAILIAN_CALLER_TYPE='script', BAILIAN_CALLER_NAME='codex', NO_COLOR='1')
    out = ROOT/'provider'
    out.mkdir(exist_ok=True)
    cmd = ['bl', 'image', 'edit', '--model', MODEL, '--image', str(reference), '--prompt', prompt,
           '--negative-prompt', NEGATIVE+', extra arms, extra hands, different actress, different costume',
           '--size', '1024*1536', '--seed', '153999', '--n', '1', '--prompt-extend', 'false',
           '--watermark', 'false', '--out-dir', str(out), '--out-prefix', KEY, '--output', 'json', '--timeout', '240']
    endpoint = None
    if env.get('DASHSCOPE_API_KEY', '').startswith('sk-sp-'):
        endpoint = 'https://token-plan.cn-beijing.maas.aliyuncs.com'
        cmd += ['--base-url', endpoint]
    save_json(ROOT/'request.json', {'model': MODEL, 'asset_id': KEY, 'prompt': prompt,
              'reference_sha256': sha(BASE), 'processed_reference_sha256': sha(reference),
              'previous_raw_sha256': sha(RAW), 'previous_webp_sha256': sha(WEBP),
              'endpoint_override': endpoint, 'size': '1024*1536', 'seed': 153999})
    with lock.open('x') as fp:
        json.dump({'started_at': datetime.now(timezone.utc).isoformat()}, fp)
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
    (ROOT/'response.json').write_text(result.stdout)
    (ROOT/'cli.stderr.log').write_text(result.stderr)
    if result.returncode:
        save_json(ROOT/'failure.json', {'exit_code': result.returncode, 'review_required': True})
        raise RuntimeError('Repair CLI failed; inspect isolated logs, no automatic retry')
    candidates = [p for p in out.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')]
    if len(candidates) != 1:
        raise RuntimeError('Expected one output; inspect provider response')
    raw = candidates[0]
    with Image.open(raw) as image:
        image.verify()
    with Image.open(raw) as image:
        cutout = key_green(image)
        cutout.save(ROOT/(KEY+'.png'), 'PNG')
        cutout.save(ROOT/(KEY+'.webp'), 'WEBP', quality=90, method=6)
    # Show original neutral, defective old variant and proposed repair side by side.
    sheet = Image.new('RGB', (1050, 700), (39, 29, 44))
    for i, p in enumerate((BASE, RAW, ROOT/(KEY+'.webp'))):
        with Image.open(p) as source:
            pic = source.convert('RGBA'); pic.thumbnail((340, 680))
        sheet.paste(pic, (i*350+(350-pic.width)//2, 10), pic)
    sheet.save(ROOT/'comparison.jpg', quality=93)
    save_json(ROOT/'complete.json', {'model': MODEL, 'asset_id': KEY,
              'image_file': str(raw.relative_to(ROOT)), 'sha256': sha(raw),
              'cleaned_png': KEY+'.png', 'cleaned_png_sha256': sha(ROOT/(KEY+'.png')),
              'cutout': KEY+'.webp', 'cutout_sha256': sha(ROOT/(KEY+'.webp')),
              'status': 'generated_pending_visual_review'})
    lock.unlink()
    print('REPAIR GENERATED; review '+str(ROOT/'comparison.jpg'))


def install():
    request = json.loads((ROOT/'request.json').read_text())
    complete = json.loads((ROOT/'complete.json').read_text())
    if (ROOT/'installed.json').exists():
        print('SKIP repair already installed')
        return
    if sha(RAW) != request['previous_raw_sha256'] or sha(WEBP) != request['previous_webp_sha256']:
        raise RuntimeError('Existing variant changed since repair began; do not overwrite concurrent edits')
    source = ROOT/complete['image_file']; cutout = ROOT/complete['cutout']
    cleaned = ROOT/complete['cleaned_png']
    if (sha(source) != complete['sha256'] or sha(cutout) != complete['cutout_sha256']
            or sha(cleaned) != complete['cleaned_png_sha256']):
        raise RuntimeError('Proposed repair hash mismatch')
    archive = ROOT/'archive'
    archive.mkdir(exist_ok=True)
    shutil.copy2(RAW, archive/RAW.name); shutil.copy2(WEBP, archive/WEBP.name)
    shutil.copy2(cleaned, RAW)
    shutil.copy2(cutout, WEBP)
    save_json(ROOT/'installed.json', {'model': MODEL, 'asset_id': KEY, 'replaced_existing_only': True,
              'previous_raw_sha256': request['previous_raw_sha256'],
              'previous_webp_sha256': request['previous_webp_sha256'],
              'new_raw_sha256': sha(RAW), 'new_webp_sha256': sha(WEBP),
              'installed_at': datetime.now(timezone.utc).isoformat()})
    print('REPAIR INSTALLED; old raw and WebP archived, no other asset replaced')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['generate', 'install'], required=True)
    args = parser.parse_args()
    generate() if args.phase == 'generate' else install()
