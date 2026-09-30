#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成图片联络表 PNG，用于人工目检判定装饰图。

用法:
    python scripts/make_contact_sheet.py --slug prompt-engineer-certification

产出:
    .wechat_cache/sheet-<slug>.png   # 可直接用图片查看器打开的图片墙

设计意图：微信推文里的装饰图（色块/叶子/波浪/灰底）用程序指标很难可靠判定，
实测 edge_ratio / colors 阈值全部失效。最可靠的做法是人工目检，但一张张
打开太慢，所以用 Pillow 拼成一张 PNG 图片墙，一次看完 20~30 张。

每格显示：缩略图 + 文件名 + 像素尺寸 + 宽高比 + edge/colors 指标。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG_ROOT = ROOT / "static" / "images" / "posts"
CACHE = ROOT / ".wechat_cache"

CELL_W, CELL_H = 260, 250      # 单元格尺寸
IMG_H = 180                    # 缩略图区高度
COLS = 6
PAD = 12
BG = (245, 246, 248)
CARD_BG = (255, 255, 255)
CARD_LINE = (222, 225, 229)
NAME_FG = (11, 98, 208)
META_FG = (90, 95, 102)
HDR_FG = (26, 26, 26)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """尽量找一个能显示中文的字体，找不到就退回 Pillow 默认位图字体。"""
    cands = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhl.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\consola.ttf",
    ]
    for c in cands:
        p = Path(c)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()


def analyze(path: Path) -> dict:
    """返回 {edge_ratio, colors, w, h}；损坏图返回 None 值。"""
    try:
        with Image.open(path) as im:
            w, h = im.size
            small = im.convert("RGB").resize((64, 64))
            px = list(small.getdata())
            diff = sum(
                1
                for i in range(1, len(px))
                if sum(abs(a - b) for a, b in zip(px[i], px[i - 1])) > 30
            )
            return {
                "edge_ratio": round(diff / (len(px) - 1), 3),
                "colors": len(set(px)),
                "w": w,
                "h": h,
            }
    except Exception as exc:  # noqa: BLE001
        return {"edge_ratio": None, "colors": None, "w": None, "h": None, "err": str(exc)}


def checkerboard(w: int, h: int, size: int = 8) -> Image.Image:
    """透明区域用的棋盘底。"""
    im = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, h, size):
        for x in range(0, w, size):
            if (x // size + y // size) % 2:
                d.rectangle([x, y, x + size - 1, y + size - 1], fill=(240, 241, 243))
    return im


def build(slug: str, out: Path, cols: int = COLS) -> int:
    src = IMG_ROOT / slug
    if not src.is_dir():
        print(f"目录不存在: {src}", file=sys.stderr)
        return 1
    files = sorted(p for p in src.iterdir() if p.is_file())
    if not files:
        print(f"没有找到图片: {src}", file=sys.stderr)
        return 1

    f_name = _font(13)
    f_meta = _font(12)
    f_hdr = _font(20, bold=True)

    rows = (len(files) + cols - 1) // cols
    width = PAD + cols * (CELL_W + PAD)
    header_h = 56
    height = header_h + PAD + rows * (CELL_H + PAD)

    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((PAD, 16), f"{slug}   ({len(files)} 张)", font=f_hdr, fill=HDR_FG)
    draw.text(
        (PAD, 40),
        "棋盘底＝透明区域 · 装饰图特征：纯色块 / 叶子 / 波浪 / 灰底单色，colors 通常 < 100",
        font=f_meta,
        fill=META_FG,
    )

    for idx, p in enumerate(files):
        c, r = idx % cols, idx // cols
        x0 = PAD + c * (CELL_W + PAD)
        y0 = header_h + PAD + r * (CELL_H + PAD)

        draw.rounded_rectangle(
            [x0, y0, x0 + CELL_W, y0 + CELL_H], radius=8, fill=CARD_BG, outline=CARD_LINE
        )

        info = analyze(p)
        # 缩略图区
        box_w, box_h = CELL_W - 16, IMG_H
        try:
            with Image.open(p) as im:
                im = im.convert("RGBA")
                im.thumbnail((box_w, box_h))
                tw, th = im.size
                board = checkerboard(tw, th)
                board.paste(im, (0, 0), im)
                canvas.paste(
                    board,
                    (x0 + (CELL_W - tw) // 2, y0 + 10 + (box_h - th) // 2),
                )
        except Exception as exc:  # noqa: BLE001
            draw.text((x0 + 12, y0 + 80), f"打开失败 {exc}", font=f_meta, fill=(200, 40, 40))

        # 文字区
        ty = y0 + 10 + box_h + 4
        name = p.name if len(p.name) <= 30 else p.name[:27] + "..."
        draw.text((x0 + 12, ty), name, font=f_name, fill=NAME_FG)
        dim = f"{info['w']}x{info['h']}  ar={info['w']/info['h']:.2f}" if info["w"] else "n/a"
        draw.text((x0 + 12, ty + 17), dim, font=f_meta, fill=META_FG)
        stat = f"edge={info['edge_ratio']}  colors={info['colors']}"
        draw.text((x0 + 12, ty + 32), stat, font=f_meta, fill=META_FG)

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG", optimize=True)
    print(f"写出 {out}  ({len(files)} 张图, {width}x{height})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--cols", type=int, default=COLS)
    args = ap.parse_args()
    CACHE.mkdir(exist_ok=True)
    out = Path(args.out) if args.out else CACHE / f"sheet-{args.slug}.png"
    return build(args.slug, out, cols=args.cols)


if __name__ == "__main__":
    raise SystemExit(main())
