#!/usr/bin/env python3
"""生成 gpt-image 批量清单 art/manifest.json：底图先画，变体（品相、状态、神态、面孔、运转）以底图为参考改图。
用法：python3 tools/art/build_manifest.py [--quality high]"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from specs import *

q = sys.argv[sys.argv.index('--quality') + 1] if '--quality' in sys.argv else 'high'
jobs = []
def job(id, prompt, out, size='1024x1024', bg='transparent', refs=None):
    j = {'id': id, 'prompt': prompt, 'out': out, 'size': size, 'quality': q}
    if bg: j['background'] = bg
    if refs: j['refs'] = refs
    jobs.append(j)

EDIT = 'Same {what}, same framing, same camera angle and lighting, same style. Only change this: {c}. Keep the transparent background.'

# 物品：底图即中等品相
for k, d in ITEMS.items():
    size = '1024x1536' if k in TALL else '1024x1024'
    base = f'raw/items/{k}.png'
    job(f'item:{k}', ITEM_PREFIX.format(d=d), base, size)
    if k.startswith('book_') or k in NO_TIER: continue
    for t, c in TIERS.items():
        job(f'item:{k}_{t}', EDIT.format(what='object', c=c), f'raw/items/{k}_{t}.png', size, refs=[base])
for k, v, c in STATES:
    size = '1024x1536' if k in TALL else '1024x1024'
    job(f'item:{k}_{v}', EDIT.format(what='object', c=c), f'raw/items/{k}_{v}.png', size, refs=[f'raw/items/{k}.png'])

# 人物：底图即平常神态；泛泛之辈多两张脸；每张脸六种神态
for k, d in PORTRAITS.items():
    faces = [k] + ([f'{k}_f1', f'{k}_f2'] if k in GENERIC else [])
    for i, f in enumerate(faces):
        base = f'raw/chars/{f}.png'
        if i == 0: job(f'char:{f}', PORTRAIT_PREFIX.format(d=d + ', neutral calm expression'), base, '1024x1536')
        else: job(f'char:{f}', PORTRAIT_PREFIX.format(d=f'{d}, {FACE_OVERRIDE.get(f, FACE_NOTE[i])}, neutral calm expression'), base, '1024x1536')
        for m, c in MOODS.items():
            job(f'char:{f}_{m}', EDIT.format(what='actor, same costume', c=f'the facial expression and state: {c}'), f'raw/chars/{f}_{m}.png', '1024x1536', refs=[base])

for k, (size, d) in SCENES.items():
    job(f'scene:{k}', SCENE_PREFIX.format(d=d), f'raw/scene/{k}.png', size, bg='opaque')
for k, (ref, c) in ENDINGS.items():
    job(f'scene:{k}', ENDING_EDIT.format(c=c), f'raw/scene/{k}.png', '1536x1024', bg='opaque', refs=[f'raw/scene/{ref}.png'])

for k, d in MACHINES.items():
    base = f'raw/machines/{k}.png'
    job(f'machine:{k}', MACHINE_PREFIX.format(d=d + ', idle, cold and dark'), base)
    job(f'machine:{k}_running', EDIT.format(what='object', c=MACHINE_RUN), f'raw/machines/{k}_running.png', refs=[base])

for k, d in ICONS.items():
    job(f'icon:{k}', ICON_PREFIX.format(d=d), f'raw/ui/{k}.png')

root = os.path.join(os.path.dirname(__file__), '../../art')
os.makedirs(root, exist_ok=True)
json.dump(jobs, open(os.path.join(root, 'manifest.json'), 'w'), ensure_ascii=False, indent=0)
from collections import Counter
print(len(jobs), dict(Counter(j['id'].split(':')[0] for j in jobs)), 'edits', sum(1 for j in jobs if 'refs' in j))
