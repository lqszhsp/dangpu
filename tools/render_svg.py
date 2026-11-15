#!/usr/bin/env python3
"""把 SVG 资产渲染成 PNG 预览，用于离线检查画面（依赖系统 librsvg 的 GI 绑定与 Pillow）。

用法：
  python3 game/tools/render_svg.py game/assets/items --out /tmp/preview --scale 2
  python3 game/tools/render_svg.py game/assets/chars --sheet /tmp/chars.png
"""
import argparse
import io
import math
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

import gi
from PIL import Image, ImageDraw, ImageFont

gi.require_version("Rsvg", "2.0")
from gi.repository import Rsvg  # noqa: E402

BG = (31, 23, 36, 255)
FONT = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"


def collect(paths):
    files = []
    for p in map(Path, paths):
        files += sorted(p.glob("*.svg")) if p.is_dir() else [p]
    return files


def rasterize(path, scale=1.0):
    """按 viewBox 尺寸 × scale 渲染，返回 RGBA 的 PIL 图像。"""
    text = Path(path).read_text(encoding="utf-8")
    root = ET.fromstring(text)  # 先做 XML 合法性检查，报错更易读
    _, _, w, h = map(float, root.get("viewBox").replace(",", " ").split())
    W, H = max(1, round(w * scale)), max(1, round(h * scale))
    # 用显式宽高替换根节点尺寸，让 librsvg 按目标像素渲染
    text = re.sub(r"<svg\b", f'<svg width="{W}" height="{H}"', text, count=1)
    text = re.sub(r'(<svg[^>]*?)\s(width|height)="[^"]*"(?=[^>]*\s\2=)', r"\1", text, count=2)
    handle = Rsvg.Handle.new_from_data(text.encode("utf-8"))
    pixbuf = handle.get_pixbuf()
    ok, buf = pixbuf.save_to_bufferv("png", [], [])
    return Image.open(io.BytesIO(buf)).convert("RGBA")


def on_bg(img):
    bg = Image.new("RGBA", img.size, BG)
    bg.alpha_composite(img)
    return bg


def render_sheet(files, out, cell):
    cols = max(1, math.ceil(math.sqrt(len(files))))
    rows = math.ceil(len(files) / cols)
    label_h = 20
    sheet = Image.new("RGBA", (cols * cell, rows * (cell + label_h)), BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(FONT, 12)
    for i, f in enumerate(files):
        cx, cy = (i % cols) * cell, (i // cols) * (cell + label_h)
        img = rasterize(f, 4)
        img.thumbnail((cell - 8, cell - 8))
        sheet.alpha_composite(img, (cx + (cell - img.width) // 2, cy + (cell - img.height) // 2))
        draw.text((cx + 4, cy + cell + 2), f.stem, fill=(230, 215, 180), font=font)
    sheet.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--out", help="逐个输出 PNG 的目录")
    ap.add_argument("--sheet", help="输出联系表 PNG 路径")
    ap.add_argument("--cell", type=int, default=200)
    ap.add_argument("--scale", type=float, default=1.0)
    args = ap.parse_args()
    files = collect(args.paths)
    failed = 0
    if args.out:
        out_dir = Path(args.out)
        out_dir.mkdir(parents=True, exist_ok=True)
    for f in files:
        try:
            img = rasterize(f, args.scale)
            if args.out:
                on_bg(img).save(out_dir / (f.stem + ".png"))
                print(out_dir / (f.stem + ".png"))
        except Exception as e:  # 单个失败不影响其余
            failed += 1
            print(f"FAIL {f}: {e}", file=sys.stderr)
    if args.sheet and not failed:
        print(render_sheet(files, Path(args.sheet), args.cell))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
