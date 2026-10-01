#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「原版图库」图片墙与「站点图 × 候选原图」并排比对表，用于人工目检配对。

背景：站点图片取自微信图床（有压缩），原版图库文件名是无意义哈希串，
程序匹配（match_originals.py 的感知哈希）只能给出候选，最终必须目检确认。

用法:
    # 1) 列出某个原版文件夹的全部图片（带 #序号）
    python scripts/make_review_sheet.py dir --path "E:/GitHub/图片/9.21唐卡修复" --title "9.21唐卡修复"

    # 2) 并排比对：站点某篇的图 vs 全库候选（每行 1 张站点图 + 4 张候选）
    python scripts/make_review_sheet.py compare --slug thangka-workshop-review

产出:
    .wechat_cache/review-<name>.png
"""
from __future__ import annotations

import argparse
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

EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")

BG = (245, 246, 248)
CARD_BG = (255, 255, 255)
CARD_LINE = (222, 225, 229)
TITLE_FG = (17, 24, 39)
NAME_FG = (11, 98, 208)
META_FG = (90, 95, 102)
OK_FG = (16, 122, 66)
WARN_FG = (176, 68, 8)


def _font(size: int) -> ImageFont.FreeTypeFont:
    for c in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf",
              r"C:\Windows\Fonts\consola.ttf"):
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


# --------------------------------------------------------------- 模式：dir


def build_dir(folder: Path, title: str, out: Path, cols: int = 6) -> int:
    # 按文件名字符串排序（与 match_originals.collect 一致）
    files = sorted((p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in EXTS),
                   key=lambda p: p.name)
    if not files:
        print(f"目录内没有图片: {folder}", file=sys.stderr)
        return 1

    cell_w, cell_h, img_h, pad = 260, 232, 172, 12
    rows = (len(files) + cols - 1) // cols
    width = pad + cols * (cell_w + pad)
    height = 62 + rows * (cell_h + pad)

    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)
    f_hdr, f_name, f_meta = _font(22), _font(14), _font(12)
    draw.text((pad, 14), f"{title}   ({len(files)} 张)", font=f_hdr, fill=TITLE_FG)

    for i, p in enumerate(files):
        c, r = i % cols, i // cols
        x0, y0 = pad + c * (cell_w + pad), 62 + r * (cell_h + pad)
        draw.rounded_rectangle([x0, y0, x0 + cell_w, y0 + cell_h], radius=8,
                               fill=CARD_BG, outline=CARD_LINE)
        im = _thumb(p, (cell_w - 16, img_h))
        if im:
            canvas.paste(im, (x0 + (cell_w - im.size[0]) // 2,
                              y0 + 8 + (img_h - im.size[1]) // 2), im)
        draw.text((x0 + 10, y0 + img_h + 14), f"#{i + 1:02d}  {p.name[:13]}...",
                  font=f_name, fill=NAME_FG)
        draw.text((x0 + 10, y0 + img_h + 32), _size_of(p), font=f_meta, fill=META_FG)

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG", optimize=True)
    print(f"写出 {out}  ({len(files)} 张, {width}x{height})")
    return 0


# ----------------------------------------------------------- 模式：compare


def build_compare(slug: str, pool: Path, out: Path, top: int = 4,
                  batch: int = 8, threshold: float = 0.18) -> int:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from match_originals import collect, distance, features  # noqa: PLC0415

    src = IMG_ROOT / slug
    if not src.is_dir():
        print(f"站点目录不存在: {src}", file=sys.stderr)
        return 1
    sites = sorted(p for p in src.iterdir() if p.is_file() and p.suffix.lower() in EXTS)
    if not sites:
        print(f"站点目录内没有图片: {src}", file=sys.stderr)
        return 1

    print("提取原版特征 ...")
    originals = collect(pool)
    print(f"原版 {len(originals)} 张；站点 {len(sites)} 张")

    # 给每张原图算一个「文件夹#序号」，与 make_review_sheet.py dir 模式的编号对齐
    by_folder: dict[str, list] = {}
    for o in originals:
        by_folder.setdefault(Path(o["path"]).parent.name, []).append(o)
    for lst in by_folder.values():
        lst.sort(key=lambda o: o["path"])
    for lst in by_folder.values():
        for i, o in enumerate(lst):
            o["tag"] = f"{Path(o['path']).parent.name}#{i + 1:02d}"

    site_feats = []
    for p in sites:
        feat = features(p)
        if feat is None:
            print(f"[跳过] 无法读取: {p}", file=sys.stderr)
        site_feats.append(feat)
    pairs = [(p, f) for p, f in zip(sites, site_feats) if f is not None]
    sites = [p for p, _ in pairs]
    flat_sites = [f for _, f in pairs]

    rows_data = []
    for p, sf in zip(sites, flat_sites):
        scored = sorted(((distance(sf, o), o) for o in originals), key=lambda t: t[0])
        rows_data.append((p, sf, scored[:top], scored[0][0]))

    cell_w, cell_h, img_h, pad = 300, 300, 236, 10
    cols = top + 1
    f_hdr, f_name, f_meta = _font(22), _font(13), _font(12)

    made = []
    for bi in range(0, len(rows_data), batch):
        chunk = rows_data[bi:bi + batch]
        width = pad + cols * (cell_w + pad)
        height = 62 + len(chunk) * (cell_h + pad)
        canvas = Image.new("RGB", (width, height), BG)
        draw = ImageDraw.Draw(canvas)
        draw.text((pad, 14),
                  f"{slug}  行{bi + 1}-{bi + len(chunk)}/{len(rows_data)}  "
                  f"左1=站点图，右侧=候选原版（按感知哈希相似度排序）",
                  font=f_hdr, fill=TITLE_FG)

        for ri, (p, sf, cands, best) in enumerate(chunk):
            y0 = 62 + ri * (cell_h + pad)
            # 站点图
            x0 = pad
            draw.rounded_rectangle([x0, y0, x0 + cell_w, y0 + cell_h], radius=8,
                                   fill=(232, 240, 254), outline=(147, 179, 232))
            im = _thumb(p, (cell_w - 16, img_h))
            if im:
                canvas.paste(im, (x0 + (cell_w - im.size[0]) // 2,
                                  y0 + 8 + (img_h - im.size[1]) // 2), im)
            draw.text((x0 + 8, y0 + img_h + 14), f"站点 {p.name[:16]}", font=f_name, fill=NAME_FG)
            draw.text((x0 + 8, y0 + img_h + 30), f"{sf['w']}x{sf['h']}", font=f_meta, fill=META_FG)
            col = OK_FG if best <= threshold else WARN_FG
            draw.text((x0 + 8, y0 + img_h + 46), f"best d={best:.3f}", font=f_meta, fill=col)

            # 候选
            for ci, (d, o) in enumerate(cands):
                xx = pad + (ci + 1) * (cell_w + pad)
                draw.rounded_rectangle([xx, y0, xx + cell_w, y0 + cell_h], radius=8,
                                       fill=CARD_BG, outline=CARD_LINE)
                oim = _thumb(Path(o["path"]), (cell_w - 16, img_h))
                if oim:
                    canvas.paste(oim, (xx + (cell_w - oim.size[0]) // 2,
                                       y0 + 8 + (img_h - oim.size[1]) // 2), oim)
                draw.text((xx + 8, y0 + img_h + 14), f"{ci + 1}. {o.get('tag', '')[:16]}",
                          font=f_name, fill=NAME_FG)
                draw.text((xx + 8, y0 + img_h + 32), f"{o['w']}x{o['h']}",
                          font=f_meta, fill=META_FG)
                dcol = OK_FG if d <= threshold else META_FG
                draw.text((xx + 8, y0 + img_h + 46), f"d={d:.3f}", font=f_meta, fill=dcol)

        o = out if len(rows_data) <= batch else out.with_name(
            f"{out.stem}-{bi // batch + 1}{out.suffix}")
        canvas.save(o, format="PNG", optimize=True)
        made.append(o)
        print(f"写出 {o}  ({width}x{height})")

    for o in made:
        print(f"  file://{o}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="mode", required=True)

    d = sub.add_parser("dir", help="列出某目录的全部图片（带序号）")
    d.add_argument("--path", required=True)
    d.add_argument("--title", default="")
    d.add_argument("--cols", type=int, default=6)

    c = sub.add_parser("compare", help="站点图 × 候选原图 并排比对")
    c.add_argument("--slug", required=True)
    c.add_argument("--pool", default="E:/GitHub/图片")
    c.add_argument("--top", type=int, default=4)
    c.add_argument("--batch", type=int, default=8)
    c.add_argument("--threshold", type=float, default=0.18)

    args = ap.parse_args()
    CACHE.mkdir(exist_ok=True)

    if args.mode == "dir":
        folder = Path(args.path)
        if not folder.is_dir():
            print(f"目录不存在: {folder}", file=sys.stderr)
            return 1
        title = args.title or folder.name
        safe = folder.name.replace(".", "_").replace(" ", "_")
        return build_dir(folder, title, CACHE / f"review-{safe}.png", cols=args.cols)

    out = CACHE / f"review-{args.slug}.png"
    return build_compare(args.slug, Path(args.pool), out,
                         top=args.top, batch=args.batch, threshold=args.threshold)


if __name__ == "__main__":
    raise SystemExit(main())
