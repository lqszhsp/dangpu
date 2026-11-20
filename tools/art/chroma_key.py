#!/usr/bin/env python3
"""抠纯色幕布：让模型把背景画成一整片纯绿（或纯品红），再按“这一色压过另外两色多少”算透明度，边缘去溢色。
gpt-image 画“透明底”时常给假的灰白格子、或一整片纯黑，抠图会把黑发、深色衣裳一并挖掉；纯色幕布抠起来稳。
用法：python3 tools/art/chroma_key.py <原图.png> [...] [--key green|magenta] [--despill]（--despill：已抠好的只补去溢色）
原图就地改成带透明的 PNG（postprocess 见到已有透明度就原样收下）。"""
import sys
from PIL import Image, ImageChops


def key_out(im, key='green'):
    im = im.convert('RGBA')
    r, g, b, _ = im.split()
    if key == 'green':
        other = ImageChops.lighter(r, b)
        dom = ImageChops.subtract(g, other)
    else:
        other = g
        dom = ImageChops.subtract(ImageChops.darker(r, b), g)
    # 幕布色压过另两色 18 以内的算人物，压过 83 以上的算幕布，中间渐变
    alpha = dom.point(lambda v: round((1 - min(1, max(0, (v - 18) / 65))) * 255))
    return Image.merge('RGBA', (*despill(r, g, b, key), alpha))


def despill(r, g, b, key='green'):
    """去溢色：整个人物上，幕布那一色都压回另两色的水平。
    纱、薄袖是半透明的，幕布透过来，不止边缘泛绿；绿幕只用在衣裳不是绿的人身上，所以整张压不伤本色"""
    if key == 'green':
        return r, ImageChops.darker(g, ImageChops.lighter(r, b)), b
    # 品红幕：红、蓝同时高出绿的那一截就是溢色，两色一起减掉
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    return ImageChops.subtract(r, excess), g, ImageChops.subtract(b, excess)


if __name__ == '__main__':
    args = sys.argv[1:]
    key = 'green'
    if '--key' in args:
        i = args.index('--key'); key = args[i + 1]; del args[i:i + 2]
    only_despill = '--despill' in args
    if only_despill: args.remove('--despill')
    for p in args:
        im = Image.open(p)
        if only_despill:
            # 已经抠好的图：只补一遍去溢色（透明度不动）
            r, g, b, a = im.convert('RGBA').split()
            Image.merge('RGBA', (*despill(r, g, b, key), a)).save(p)
            print('despilled', p, key)
        elif im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 250:
            # 已经抠过的（有透明了）：再抠一遍会把抠掉的地方当成黑底、整张变不透明
            print('skip (already keyed)', p)
        else:
            key_out(im, key).save(p)
            print('keyed', p, key)
