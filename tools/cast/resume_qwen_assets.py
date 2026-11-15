#!/usr/bin/env python3
"""Install reviewed complete Qwen sets and record a safe continuation checkpoint.

Local processing only. Unresolved provider requests are deliberately preserved.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess

from PIL import Image
from qwen_batch import GAME, ROOT, ROSTER, STATES, install, key_for, save_json, sha, status

SNAPSHOT = ROOT / 'resume-baseline-20261115.json'


def ready_ids():
    return [role['id'] for role in ROSTER['characters']
            if all((ROOT / 'provider' / key_for(role, state) / 'complete.json').is_file()
                   for state in STATES)]


def checkpoint():
    if not SNAPSHOT.exists():
        records = {str(path.relative_to(GAME)): sha(path)
                   for folder, extension in [('art/raw/chars', '*.png'), ('assets/chars', '*.webp')]
                   for path in sorted((GAME / folder).glob(extension))}
        save_json(SNAPSHOT, records)
    pending = []
    for role in ROSTER['characters']:
        for state in STATES:
            key = key_for(role, state)
            folder = ROOT / 'provider' / key
            if not (folder / 'complete.json').exists():
                pending.append({'asset_id': key, 'character': role['id'], 'state': state,
                                'status': 'unresolved_interrupted_request' if (folder / 'in-flight.json').exists()
                                else 'not_submitted'})
    save_json(ROOT / 'continuation.json', {
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'model': 'qwen-image-3.0-pro', 'ready_character_ids': ready_ids(),
        'pending_images': pending,
        'cloud_preflight': {'skill_version': '2.10.1', 'installed_cli': '2.10.1',
                            'npm_latest': '2.10.1', 'status': 'upgraded_with_user_approval'},
        'unresolved_requests': {
            'asset_ids': [p['asset_id'] for p in pending if p['status'] == 'unresolved_interrupted_request'],
            'evidence': 'No live process, response, image, failure result or remote task ID was retained; no matching completion telemetry.',
            'action': 'Preserve original request and in-flight markers; do not blindly resubmit.'},
    })
    print(f'Checkpoint: {len(ready_ids())} complete characters; {len(pending)} pending images.')


def verify():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    installed = json.loads((ROOT / 'installed.json').read_text())
    entries = [entry for entry in manifest['images'] if entry['character'] in installed['character_ids']]
    assert len(entries) == 7 * installed['character_count']
    art_source = (GAME / 'assets/art.js').read_text()
    listed = set(json.loads(re.search(r'const ART_LIST\s*=\s*(\[.*?\]);', art_source, re.S).group(1)))
    for entry in entries:
        key = entry['asset_id']
        assert sha(ROOT / entry['image_file']) == entry['sha256'], key
        assert 'chars/' + key in listed, key
        for suffix, source_key in [('.png', 'cleaned_png'), ('.webp', 'cutout')]:
            target = GAME / ('art/raw/chars' if suffix == '.png' else 'assets/chars') / (key + suffix)
            assert sha(target) == sha(ROOT / entry[source_key]), str(target)
            with Image.open(target) as image:
                image.load()
                assert image.format == ('PNG' if suffix == '.png' else 'WEBP'), str(target)
                assert image.mode == 'RGBA' and image.height == 1300, str(target)
                assert image.getchannel('A').getextrema() == (0, 255), str(target)
    before = json.loads(SNAPSHOT.read_text())
    changed = [relative for relative, digest in before.items() if sha(GAME / relative) != digest]
    # The explicitly requested deferred repair is separate from the new batch.
    # Accept only its recorded bytes, with the original bytes still archived.
    repair_root = GAME / 'art/repairs/ren_cultivator_f2_wasted'
    repair_marker = repair_root / 'installed.json'
    authorized_repairs = []
    if repair_marker.exists():
        repair = json.loads(repair_marker.read_text())
        for directory, suffix, kind in [('art/raw/chars', '.png', 'raw'),
                                        ('assets/chars', '.webp', 'webp')]:
            filename = repair['asset_id'] + suffix
            relative = directory + '/' + filename
            assert sha(repair_root / 'archive' / filename) == before[relative]
            assert repair['previous_' + kind + '_sha256'] == before[relative]
            assert sha(GAME / relative) == repair['new_' + kind + '_sha256']
            with Image.open(GAME / relative) as image:
                image.load()
                assert image.format == ('PNG' if suffix == '.png' else 'WEBP')
                assert image.mode == 'RGBA' and image.height == 1300
                assert image.getchannel('A').getextrema() == (0, 255)
            authorized_repairs.append(relative)
    spy_root = GAME / 'art/repairs/xian_spy_f1_qwen_20261115'
    spy_marker = spy_root / 'installed.json'
    if spy_marker.exists():
        spy = json.loads(spy_marker.read_text())
        assert spy['face'] == 'xian_spy_f1' and len(spy['assets']) == 14
        spy_keys = {'xian_spy_f1' + ('' if state == 'neutral' else '_' + state)
                    for state in STATES}
        for entry in spy['assets']:
            relative = entry['path']
            assert Path(relative).stem in spy_keys
            assert sha(spy_root / 'before' / relative) == before[relative]
            assert sha(GAME / relative) == entry['sha256']
            authorized_repairs.append(relative)
    assert set(changed) == set(authorized_repairs), changed
    pending = json.loads((ROOT / 'continuation.json').read_text())['pending_images']
    report = {'installed_characters': installed['character_count'], 'installed_images': len(entries),
              'png_and_webp_valid': True, 'transparent_backgrounds': True, 'height': 1300,
              'registered_in_art_list': True, 'provider_and_runtime_hashes_valid': True,
              'preexisting_character_files_preserved': len(before) - len(changed),
              'authorized_repaired_files_with_archived_originals': authorized_repairs,
              'pending_images': len(pending), 'pending_status': dict(Counter(p['status'] for p in pending))}
    save_json(ROOT / 'resume-verification.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def checks():
    ecology = subprocess.run(['node', 'tools/cast/check_ecology.mjs'], cwd=GAME,
                             capture_output=True, text=True)
    assert ecology.returncode == 0, ecology.stderr
    cast = subprocess.run(['node', 'tools/cast/cast.mjs', 'check', '--days', '200', '--runs', '6'],
                          cwd=GAME, capture_output=True, text=True)
    (ROOT / 'resume-cast-check.log').write_text(cast.stdout + cast.stderr)
    installed = set(json.loads((ROOT / 'installed.json').read_text())['character_ids'])
    blocks = re.split(r'\n■ ', cast.stdout)[1:]
    checked, errors = [], []
    for block in blocks:
        first = block.splitlines()[0]
        identifier = re.search(r'（([^）]+)）', first).group(1)
        issues = [line.strip() for line in block.splitlines() if '✗' in line]
        if identifier in installed:
            assert not issues, (identifier, issues)
            checked.append(identifier)
        elif issues:
            errors.append({'character': identifier, 'issues': issues})
    pending = set(role['id'] for role in ROSTER['characters']) - installed
    assert set(checked) == installed
    assert {entry['character'] for entry in errors} == pending, errors
    if not pending:
        assert cast.returncode == 0, cast.stderr
    for entry in errors:
        assert len(entry['issues']) == 2
        assert '没有立绘' in entry['issues'][0] and '一次都没登场' in entry['issues'][1]
    report = {'ecology': json.loads(ecology.stdout), 'installed_character_checks_passed': len(checked),
              'days_per_run': 200, 'runs_per_character': 6,
              'full_check_exit_code': cast.returncode,
              'expected_uninstalled_character_failures': errors,
              'unexpected_failures': []}
    save_json(ROOT / 'resume-game-checks.json', report)
    print(json.dumps({key: value for key, value in report.items()
                      if key != 'expected_uninstalled_character_failures'}, ensure_ascii=False, indent=2))
    print(f'Remaining failures are only the {len(pending)} intentionally uninstalled incomplete sets.'
          if pending else 'All installed character checks passed; no missing sets remain.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['checkpoint', 'install', 'verify', 'checks'])
    args = parser.parse_args()
    if args.phase == 'checkpoint':
        checkpoint()
    elif args.phase == 'install':
        checkpoint()
        install(ready_ids())
        status()
    elif args.phase == 'verify':
        verify()
    else:
        checks()
