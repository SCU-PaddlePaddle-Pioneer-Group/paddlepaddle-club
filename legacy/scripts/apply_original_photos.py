#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「原版照片」按目检确认的映射替换到 public/images/posts/。

映射来源：.wechat_cache/replace-map.json（人工逐对目检确认）。
规则：
  - 原文件是 .jpg 且原版是 .jpeg -> 直接覆盖原文件名（内容同为 JPEG）。
  - 原文件是 .png 而原版是 JPEG -> 复制为同名 .jpg，更新 md 引用，删除旧 .png
    （GitHub Pages 按扩展名给 Content-Type，png 扩展名配 JPEG 内容不规范）。
  - 原版保持原始字节，不做缩放/重压缩（用户要求用原版，保证清晰度）。

用法:
    python scripts/apply_original_photos.py --map .wechat_cache/replace-map.json --dry-run
    python scripts/apply_original_photos.py --map .wechat_cache/replace-map.json
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

def _find_repo_root(start: Path) -> Path:
    """向上找到含 src/content/posts 与 public/images/posts 的仓库根。

    脚本归档在 legacy/scripts/ 下，不能靠固定的 parent 层级，否则迁移即失效。
    """
    for d in (start, *start.parents):
        if (d / "src" / "content" / "posts").is_dir() and (d / "public" / "images" / "posts").is_dir():
            return d
    raise SystemExit("找不到仓库根（需同时含 src/content/posts 与 public/images/posts）")


ROOT = _find_repo_root(Path(__file__).resolve().parent)
IMG_ROOT = ROOT / "public" / "images" / "posts"
CONTENT = ROOT / "src" / "content" / "posts"
POOL = Path("E:/GitHub/图片")


def resolve(tag: str) -> Path:
    """'9.21唐卡修复#13' -> 文件（按文件名字符串排序，与目检脚本一致）。"""
    folder_name, idx = tag.rsplit("#", 1)
    files = sorted((p for p in (POOL / folder_name).iterdir() if p.is_file()),
                   key=lambda p: p.name)
    return files[int(idx) - 1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(Path(args.map).read_text(encoding="utf-8"))
    md_updates: list[tuple[Path, str, str]] = []  # (md, old_ref, new_ref)

    for slug, rows in data.items():
        dest_dir = IMG_ROOT / slug
        for row in rows:
            site = row["site"]
            orig = resolve(row["orig"])
            dest = dest_dir / site
            old_ext = dest.suffix.lower()
            new_ext = ".jpg" if orig.suffix.lower() in (".jpg", ".jpeg") else orig.suffix.lower()
            new_dest = dest.with_suffix(new_ext)

            print(f"{slug}/{site}  <-  {row['orig']}  ({orig.stat().st_size // 1024}KB)")
            if old_ext != new_ext:
                print(f"    扩展名变更 {old_ext} -> {new_ext}，需更新 md 引用")

            if args.dry_run:
                continue

            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(orig, new_dest)
            if old_ext != new_ext and dest.exists():
                dest.unlink()

            if old_ext != new_ext:
                # 更新该篇 md 中的引用（含 alt 文本在内的整段路径）
                md_path = CONTENT / f"{slug}.md"
                text = md_path.read_text(encoding="utf-8")
                old_ref = f"images/posts/{slug}/{site}"
                new_ref = f"images/posts/{slug}/{new_dest.name}"
                if old_ref in text:
                    text = text.replace(old_ref, new_ref)
                    md_path.write_text(text, encoding="utf-8")
                    md_updates.append((md_path, old_ref, new_ref))
                else:
                    print(f"    !! md 中未找到引用: {old_ref}")

    # 一致性校验：md 引用 vs 磁盘
    print("\n=== 校验 md 引用与磁盘文件 ===")
    ok = True
    for md_path in sorted(CONTENT.glob("*.md")):
        text = md_path.read_text(encoding="utf-8")
        refs = set(re.findall(r"images/posts/([a-z0-9-]+)/([A-Za-z0-9._-]+)", text))
        disk = {p.name for p in (IMG_ROOT / md_path.stem).iterdir()}
        ref_names = {r[1] for r in refs if r[0] == md_path.stem}
        dangling = ref_names - disk
        unused = disk - ref_names
        status = "OK" if not dangling else "DANGLING"
        if dangling:
            ok = False
        print(f"{md_path.name}: 引用{len(ref_names)} 磁盘{len(disk)} {status}"
              + (f"  悬空:{dangling}" if dangling else "")
              + (f"  未引用:{unused}" if unused else ""))
    if not args.dry_run:
        print(f"\nmd 引用更新 {len(md_updates)} 处")
    print("全部一致" if ok else "存在问题，勿提交")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
