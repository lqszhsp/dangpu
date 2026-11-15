#!/usr/bin/env python3
"""Qwen character asset batch. Stage under art/, never overwrite another batch.

python3 tools/cast/qwen_batch.py --phase bases --jobs 4
python3 tools/cast/qwen_batch.py --phase variants --jobs 4
python3 tools/cast/qwen_batch.py --phase preview
python3 tools/cast/qwen_batch.py --phase install
"""
import argparse
import ast
import csv
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

GAME = Path(__file__).resolve().parents[2]
ROOT = GAME/'art/cast_expansion_qwen3pro'
ROSTER = json.loads((ROOT/'roster.json').read_text())
MODEL = 'qwen-image-3.0-pro'
TREE = ast.parse((GAME/'tools/art/specs.py').read_text())
MOODS = next(ast.literal_eval(n.value) for n in TREE.body if isinstance(n, ast.Assign)
             and any(isinstance(t, ast.Name) and t.id == 'MOODS' for t in n.targets))
STATES = ['neutral', *MOODS]
STYLE = ('Cinematic photorealistic high-budget Chinese dark xianxia costume drama actor photograph. '
         'Exactly one human or humanoid person standing naturally, facing camera, full body from head to both feet visible '
         'with small margin, centered, occupying about 90 percent height, consistent 85mm portrait perspective. '
         'Real skin pores and worn fabric and metal. Warm red lantern key light from left, cool purple rim light from right, '
         'muted dark cinematic colors, face and clothes still readable. '
         'Background flat uniform bright green RGB(0,255,0), no floor, no cast shadow, no gradient, '
         'no green clothing or green reflections. No text, label, border, UI or watermark. ')
NEGATIVE = ('anime, cartoon, illustration, painting, plastic CGI skin, beauty smoothing, collage, multiple people, '
            'cropped head, cropped feet, half body, extra limbs, extra fingers, background scenery, text, watermark, '
            'nudity, lingerie, sexual pose, green clothes, green skin, checkerboard')
STOP = threading.Event()
PRINT_LOCK = threading.Lock()
RATE_LOCK = threading.Lock()
NEXT_REQUEST = 0.0


def request_slot():
    global NEXT_REQUEST
    while not STOP.is_set():
        with RATE_LOCK:
            now = time.monotonic()
            if now >= NEXT_REQUEST:
                NEXT_REQUEST = now+7.0  # observed 10 RPM limit: leave headroom
                return True
        STOP.wait(0.5)
    return False


def say(message):
    with PRINT_LOCK:
        print(message, flush=True)


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def key_for(role, state):
    return role['id'] if state == 'neutral' else role['id']+'_'+state


