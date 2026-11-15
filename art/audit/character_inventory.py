#!/usr/bin/env python3
"""Read-only art inventory; only writes self-contained audit outputs next to this script."""
import ast
import csv
import json
import re
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
GROUPS = {
    'ren': {'beggar': '老乞丐', 'swindler': '落第书生／骗子', 'thug': '街头混混',
            'ren_cultivator': '落魄散修', 'ren_merchant': '凡人行商', 'ren_kid': '杂役少年'},
    'xian': {'xian_defector': '游方剑客', 'xian_spy': '蒙面女修'},
    'yao': {'yao_fox': '狐妖', 'yao_tiger': '虎妖', 'yao_snake': '蛇妖'},
    'mo': {'beggar_master': '前魔宗长老（老乞丐揭身）', 'amu_disciple': '阿木入魔宗',
           'broker': '鬼市牙人', 'landlord': '钱执事', 'steward_sun': '孙副管事',
           'mo_enforcer': '执法堂巡查', 'mo_disciple': '外门弟子',
           'mo_senior': '内门弟子／征调使', 'noble': '权贵'},
}


def read_image(path, expected_format, height=None):
    if not path.is_file():
        return 'missing'
    try:
        with Image.open(path) as im:
            detected = im.format
            if height and im.height != height:
                return 'unexpected_size'
            im.verify()
        with Image.open(path) as im:
            im.load()
            if height and (im.mode != 'RGBA' or im.getchannel('A').getextrema()[0] == 255):
                return 'missing_transparency'
    except (OSError, ValueError, SyntaxError):
        return 'invalid'
    return 'ok' if detected == expected_format else f'format_mismatch:{detected}'


