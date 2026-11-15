#!/usr/bin/env python3
"""Isolated Qwen female character test. Never writes to production assets.

python3 run_test.py --prepare
python3 run_test.py --generate bases --role qiuzhuan
python3 run_test.py --generate all --jobs 2
python3 run_test.py --preview
Requires Pillow and the authenticated bl CLI. Generation is billable.
"""
import argparse
import ast
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent
DEFAULT_ROOT = ROOT
GAME = ROOT.parents[3]
MODEL = 'qwen-image-3.0'
ROLES = {
    'qiuzhuan': {
        'name': '秋篆', 'title': '女符箓修补师（独立测试设定）',
        'reference': 'steward_sun.png',
        'description': '一位42岁成年女性符箓修补师。方圆脸，明显颧骨，眼角细纹，黑发夹少量银丝，低盘发用旧铜簪固定。身穿褪色灰紫色粗丝长袍，暗朱色窄袖内衫，旧皮腰封挂小型竹筒和修符工具。右手自然握一卷无字旧符纸，左手轻放腰侧。稳重、精明、经历过生活磨砺；是修理手艺人，不是官员或贵女。',
    },
    'zhaowei': {
        'name': '照微', 'title': '女夜巡灯使（独立测试设定）',
        'reference': 'mo_senior.png',
        'description': '一位28岁成年女性夜巡灯使。长椭圆脸，浓直眉，左眉尾一道浅浅旧疤，琥珀棕眼睛，黑色高马尾配细长暗铜发扣。身穿深靛蓝色短披肩、叠层墨灰长衣与窄袖护臂，腰挂铜制小牌，皮靴。右手在身体旁提一盏小型封闭铜灯，灯光是很弱的暗红色，左手自然垂下。修长而结实，沉静警觉的市井夜巡者，不是门派贵女。',
    },
}
STATES = {
    'neutral': '平常：嘴唇闭合，眉眼平静，专注地看向镜头，准备和掌柜说话。',
    'pleased': '欣喜：轻微露齿的真诚微笑，眼角放松，明显比原图高兴，仍然像克制的成年人。',
    'angry': '愤怒：眉头明显皱起，目光凌厉，嘴唇抿紧，咬肌收紧，压着怒火直视镜头。',
    'afraid': '惊惧：眼睛睁大，眉心抬起，嘴唇微张，脸色略白，有真实的受惊和戒备感。',
}
# Exact existing game definitions, not newly invented variant categories.
DESIGNED_STATES = {
    'sly': 'scheming sly half-smile, narrowed calculating eyes',
    'wasted': 'gaunt and drug-addicted: hollow cheeks, dark eye circles, sweating, trembling, sickly pale skin',
    'thrall': 'mind-controlled thrall: eyes completely clouded milky white without pupils, blank slack face, black veins spreading over the face and neck, a faint dark mist around the head',
}
STATES.update(DESIGNED_STATES)
STYLE = (
    '真人写实东方玄幻游戏的全身人物立绘，像高预算古装玄幻电视剧的真实演员定妆照。'
    '仅一位成年女性，身体正面对镜头，头顶至双脚完整入画，头顶与脚底都留少量边距，'
    '角色站在画面中央，人物占画面高度约90%，相机高度、透视及人物比例与参考一致。'
    '自然皮肤纹理，真实布料磨损和金属细节，左侧柔和暖红灯笼主光，右侧冷紫色轮廓光，'
    '低饱和、暗冷的电影调色，暗部仍能看清面部与衣料。85mm人像摄影质感。'
    '背景必须是完全均匀的纯亮绿色RGB(0,255,0)抠像底色，不含地面、不含投影、不含布纹或渐变；'
    '人物不能有绿色衣物或绿光反射。没有文字、标签、边框或UI。'
)
NEGATIVE = '动漫，二次元，绘画，插画，像素画，3D塑料皮肤，磨皮，拼图，多人，半身，裁脚，裁头，重复肢体，额外手指，背景场景，地面，阴影，文字，水印，透明棋盘格'

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')