def generate(role, state):
    if STOP.is_set():
        return
    key = key_for(role, state)
    folder = ROOT/'provider'/key
    complete = folder/'complete.json'
    if complete.exists():
        record = json.loads(complete.read_text())
        if sha(ROOT/record['image_file']) != record['sha256']:
            STOP.set()
            raise RuntimeError('Completed image hash mismatch: '+key)
        return
    folder.mkdir(parents=True, exist_ok=True)
    lock = folder/'in-flight.json'
    if lock.exists():
        STOP.set()
        raise RuntimeError('Unresolved request; inspect before retrying: '+key)
    if not request_slot():
        return
    seed = 151000 + [r['id'] for r in ROSTER['characters']].index(role['id'])*10+STATES.index(state)
    reference = None
    if state == 'neutral':
        prompt = STYLE+role['art']+'. Neutral calm expression. '
        if role['age'] < 18:
            prompt += 'Clearly adolescent, age-appropriate ordinary fully covered work clothes and nonsexual stance. '
    else:
        base = ROOT/'provider'/role['id']/'complete.json'
        if not base.exists():
            raise RuntimeError('Missing reviewed identity base: '+role['id'])
        reference = ROOT/'references'/f"{role['id']}.png"
        if not reference.exists():
            raise RuntimeError('Missing cleaned identity reference: '+role['id'])
        prompt = ('Edit this reference. Same actor, same recognizable face and age, same costume, hair, accessories, '
                  'props, hand positions, full-body framing, camera and lighting. Only change the facial expression '
                  'and visible state to: '+MOODS[state]+'. Keep the same human or humanoid identity. '
                  'Keep the uniform bright green background. '+STYLE)
        if role['age'] < 18:
            prompt += 'Keep the same adolescent, fully covered age-appropriate work clothes and nonsexual pose. '
    cmd = ['bl', 'image', 'edit' if reference else 'generate', '--model', MODEL, '--prompt', prompt,
           '--negative-prompt', NEGATIVE, '--size', '1024*1536', '--seed', str(seed), '--n', '1',
           '--prompt-extend', 'false', '--watermark', 'false', '--out-dir', str(folder),
           '--out-prefix', key, '--output', 'json', '--timeout', '240']
    if reference:
        cmd += ['--image', str(reference)]
    endpoint = None
    if os.environ.get('DASHSCOPE_API_KEY', '').startswith('sk-sp-'):
        endpoint = 'https://token-plan.cn-beijing.maas.aliyuncs.com'
        cmd += ['--base-url', endpoint]
    save_json(folder/'request.json', {'model': MODEL, 'character': role['id'], 'state': state,
              'prompt': prompt, 'negative_prompt': NEGATIVE, 'size': '1024*1536', 'seed': seed,
              'reference': str(reference.relative_to(ROOT)) if reference else None,
              'reference_sha256': sha(reference) if reference else None, 'endpoint_override': endpoint,
              'proxy_environment': 'removed for this subprocess only', 'n': 1,
              'watermark': False, 'prompt_extend': False})
    # Exclusive marker remains on failure or interruption: no blind duplicate billing.
    with lock.open('x') as fp:
        json.dump({'started': datetime.now(timezone.utc).isoformat(), 'asset_id': key}, fp)
    env = os.environ.copy()
    for var in ('HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'ALL_PROXY', 'all_proxy',
                'BAILIAN_SKILL_NAME', 'BAILIAN_SKILL_VERSION'):
        env.pop(var, None)
    env.update(BAILIAN_CALLER_TYPE='script', BAILIAN_CALLER_NAME='codex', NO_COLOR='1')
    say('START '+key)
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
        (folder/'response.json').write_text(result.stdout)
        (folder/'cli.stderr.log').write_text(result.stderr)
        if result.returncode:
            save_json(folder/'failure.json', {'exit_code': result.returncode, 'review_required': True})
            raise RuntimeError(f'CLI exit {result.returncode}; inspect log for {key}')
        candidates = [p for p in folder.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')]
        if len(candidates) != 1:
            raise RuntimeError(f'Expected one downloaded image, got {len(candidates)}: {key}')
        raw = candidates[0]
        with Image.open(raw) as image:
            image.verify()
        save_json(complete, {'character': role['id'], 'state': state, 'asset_id': key,
                  'image_file': str(raw.relative_to(ROOT)), 'sha256': sha(raw), 'seed': seed, 'model': MODEL})
        lock.unlink()
        say('DONE '+key)
    except Exception:
        STOP.set()
        raise


def key_green(image):
    image = image.convert('RGBA')
    r, g, b, old_alpha = image.split()
    other = ImageChops.lighter(r, b)
    dominance = ImageChops.subtract(g, other)
    alpha = dominance.point(lambda v: round((1-min(1, max(0, (v-18)/65)))*255))
    edge = alpha.point(lambda v: 255 if v < 254 else 0)
    green = Image.composite(ImageChops.darker(g, other), g, edge)
    image = Image.merge('RGBA', (r, green, b, ImageChops.darker(old_alpha, alpha)))
    # The model sometimes draws an unrelated lantern at the canvas edge.
    # Keep the largest connected subject, not disconnected background props.
    small = alpha.resize((256, 384), Image.Resampling.NEAREST).point(lambda v: 255 if v > 80 else 0)
    pixels = bytearray(small.tobytes())
    largest = []
    for start in range(len(pixels)):
        if not pixels[start]:
            continue
        component, stack = [], [start]
        pixels[start] = 0
        while stack:
            index = stack.pop()
            component.append(index)
            x, y = index % 256, index // 256
            for adjacent in (index-1 if x else -1, index+1 if x < 255 else -1,
                             index-256 if y else -1, index+256 if y < 383 else -1):
                if adjacent >= 0 and pixels[adjacent]:
                    pixels[adjacent] = 0
                    stack.append(adjacent)
        if len(component) > len(largest):
            largest = component
    keep = bytearray(len(pixels))
    for index in largest:
        keep[index] = 255
    connected = Image.frombytes('L', small.size, bytes(keep)).filter(ImageFilter.MaxFilter(3))
    connected = connected.resize(image.size, Image.Resampling.NEAREST)
    image.putalpha(ImageChops.darker(image.getchannel('A'), connected))
    box = image.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        raise RuntimeError('Empty chroma cutout')
    image = image.crop(box)
    return image.resize((round(image.width*1300/image.height), 1300), Image.Resampling.LANCZOS)


def prepare_references(roles):
    (ROOT/'references').mkdir(exist_ok=True)
    for role in roles:
        target = ROOT/'references'/f"{role['id']}.png"
        if target.exists():
            continue
        marker = ROOT/'provider'/role['id']/'complete.json'
        with Image.open(ROOT/json.loads(marker.read_text())['image_file']) as raw:
            subject = key_green(raw)
        # This is a processed model-generated reference, not a newly generated image.
        canvas = Image.new('RGB', (1024, 1536), (0, 255, 0))
        subject.thumbnail((950, 1400), Image.Resampling.LANCZOS)
        canvas.paste(subject, ((1024-subject.width)//2, 1536-subject.height-60), subject)
        canvas.save(target)
    say(f'PREPARED {len(roles)} cleaned neutral references')


def preview():
    entries = []
    (ROOT/'cutouts').mkdir(exist_ok=True)
    (ROOT/'cleaned').mkdir(exist_ok=True)
    (ROOT/'sheets').mkdir(exist_ok=True)
    for role in ROSTER['characters']:
        for state in STATES:
            key = key_for(role, state)
            marker = ROOT/'provider'/key/'complete.json'
            if not marker.exists():
                continue
            record = json.loads(marker.read_text())
            target = ROOT/'cutouts'/f'{key}.webp'
            cleaned = ROOT/'cleaned'/f'{key}.png'
            if not target.exists() or target.stat().st_mtime < max(marker.stat().st_mtime, Path(__file__).stat().st_mtime):
                with Image.open(ROOT/record['image_file']) as raw:
                    subject = key_green(raw)
                    subject.save(cleaned, 'PNG')
                    subject.save(target, 'WEBP', quality=90, method=6)
            elif not cleaned.exists():
                with Image.open(ROOT/record['image_file']) as raw:
                    key_green(raw).save(cleaned, 'PNG')
            with Image.open(target) as image:
                size = image.size
                if image.mode != 'RGBA' or image.height != 1300 or image.getchannel('A').getextrema()[0] != 0:
                    raise RuntimeError('Invalid cutout: '+key)
                # The lossless PNG is derived directly from the provider original, never from lossy WebP.
            entries.append({**record, 'cutout': str(target.relative_to(ROOT)), 'cutout_sha256': sha(target),
                            'cleaned_png': str(cleaned.relative_to(ROOT)), 'cleaned_png_sha256': sha(cleaned),
                            'width': size[0], 'height': size[1], 'name': role['name'], 'plan_group': role['plan_group']})
    save_json(ROOT/'manifest.json', {'model': MODEL, 'expected': 385, 'completed': len(entries), 'images': entries})
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 12)
    by_key = {e['asset_id']: e for e in entries}
    for group in ('ren', 'yao', 'mo', 'xian_ecology'):
        group_roles = [r for r in ROSTER['characters'] if r['plan_group'] == group]
        for page in range((len(group_roles)+7)//8):
            selected = group_roles[page*8:(page+1)*8]
            for faces in (False, True):
                w, h = (160, 180) if faces else (160, 300)
                sheet = Image.new('RGB', (7*w, len(selected)*h), (39, 29, 44))
                draw = ImageDraw.Draw(sheet)
                for y, role in enumerate(selected):
                    for x, state in enumerate(STATES):
                        entry = by_key.get(key_for(role, state))
                        if entry:
                            with Image.open(ROOT/entry['cutout']) as raw:
                                image = raw.convert('RGBA')
                            if faces:
                                image = image.crop((0, 0, image.width, round(image.height*.29)))
                            image.thumbnail((w-8, h-32), Image.Resampling.LANCZOS)
                            sheet.paste(image, (x*w+(w-image.width)//2, y*h+4), image)
                        draw.text((x*w+3, (y+1)*h-28), role['id'][:23], font=font, fill='white')
                        draw.text((x*w+3, (y+1)*h-14), state, font=font, fill=(230, 200, 165))
                sheet.save(ROOT/'sheets'/f'{group}-{page+1}{"-faces" if faces else ""}.jpg', quality=90)
    say(f'PREVIEW {len(entries)}/385')


def status():
    rows = []
    for role in ROSTER['characters']:
        states = [s for s in STATES if (ROOT/'provider'/key_for(role, s)/'complete.json').exists()]
        installed = [s for s in STATES if (GAME/'assets/chars'/f'{key_for(role, s)}.webp').is_file()]
        rows.append({'id': role['id'], 'name': role['name'], 'title': role['title'], 'sex': role['sex'],
                     'age': role['age'], 'plan_group': role['plan_group'], 'runtime_faction': role['faction'],
                     'completed': len(states), 'installed': len(installed),
                     'missing': ' '.join(s for s in STATES if s not in states)})
    value = {'model': MODEL, 'characters': 55, 'planned_images': 385,
             'completed_images': sum(r['completed'] for r in rows),
             'complete_sets': sum(r['completed']==7 for r in rows),
             'installed_images': sum(r['installed'] for r in rows),
             'in_flight': len(list((ROOT/'provider').glob('*/in-flight.json'))),
             'failed_attempts_archived': len(list((ROOT/'attempts').glob('*/failure.json'))),
             'updated_at': datetime.now(timezone.utc).isoformat(), 'roles': rows}
    save_json(ROOT/'status.json', value)
    with (ROOT/'ledger.csv').open('w', encoding='utf-8-sig', newline='') as fp:
        writer = csv.DictWriter(fp, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
    text = ['# 本批次逐角色进度（自动生成）', '',
            f"模型 {MODEL}；成图 {value['completed_images']}/385，整套 {value['complete_sets']}/55，安装 {value['installed_images']}/385。", '',
            '| 人物 | 身份 | 性别／年龄 | 分组／阵营 | 成图 | 已安装 | 角色定义 |',
            '| --- | --- | --- | --- | ---: | ---: | --- |']
    for row in rows:
        text.append(f"| {row['name']} | {row['title']} | {row['sex']} / {row['age']} | {row['plan_group']} / {row['runtime_faction']} | {row['completed']}/7 | {row['installed']}/7 | [{row['id']}](../../js/cast/{row['id']}.js) |")
    (ROOT/'ledger.md').write_text('\n'.join(text)+'\n')
    say(json.dumps({k: v for k, v in value.items() if k != 'roles'}, ensure_ascii=False))


def install(ids=None):
    manifest = json.loads((ROOT/'manifest.json').read_text())
    expected = 7*len(ids) if ids else 385
    entries = [e for e in manifest['images'] if not ids or e['character'] in ids]
    if len(entries) != expected:
        raise RuntimeError(f'Selected batch must be complete before installation: {len(entries)}/{expected}')
    existing_list = GAME/'assets/art.js'
    import re
    text = existing_list.read_text()
    match = re.search(r'const ART_LIST\s*=\s*(\[.*?\]);', text, re.S)
    listed = set(json.loads(match.group(1)))
    installed_marker = ROOT/'installed.json'
    prior = json.loads(installed_marker.read_text()).get('character_ids', []) if installed_marker.exists() else []
    for entry in entries:
        key = entry['asset_id']
        raw_target = GAME/'art/raw/chars'/f'{key}.png'
        webp_target = GAME/'assets/chars'/f'{key}.webp'
        if 'cleaned_png' not in entry:
            raise RuntimeError('Run updated preview first; no cleaned PNG for '+key)
        # Never overwrite unknown files. Restart only when bytes already match.
        for target, source in [(raw_target, ROOT/entry['cleaned_png']), (webp_target, ROOT/entry['cutout'])]:
            if target.exists() and sha(target) != sha(source):
                # Migrate only this batch's previously installed untouched provider PNG.
                # This is the user-reported lantern correction, not permission to overwrite old assets.
                if target == raw_target and entry['character'] in prior and sha(target) == entry['sha256']:
                    continue
                raise RuntimeError('Refusing to overwrite existing asset: '+str(target))
    for entry in entries:
        key = entry['asset_id']
        source = ROOT/entry['cleaned_png']
        # Provider outputs validated above; PNG conversion if provider returns another encoding.
        with Image.open(source) as image:
            if image.format != 'PNG':
                raise RuntimeError('Non-PNG original needs explicit conversion before installation: '+key)
        for target, source in [(GAME/'art/raw/chars'/f'{key}.png', source),
                               (GAME/'assets/chars'/f'{key}.webp', ROOT/entry['cutout'])]:
            if not target.exists() or sha(target) != sha(source):
                shutil.copy2(source, target)
        listed.add('chars/'+key)
    # This is generated art-index output, not a rewrite of game logic.
    new_list = json.dumps(sorted(listed))
    existing_list.write_text(text[:match.start(1)]+new_list+text[match.end(1):])
    character_ids = sorted(set(prior) | {e['character'] for e in entries})
    save_json(installed_marker, {'images': len(character_ids)*7, 'model': MODEL,
                                    'character_count': len(character_ids), 'character_ids': character_ids,
                                    'installed_at': datetime.now(timezone.utc).isoformat()})
    say(f'INSTALLED {len(entries)} selected assets; existing assets preserved')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['bases', 'variants', 'preview', 'install', 'status'], required=True)
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--ids', nargs='+')
    args = parser.parse_args()
    if args.phase == 'status':
        return status()
    if args.phase == 'preview':
        return preview()
    if args.phase == 'install':
        return install(args.ids)
    roles = ROSTER['characters']
    if args.ids:
        unknown = set(args.ids)-{r['id'] for r in roles}
        if unknown:
            parser.error('Unknown ids: '+str(unknown))
        roles = [r for r in roles if r['id'] in args.ids]
    states = ['neutral'] if args.phase == 'bases' else STATES[1:]
    if args.phase == 'variants':
        prepare_references(roles)
    futures = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(generate, role, state) for role in roles for state in states]
        failures = []
        for future in futures:
            try:
                future.result()
            except Exception as exc:
                failures.append(str(exc))
    if failures:
        raise SystemExit('\n'.join(failures))
    say('PHASE COMPLETE '+args.phase)


if __name__ == '__main__':
    main()
