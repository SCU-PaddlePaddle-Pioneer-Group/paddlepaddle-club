#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把「原版照片」图库与站点图片做内容级配对。

站点图片取自微信图床（有压缩），原版是拍摄/导出原图，文件名是无意义哈希串，
因此只能靠图像内容比对建立对应关系。

方法（纯 Pillow，不依赖 numpy）：
  1. dHash 16x16：灰度缩放到 17x16，比较水平相邻像素，得到 255 位指纹。
     对亮度/对比度/轻微裁剪不敏感，适合识别"同一张照片的不同版本"。
  2. aHash 8x8：灰度均值阈值化，64 位，作为粗粒度补充。
  3. 颜色栅格 4x4：缩放到 4x4 取 RGB，描述整体色调分布，抗几何变形。
  4. 宽高比差异：原图可能有裁剪，作为惩罚项而非硬过滤。

距离 = 0.55*dHash + 0.25*aHash + 0.20*color，再乘宽高比惩罚。
低于 --threshold 视为可信匹配，否则标记为 UNMATCHED 供人工确认。

用法：
  python scripts/match_originals.py                 # 打印匹配表
  python scripts/match_originals.py --json out.json # 同时导出结果
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def find_repo_root(start: Path) -> Path:
    """向上找到含 src/content/posts 与 public/images/posts 的仓库根。

    脚本归档在 legacy/scripts/ 下，靠固定 parent 层级会在迁移后失效。
    """
    for d in (start, *start.parents):
        if (d / "src" / "content" / "posts").is_dir() and (d / "public" / "images" / "posts").is_dir():
            return d
    raise SystemExit("找不到仓库根（需同时含 src/content/posts 与 public/images/posts）")


# ---------------------------------------------------------------- 特征提取


def _flat(img: Image.Image) -> Image.Image:
    """统一转成 RGB（PNG 透明区域铺白底，避免透明像素干扰比对）。"""
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        bg.alpha_composite(img)
        return bg.convert("RGB")
    return img.convert("RGB")


def dhash(img: Image.Image, size: int = 16) -> list[int]:
    """差值哈希：16x16 -> 255 位。返回 0/1 列表。"""
    g = _flat(img).convert("L").resize((size + 1, size), Image.LANCZOS)
    px = list(g.getdata())
    bits = []
    for y in range(size):
        row = px[y * (size + 1):(y + 1) * (size + 1)]
        for x in range(size):
            bits.append(1 if row[x] > row[x + 1] else 0)
    return bits


def ahash(img: Image.Image, size: int = 8) -> list[int]:
    """均值哈希：8x8 -> 64 位。"""
    g = _flat(img).convert("L").resize((size, size), Image.LANCZOS)
    px = list(g.getdata())
    avg = sum(px) / len(px)
    return [1 if v > avg else 0 for v in px]


def color_grid(img: Image.Image, n: int = 4) -> list[int]:
    """颜色栅格：n*n 的平均 RGB，共 n*n*3 个分量。"""
    small = _flat(img).resize((n, n), Image.LANCZOS)
    return list(small.getdata())  # [(r,g,b), ...] -> 展平


