#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按「站点图 -> 原版#序号」映射表渲染大图校验表，供最终目检。

输入映射 JSON 结构：
{
  "thangka-workshop-review": [
    {"site": "06-f3432b3f.jpg", "orig": "9.21唐卡修复#13", "alts": ["9.21唐卡修复#12"]},
    ...
  ],
  ...
}

「文件夹#序号」与 make_review_sheet.py dir 模式的编号一致（同目录按文件名排序）。
产出: .wechat_cache/verify-<slug>.png（每行 = 站点图 | 选定原版 | 备选...）
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def find_repo_root(start: Path) -> Path:
    """向上找到含 src/content/posts 与 public/images/posts 的仓库根。

    脚本归档在 legacy/scripts/ 下，靠固定 parent 层级会在迁移后失效。
    """
    for d in (start, *start.parents):
        if (d / "src" / "content" / "posts").is_dir() and (d / "public" / "images" / "posts").is_dir():
            return d
    raise SystemExit("找不到仓库根（需同时含 src/content/posts 与 public/images/posts）")


ROOT = find_repo_root(Path(__file__).resolve().parent)
IMG_ROOT = ROOT / "public" / "images" / "posts"
CACHE = ROOT / ".wechat_cache"
POOL = Path("E:/GitHub/图片")

BG = (245, 246, 248)
CARD_BG = (255, 255, 255)
CARD_LINE = (222, 225, 229)
SITE_BG = (232, 240, 254)
SITE_LINE = (147, 179, 232)
TITLE_FG = (17, 24, 39)
NAME_FG = (11, 98, 208)
META_FG = (90, 95, 102)
PICK_FG = (16, 122, 66)
ALT_FG = (176, 68, 8)


def _font(size: int) -> ImageFont.FreeTypeFont:
    for c in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf"):
        p = Path(c)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()


def _thumb(path: Path, box: tuple[int, int]) -> Image.Image | None:
    try:
        with Image.open(path) as im:
            im = im.convert("RGBA")
            im.thumbnail(box, Image.LANCZOS)
            return im
    except Exception:  # noqa: BLE001
        return None


def _size_of(path: Path) -> str:
    try:
        with Image.open(path) as im:
            return f"{im.size[0]}x{im.size[1]}"
    except Exception:  # noqa: BLE001
        return "?"


def resolve(tag: str) -> Path:
    """'9.21唐卡修复#13' -> 该文件夹按文件名排序的第 13 个文件。

    排序必须与 match_originals.collect 一致（文件名字符串排序）。
    """
    folder_name, idx = tag.rsplit("#", 1)
    folder = POOL / folder_name
    files = sorted((p for p in folder.iterdir() if p.is_file()), key=lambda p: p.name)
    return files[int(idx) - 1]


def build(slug: str, rows: list[dict], out: Path, cell_w: int = 430,
          img_h: int = 330) -> int:
    f_hdr, f_name, f_meta = _font(22), _font(14), _font(13)
    pad = 10
    # 每行 = 一对（站点图 | 选定原版 [+ 备选...]），多对纵向排
    made = []
    batch = 3
    for bi in range(0, len(rows), batch):
        chunk = rows[bi:bi + batch]
        n_alt = max(len(r.get("alts", [])) for r in chunk)
        cols = 2 + n_alt
        width = pad + cols * (cell_w + pad)
        height = 58 + len(chunk) * (2 * img_h + 84) + pad
        canvas = Image.new("RGB", (width, height), BG)
        draw = ImageDraw.Draw(canvas)
        draw.text((pad, 12),
                  f"{slug}  行{bi + 1}-{bi + len(chunk)}/{len(rows)}   "
                  f"蓝底=站点图 / 绿框=选定原版 / 右侧=备选", font=f_hdr, fill=TITLE_FG)

        for ri, row in enumerate(chunk):
            y0 = 58 + ri * (2 * img_h + 84)
            cells = [(row["site"], IMG_ROOT / slug / row["site"], "site")]
            cells.append((row["orig"], resolve(row["orig"]), "pick"))
            for alt in row.get("alts", []):
                cells.append((alt, resolve(alt), "alt"))
            for ci, (label, path, kind) in enumerate(cells):
                x0 = pad + ci * (cell_w + pad)
                if kind == "site":
                    bg, line = SITE_BG, SITE_LINE
                elif kind == "pick":
                    bg, line = CARD_BG, (120, 190, 140)
                else:
                    bg, line = (250, 242, 232), (214, 176, 130)
                draw.rounded_rectangle([x0, y0, x0 + cell_w, y0 + img_h], radius=8,
                                       fill=bg, outline=line)
                im = _thumb(path, (cell_w - 12, img_h - 34))
                if im:
                    canvas.paste(im, (x0 + (cell_w - im.size[0]) // 2,
                                      y0 + 6 + (img_h - 34 - im.size[1]) // 2), im)
                fg = NAME_FG if kind != "alt" else ALT_FG
                prefix = "站点 " if kind == "site" else ("选 " if kind == "pick" else "备选 ")
                draw.text((x0 + 8, y0 + img_h - 26), f"{prefix}{label}  {_size_of(path)}",
                          font=f_name, fill=fg)

        out_i = out if len(rows) <= batch else out.with_name(
            f"{out.stem}-{bi // batch + 1}{out.suffix}")
        canvas.save(out_i, format="PNG", optimize=True)
        made.append(out_i)
        print(f"写出 {out_i}  ({width}x{height})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", required=True, help="映射 JSON 文件")
    ap.add_argument("--only", default=None, help="只处理指定 slug（逗号分隔）")
    args = ap.parse_args()

    data = json.loads(Path(args.map).read_text(encoding="utf-8"))
    slugs = args.only.split(",") if args.only else list(data)
    rc = 0
    for slug in slugs:
        rows = data.get(slug)
        if not rows:
            continue
        out = CACHE / f"verify-{slug}.png"
        rc |= build(slug, rows, out)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