def prepare():
    sources = {}
    for relative in ('tools/art/specs.py', 'tools/art/build_manifest.py', 'js/look.js', 'assets/STYLE.md'):
        path = GAME/relative
        sources[relative] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    # Parse literals only; never execute the production manifest builder.
    tree = ast.parse((GAME/'tools/art/specs.py').read_text())
    moods = next(ast.literal_eval(node.value) for node in tree.body
                 if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id=='MOODS' for t in node.targets))
    if any(moods.get(key)!=value for key,value in DESIGNED_STATES.items()):
        raise RuntimeError('Production MOODS changed; review designed variant definitions before generating')
    save_json(ROOT/'variant-design.json', {
        'production_sources': sources, 'production_moods': moods,
        'new_test_states': list(DESIGNED_STATES),
        'appearance_requirements': {
            'sly': ['scheming half-smile', 'narrowed calculating eyes'],
            'wasted': ['hollow cheeks', 'dark eye circles', 'sweat', 'trembling impression', 'sickly pale skin'],
            'thrall': ['milky white pupil-less eyes', 'blank slack face', 'black face and neck veins', 'faint dark head mist'],
        },
        'game_triggers': {
            'sly': 'c.noble, or explicitly selected mood',
            'wasted': 'p.addict >= 2 or p.health < 40',
            'thrall': 'p.controlled or p.soulBound; highest priority',
        },
        'method': 'Edit each existing experimental neutral identity directly, using production MOODS text and the production same-actor/same-costume constraint. Green screen replaces transparent-background instruction for local keying.',
    })
    (ROOT/'references').mkdir(parents=True, exist_ok=True)
    for key, role in ROLES.items():
        target = ROOT/'references'/f'{key}-style.png'
        if target.exists():
            continue
        frozen = DEFAULT_ROOT/'references'/f'{key}-style.png'
        if frozen.exists():
            with Image.open(frozen) as image:
                image.save(target)
            continue
        source = GAME/'art/raw/chars'/role['reference']
        with Image.open(source) as image:
            image = image.convert('RGBA')
            image.thumbnail((940, 1440), Image.Resampling.LANCZOS)
            canvas = Image.new('RGB', (1024,1536), (0,255,0))
            canvas.paste(image, ((1024-image.width)//2,1536-image.height-40), image)
            canvas.save(target)
    plan = {'status': 'isolated_test_not_integrated', 'model': MODEL,
            'created_on': '2026-11-15', 'characters': ROLES, 'states': STATES,
            'size': '1024*1536', 'watermark': False, 'prompt_extend': False,
            'negative_prompt': NEGATIVE, 'style_prompt': STYLE,
            'output_boundary': 'this experiment directory only',
            'designed_variants': 'variant-design.json; copied from game/tools/art/specs.py MOODS',
            'references_note': 'Frozen snapshots of existing generated artwork, style reference only. New identities, no production replacement.'}
    save_json(ROOT/'plan.json',plan)

def generate(role_key, state, reference_transport='local-file', generation_mode='edit'):
    role = ROLES[role_key]
    key = f'exp_{role_key}_{state}'
    out_dir = ROOT/'provider'/key
    marker = out_dir/'complete.json'
    if marker.exists():
        print('SKIP '+key, flush=True)
        return
    out_dir.mkdir(parents=True,exist_ok=True)
    # A persistent in-flight marker prevents duplicate billing after interruption.
    lock = out_dir/'in-flight.json'
    if lock.exists():
        raise RuntimeError(f'{key}: unresolved previous invocation; inspect before rerunning')
    if state == 'neutral':
        reference = ROOT/'references'/f'{role_key}-style.png'
        prompt = ('参考图仅用于匹配真人摄影风格、站立比例和打光。必须换成一位明显不同的成年女演员，'
                  '不要复制参考人物的脸或服装，设计一个全新的原创人物。'+role['description']+STATES[state]+STYLE)
        if generation_mode=='text':
            prompt=role['description']+STATES[state]+STYLE
    else:
        base = ROOT/'provider'/f'exp_{role_key}_neutral'/'complete.json'
        reference = ROOT/json.loads(base.read_text())['image_file']
        prompt = ('编辑这张参考图，只修改面部表情为：'+STATES[state]+
                  '必须是同一位成年女性，保留同一张脸、年龄、发型、发饰、衣服、道具、身体站姿、'
                  '手部动作、相机、构图、人物大小和光线。不要改变身份、服饰或肢体。背景保持原来的纯亮绿色。'+STYLE)
        if state in DESIGNED_STATES:
            prompt = ('Same actor, same costume, same framing, same camera angle and lighting, same style. '
                      'Only change this: the facial expression and state: '+DESIGNED_STATES[state]+'. '
                      'Keep the same uniform bright green background. '
                      '这张图是同一位成年女性的游戏状态变体，按上述要求改变面部和颈部状态，'
                      '保留可辨识的五官骨架、年龄、发型、发饰、衣服、道具、手部动作和完整全身站姿。'+STYLE)
    seed = 115010+(0 if role_key=='qiuzhuan' else 10)+list(STATES).index(state)
    reference_arg=str(reference)
    if reference_transport=='data-url':
        with Image.open(reference) as image:
            image=image.convert('RGB')
            image.thumbnail((512,768),Image.Resampling.LANCZOS)
            buffer=io.BytesIO()
            image.save(buffer,'JPEG',quality=82)
            reference_arg='data:image/jpeg;base64,'+base64.b64encode(buffer.getvalue()).decode('ascii')
        if len(reference_arg)>120000:
            raise RuntimeError('Reference exceeds safe command argument size')
    cmd = ['bl','image','edit','--model',MODEL,'--image',reference_arg,
           '--prompt',prompt,'--negative-prompt',NEGATIVE,'--size','1024*1536',
           '--seed',str(seed),'--n','1','--prompt-extend','false','--watermark','false',
           '--out-dir',str(out_dir),'--out-prefix',key,'--output','json','--timeout','240']
    if generation_mode=='text':
        if state!='neutral':
            raise RuntimeError('Text-only mode is for neutral style tests, not identity-preserving variants')
        cmd[2]='generate'
        index=cmd.index('--image')
        del cmd[index:index+2]
    # CLI 2.9.0 Token Plan preset endpoint; per-command only, no profile mutation.
    # At this endpoint the CLI embeds local image data instead of using OSS upload.
    endpoint=None
    if os.environ.get('DASHSCOPE_API_KEY','').startswith('sk-sp-'):
        endpoint='https://token-plan.cn-beijing.maas.aliyuncs.com'
        cmd += ['--base-url',endpoint]
    save_json(out_dir/'request.json', {'model':MODEL,'prompt':prompt,'negative_prompt':NEGATIVE,
              'reference':str(reference.relative_to(ROOT)),'reference_transport':reference_transport,
              'endpoint_override':endpoint,'generation_mode':generation_mode,
              'designed_variant_source': 'game/tools/art/specs.py:MOODS' if state in DESIGNED_STATES else None,
              'reference_sha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
              'size':'1024*1536','seed':seed,
              'n':1,'prompt_extend':False,'watermark':False})
    save_json(lock,{'started_at':datetime.now(timezone.utc).isoformat(),'asset_id':key})
    env = os.environ.copy()
    env.update(BAILIAN_CALLER_TYPE='script',BAILIAN_CALLER_NAME='codex',NO_COLOR='1')
    env.pop('BAILIAN_SKILL_NAME',None)
    env.pop('BAILIAN_SKILL_VERSION',None)
    print('START '+key,flush=True)
    result = subprocess.run(cmd,env=env,text=True,capture_output=True,timeout=300)
    # CLI output is retained inside the experiment for diagnosis, never printed wholesale.
    (out_dir/'response.json').write_text(result.stdout)
    (out_dir/'cli.stderr.log').write_text(result.stderr)
    if result.returncode:
        save_json(out_dir/'failure.json',{'exit_code':result.returncode,'review_required':True})
        print(f'FAILED {key}: CLI exit {result.returncode}; inspect experiment log',flush=True)
        raise RuntimeError(key+' generation failed; no automatic retry')
    candidates = sorted(p for p in out_dir.iterdir() if p.suffix.lower() in ('.png','.jpg','.jpeg','.webp'))
    if len(candidates)!=1:
        raise RuntimeError(f'{key}: expected one downloaded image, got {len(candidates)}')
    image_file=candidates[0]
    with Image.open(image_file) as image:
        image.verify()
    save_json(marker,{'asset_id':key,'image_file':str(image_file.relative_to(ROOT)),
                     'model':MODEL,'seed':seed,'sha256':hashlib.sha256(image_file.read_bytes()).hexdigest()})
    lock.unlink()
    print('DONE '+key,flush=True)

def preview():
    entries=[]
    (ROOT/'cutouts').mkdir(exist_ok=True)
    for role in ROLES:
        for state in STATES:
            key=f'exp_{role}_{state}'
            marker=ROOT/'provider'/key/'complete.json'
            if not marker.exists():
                continue
            record=json.loads(marker.read_text())
            with Image.open(ROOT/record['image_file']) as image:
                image=image.convert('RGBA')
            r,g,b,original_alpha=image.split()
            other=ImageChops.lighter(r,b)
            dominance=ImageChops.subtract(g,other)
            # Saturated green key, partial edge coverage; no production postprocessor used.
            alpha=dominance.point(lambda v:round((1-min(1,max(0,(v-25)/85)))*255))
            edge=alpha.point(lambda v:255 if v<254 else 0)
            green=Image.composite(ImageChops.darker(g,other),g,edge)
            image=Image.merge('RGBA',(r,green,b,ImageChops.darker(original_alpha,alpha)))
            box=image.getchannel('A').point(lambda v:255 if v>12 else 0).getbbox()
            if not box:
                raise RuntimeError('Empty cutout '+key)
            image=image.crop(box)
            image=image.resize((round(image.width*1300/image.height),1300),Image.Resampling.LANCZOS)
            target=ROOT/'cutouts'/f'{key}.webp'
            image.save(target,'WEBP',quality=90,method=6)
            hist=image.getchannel('A').histogram()
            area=image.width*image.height
            entries.append({**record,'role':role,'name':ROLES[role]['name'],'state':state,
                'cutout':str(target.relative_to(ROOT)),'width':image.width,'height':image.height,
                'alpha_zero_fraction':round(hist[0]/area,4),
                'alpha_opaque_fraction':round(hist[255]/area,4),
                'cutout_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
                'processing':'Green-screen key, edge green suppression, alpha trim, height 1300; experimental cutout, not integrated.'})
    save_json(ROOT/'manifest.json',{'model':MODEL,'status':'isolated_test_not_integrated','images':entries})
    if not entries:
        return
    for columns, full_name, face_name in [
            (list(STATES), 'contact-sheet.jpg', 'faces.jpg'),
            (['neutral', *DESIGNED_STATES], 'designed-variants.jpg', 'designed-faces.jpg')]:
        for face_only in [False, True]:
            w,h=(330,340) if face_only else (330,550)
            sheet=Image.new('RGB',(w*len(columns),h*len(ROLES)),(39,29,44))
            draw=ImageDraw.Draw(sheet)
            for entry in entries:
                if entry['state'] not in columns:
                    continue
                with Image.open(ROOT/entry['cutout']) as source:
                    image=source.convert('RGBA')
                if face_only:
                    image=image.crop((0,0,image.width,round(image.height*.29)))
                image.thumbnail((w-20,h-38))
                x=columns.index(entry['state'])*w;y=list(ROLES).index(entry['role'])*h
                sheet.paste(image,(x+(w-image.width)//2,y+8),image)
                draw.text((x+10,y+h-24),entry['asset_id'],fill=(245,220,180))
            sheet.save(ROOT/(face_name if face_only else full_name),quality=92)
    print(f'PREVIEW {len(entries)} isolated images',flush=True)

def main():
    global ROOT, MODEL
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare',action='store_true')
    parser.add_argument('--generate',choices=['bases','variants','all'])
    parser.add_argument('--role',choices=list(ROLES))
    parser.add_argument('--states',nargs='+',choices=list(STATES),help='Generate only the selected existing variant types')
    parser.add_argument('--jobs',type=int,default=2)
    parser.add_argument('--reference-transport',choices=['local-file','data-url'],default='local-file')
    parser.add_argument('--generation-mode',choices=['edit','text'],default='edit')
    parser.add_argument('--preview',action='store_true')
    parser.add_argument('--model',choices=['qwen-image-3.0','qwen-image-3.0-pro'],default=MODEL)
    parser.add_argument('--experiment',help='Sibling experiment directory name; production paths are forbidden')
    args=parser.parse_args()
    MODEL=args.model
    if args.experiment:
        if args.experiment in ('.','..') or Path(args.experiment).name!=args.experiment:
            parser.error('--experiment must be a single directory name')
        ROOT=DEFAULT_ROOT.parent/args.experiment
    if args.prepare:
        prepare()
    roles=[args.role] if args.role else list(ROLES)
    states=args.states if args.states else list(STATES)
    if args.generate in ('bases','all'):
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            list(pool.map(lambda role:generate(role,'neutral',args.reference_transport,args.generation_mode),roles))
    if args.generate in ('variants','all'):
        jobs=[(role,state) for role in roles for state in states if state!='neutral']
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            list(pool.map(lambda job:generate(*job,args.reference_transport),jobs))
    if args.preview:
        preview()

if __name__=='__main__':
    main()