def features(path: Path) -> dict | None:
    try:
        with Image.open(path) as im:
            im.load()
            w, h = im.size
            return {
                "path": str(path),
                "w": w,
                "h": h,
                "ratio": w / h if h else 0,
                "dhash": dhash(im),
                "ahash": ahash(im),
                "color": color_grid(im),
            }
    except Exception as e:  # 损坏或非图片
        print(f"  [跳过] {path.name}: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------- 距离计算


def hamming(a: list[int], b: list[int]) -> float:
    """归一化汉明距离 0~1。"""
    if len(a) != len(b):
        return 1.0
    return sum(x != y for x, y in zip(a, b)) / len(a)


def color_distance(a: list[int], b: list[int]) -> float:
    """颜色栅格的归一化 L1 距离 0~1。"""
    if len(a) != len(b):
        return 1.0
    total = sum(abs(x - y) for pa, pb in zip(a, b) for x, y in zip(pa, pb))
    return total / (len(a) * 3 * 255)


def distance(site: dict, orig: dict) -> float:
    d = 0.55 * hamming(site["dhash"], orig["dhash"])
    d += 0.25 * hamming(site["ahash"], orig["ahash"])
    d += 0.20 * color_distance(site["color"], orig["color"])
    # 宽高比惩罚：差异 10% 以内不罚，之后线性加重
    ra, rb = site["ratio"], orig["ratio"]
    if ra and rb:
        rel = abs(ra - rb) / max(ra, rb)
        d *= 1.0 + max(0.0, rel - 0.10) * 1.5
    return d


# ---------------------------------------------------------------- 主流程


def collect(root: Path) -> list[dict]:
    out = []
    # 注意：必须按文件名字符串排序。Path 对象排序与字符串排序在大小写上
    # 不一致，曾导致「文件夹#序号」标签错位。
    files = sorted((f for f in root.rglob("*") if f.is_file()
                    and f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif")),
                   key=lambda p: p.name)
    for f in files:
        feat = features(f)
        if feat:
            out.append(feat)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-dir", default=None,
                    help="站点图片根目录（默认自动定位仓库的 public/images/posts）")
    ap.add_argument("--origin-dir", default="E:/GitHub/图片", help="原版图库根目录")
    ap.add_argument("--threshold", type=float, default=0.18,
                    help="可信匹配的距离上限（越小越严）")
    ap.add_argument("--json", help="把匹配结果导出为 JSON")
    args = ap.parse_args()

    site_root = (Path(args.site_dir) if args.site_dir
                 else find_repo_root(Path(__file__).resolve().parent) / "public" / "images" / "posts")
    orig_root = Path(args.origin_dir)
    if not site_root.is_dir():
        print(f"站点图片目录不存在: {site_root}", file=sys.stderr)
        return 1
    if not orig_root.is_dir():
        print(f"原版图库目录不存在: {orig_root}", file=sys.stderr)
        return 1

    print("扫描原版图库 ...")
    originals = collect(orig_root)
    print(f"原版 {len(originals)} 张\n")

    print("扫描站点图片 ...")
    sites = collect(site_root)
    print(f"站点 {len(sites)} 张\n")

    results = []
    used: dict[str, int] = {}
    for s in sites:
        rel = Path(s["path"]).relative_to(site_root)
        scored = sorted(((distance(s, o), o) for o in originals), key=lambda t: t[0])
        best_score, best = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else 1.0
        status = "OK" if best_score <= args.threshold else "REVIEW"
        results.append({
            "site_rel": str(rel).replace("\\", "/"),
            "site_path": s["path"],
            "site_size": f'{s["w"]}x{s["h"]}',
            "orig_path": best["path"],
            "orig_name": Path(best["path"]).name,
            "orig_folder": Path(best["path"]).parent.name,
            "orig_size": f'{best["w"]}x{best["h"]}',
            "score": round(best_score, 4),
            "margin": round(second_score - best_score, 4),
            "status": status,
        })
        used[best["path"]] = used.get(best["path"], 0) + 1

    # 输出
    width = max(len(r["site_rel"]) for r in results) if results else 10
    for r in results:
        flag = "  " if r["status"] == "OK" else "!!"
        print(f'{flag} {r["site_rel"]:<{width}}  {r["site_size"]:>11}  ->  '
              f'{r["orig_folder"][:14]:<14} {r["orig_size"]:>11}  '
              f'd={r["score"]:.3f} margin={r["margin"]:.3f}')

    print()
    ok = sum(1 for r in results if r["status"] == "OK")
    print(f"可信 {ok}/{len(results)}，需人工确认 {len(results) - ok}")
    dup = {Path(k).name: v for k, v in used.items() if v > 1}
    if dup:
        print(f"\n注意：{len(dup)} 张原图被多张站点图匹配（可能是相似画面）：")
        for name, cnt in sorted(dup.items(), key=lambda t: -t[1]):
            print(f"  x{cnt}  {name}")

    if args.json:
        Path(args.json).write_text(
            json.dumps({"threshold": args.threshold, "matches": results},
                       ensure_ascii=False, indent=2),
            encoding="utf-8")
        print(f"\n已导出 {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