def sheet(rows, path):
    cols, w, h = 6, 180, 342
    bg = (42, 35, 49)
    image = Image.new('RGB', (cols*w, ((len(rows)+cols-1)//cols)*h), bg)
    draw = ImageDraw.Draw(image)
    font_path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    font = ImageFont.truetype(str(font_path), 13) if font_path.is_file() else ImageFont.load_default()
    for i, row in enumerate(rows):
        x, y = i%cols*w, i//cols*h
        path_to_image = GAME/row['runtime_base']
        if path_to_image.is_file() and row['runtime_base_ok']:
            with Image.open(path_to_image) as raw:
                pic = raw.convert('RGBA')
            pic.thumbnail((w-10, h-45), Image.Resampling.LANCZOS)
            image.paste(pic, (x+(w-pic.width)//2, y+h-39-pic.height), pic)
        draw.text((x+5, y+h-34), row['face_id'], font=font, fill='white')
        sex = 'F' if row['sex_logic']=='f' else 'M*'
        draw.text((x+5, y+h-17), f"{sex} | P {row['png_ok']}/7 | W {row['webp_ok']}/7",
                  font=font, fill=(210, 197, 220))
    image.save(path, quality=91)


def main():
    design_ast = ast.parse((GAME/'tools/art/specs.py').read_text())
    definitions = {n.targets[0].id: ast.literal_eval(n.value) for n in design_ast.body
                   if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
                   and n.targets[0].id in {'PORTRAITS', 'MOODS', 'GENERIC', 'FACE_OVERRIDE', 'FACE_NOTE'}}
    moods = ['neutral', *definitions['MOODS']]
    design_roles = {role for mapping in GROUPS.values() for role in mapping}
    assert design_roles == set(definitions['PORTRAITS']) and len(moods) == 7
    js = (GAME/'js/people.js').read_text()
    sex_block = js.split('const FACE_SEX = {', 1)[1].split('};', 1)[0]
    sex_map = dict(re.findall(r"(\w+):\s*'([fm])'", sex_block))
    art_js = (GAME/'assets/art.js').read_text()
    listed = set(json.loads(re.search(r'const ART_LIST\s*=\s*(\[.*?\]);', art_js, re.S).group(1)))
    jobs = {j['id'].removeprefix('char:'): j for j in json.loads((GAME/'art/manifest.json').read_text())
            if j['id'].startswith('char:')}
    job_names, faces, totals = set(), [], {}
    for faction, roles in GROUPS.items():
        faction_rows = []
        for role, name in roles.items():
            ids = [role, role+'_f1', role+'_f2'] if role in definitions['GENERIC'] else [role]
            for index, face_id in enumerate(ids):
                states = {}
                for mood in moods:
                    key = face_id if mood == 'neutral' else f'{face_id}_{mood}'
                    job_names.add(key)
                    job = jobs.get(key)
                    raw_path = GAME/'art'/(job['out'] if job else f'raw/chars/{key}.png')
                    runtime_path = GAME/'assets/chars'/f'{key}.webp'
                    states[mood] = {
                        'manifested': job is not None, 'png': read_image(raw_path, 'PNG'),
                        'webp': read_image(runtime_path, 'WEBP', 1300), 'listed': f'chars/{key}' in listed,
                    }
                faction_rows.append({
                    'faction': faction, 'role_id': role, 'role': name, 'face_id': face_id,
                    'sex_logic': sex_map.get(face_id, 'm-default'),
                    'base_design': definitions['PORTRAITS'][role],
                    'casting_note': definitions['FACE_OVERRIDE'].get(face_id, definitions['FACE_NOTE'][index]) if index else '',
                    'runtime_base': f'assets/chars/{face_id}.webp',
                    'runtime_base_ok': states['neutral']['webp'] == 'ok',
                    'png_ok': sum(x['png']=='ok' for x in states.values()),
                    'webp_ok': sum(x['webp']=='ok' for x in states.values()),
                    'listed': sum(x['listed'] for x in states.values()), 'states': states,
                })
        faces.extend(faction_rows)
        totals[faction] = {'roles': len(roles), 'faces': len(faction_rows),
                           'female_mapping': sum(r['sex_logic']=='f' for r in faction_rows),
                           'complete_faces': sum(r['png_ok']==r['webp_ok']==r['listed']==7 and
                                                 all(s['manifested'] for s in r['states'].values()) for r in faction_rows),
                           **{field: sum(r[field] for r in faction_rows) for field in ['png_ok', 'webp_ok', 'listed']}}
        sheet(faction_rows, OUT/f'{faction}-faces.jpg')

    latest = {}
    log_ids = {f'char:{name}' for name in jobs}
    for line in (GAME/'art/batch_log.jsonl').read_text().splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get('id') in log_ids:
            latest[row['id']] = row['status']
    experiments = GAME/'art/experiments'
    exp = []
    for folder in sorted(p.parent for p in experiments.rglob('status.json')):
        manifest_file = folder/'manifest.json'
        records = json.loads(manifest_file.read_text())['images'] if manifest_file.is_file() else []
        exp.append({'directory': str(folder.relative_to(GAME)), 'faces': sorted({e['role'] for e in records}),
                    'completed': len(list(folder.glob('provider/*/complete.json'))),
                    'png_ok': sum(read_image(folder/e['image_file'], 'PNG')=='ok' for e in records),
                    'webp_ok': sum(read_image(folder/e['cutout'], 'WEBP', 1300)=='ok' for e in records),
                    'unresolved_requests': [p.parent.name for p in folder.glob('provider/*/in-flight.json')],
                    'integrated': False})
    audit = {'production': totals, 'states': moods, 'manifest_jobs': len(jobs),
             'latest_character_log': dict(Counter(latest.values())),
             'manifest_outside_design': sorted(set(jobs)-job_names),
             'raw_outside_design': sorted(p.stem for p in (GAME/'art/raw/chars').glob('*.png') if p.stem not in job_names),
             'webp_outside_design': sorted(p.stem for p in (GAME/'assets/chars').glob('*.webp') if p.stem not in job_names),
             'faces': faces, 'experiments': exp}
    (OUT/'character-inventory.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
    with (OUT/'character-inventory.csv').open('w', encoding='utf-8-sig', newline='') as fp:
        keys = ['faction', 'role_id', 'role', 'face_id', 'sex_logic', 'png_ok', 'webp_ok', 'listed', *moods]
        writer = csv.DictWriter(fp, fieldnames=keys)
        writer.writeheader()
        for r in faces:
            row = {k: r[k] for k in keys if k in r}
            row.update({m: 'ok' if r['states'][m] == {'manifested': True, 'png': 'ok', 'webp': 'ok', 'listed': True}
                        else json.dumps(r['states'][m], ensure_ascii=False) for m in moods})
            writer.writerow(row)
    print(json.dumps({k: v for k, v in audit.items() if k != 'faces'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
