#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信公众号推文爬取管线 —— 把「大川飞桨领航团」的推文原文完整抓下来。

用法（在项目根目录执行）：
  # 1) 把链接写进 links.txt（每行一个），或直接命令行传入
  python scripts/fetch_wechat_posts.py --links links.txt
  python scripts/fetch_wechat_posts.py --url https://mp.weixin.qq.com/s/xxxx

  # 2) 只抓文字、跳过图片下载
  python scripts/fetch_wechat_posts.py --links links.txt --no-images

  # 3) 预演，不写文件
  python scripts/fetch_wechat_posts.py --links links.txt --dry-run

产出：
  content/posts/<slug>.md          —— 帖子（front matter 遵守 PROJECT.md §2.5，用 postKind）
  static/images/posts/<slug>/*     —— 正文图片（本地化，正文用 pic shortcode 引用，见 PROJECT.md §2.10）
  .wechat_cache/<slug>.html        —— 原始 HTML 存档（便于复查，可 gitignore）
"""

from __future__ import annotations

import argparse
import hashlib
import html as html_mod
import json
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path

try:
    import urllib.request as urlreq
except ImportError:  # pragma: no cover
    raise

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "content" / "posts"
IMAGES_DIR = ROOT / "static" / "images" / "posts"
CACHE_DIR = ROOT / ".wechat_cache"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------- HTTP

def http_get(url: str, *, binary: bool = False, referer: str | None = None, retries: int = 3):
    """带重试的 GET。binary=True 返回 bytes，否则返回解码后的 str。"""
    last_err = None
    for attempt in range(retries):
        try:
            req = urlreq.Request(url, headers={"User-Agent": UA})
            if referer:
                req.add_header("Referer", referer)
            with urlreq.urlopen(req, timeout=30) as resp:
                raw = resp.read()
            return raw if binary else raw.decode("utf-8", errors="replace")
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"请求失败: {url} ({last_err})")


# ---------------------------------------------------------------- 解析

JS_VAR_RE = re.compile(r"var\s+{name}\s*=\s*(['\"])(.*?)\1", re.S)
TAG_RE = re.compile(r"<[^>]+>")


def _js_var(page: str, name: str) -> str | None:
    """取 JS 变量值；同时兼容 htmlDecode("...") 包裹的写法。"""
    m = re.search(r"var\s+" + re.escape(name) + r"\s*=\s*(['\"])(.*?)\1", page, re.S)
    if m:
        return html_mod.unescape(m.group(2)).strip()
    # var nickname = htmlDecode("大川飞桨领航团");
    m = re.search(
        r"var\s+" + re.escape(name) + r"\s*=\s*htmlDecode\(\s*(['\"])(.*?)\1\s*\)",
        page, re.S,
    )
    if m:
        return html_mod.unescape(m.group(2)).strip()
    return None


def parse_article(page: str) -> dict:
    """从微信文章 HTML 抽取标题/作者/日期/公众号/正文节点序列。"""
    # 标题
    title = _js_var(page, "msg_title")
    if not title:
        m = re.search(r'property="og:title"\s+content="([^"]*)"', page)
        title = html_mod.unescape(m.group(1)) if m else ""
    if not title:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
        title = TAG_RE.sub("", m.group(1)).strip() if m else "未命名"

    # 公众号
    account = _js_var(page, "nickname") or _js_var(page, "nick_name") or ""
    # 作者
    author = _js_var(page, "author") or _js_var(page, "msg_author") or ""
    # 发布时间
    ts = _js_var(page, "ct") or _js_var(page, "create_time") or ""
    date = ""
    if ts and ts.isdigit():
        date = time.strftime("%Y-%m-%d", time.localtime(int(ts)))
    if not date:
        m = re.search(r'var\s+ct\s*=\s*"(\d+)"', page)
        if m:
            date = time.strftime("%Y-%m-%d", time.localtime(int(m.group(1))))

    body = extract_body_blocks(page)

    return {
        "title": title.strip(),
        "account": account.strip(),
        "author": author.strip(),
        "date": date,
        "blocks": body,
        "biz": (_js_var(page, "biz") or ""),
    }


def _slice_content(page: str) -> str:
    """截取 #js_content 正文区域（跳过容器标签本身，避免残留标签属性文本）。"""
    start = page.find('id="js_content"')
    if start < 0:
        start = page.find('id="js_article"')
    if start < 0:
        return page
    # 从该标签的结束尖括号之后开始，避免把 style/visibility 等属性当正文
    tag_end = page.find(">", start)
    if tag_end > 0:
        start = tag_end + 1

    tail_markers = [
        'id="js_tags"',
        'id="js_article_bottom_bar"',
        'class="rich_media_area_extra"',
        'id="js_pc_qr_code"',
        'id="js_sg_bar"',
        'id="js_article_comment"',
        'id="js_small_video_player"',
        '<script',
        'id="js_article_comment_area"',
    ]
    end = len(page)
    for marker in tail_markers:
        idx = page.find(marker, start)
        if idx > 0:
            end = min(end, idx)
    chunk = page[start:end]

    # 兜底：正文结束处若残留脚本/样式，一并裁掉
    for cut in ("<script", "<style", "var first_sceen__time", "预览时标签不可点"):
        idx = chunk.find(cut)
        if idx > 0:
            chunk = chunk[:idx]
    return chunk


TEXT_TAGS = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "td", "section"}


def extract_body_blocks(page: str) -> list[dict]:
    """按文档顺序抽取正文块：段落 / 标题 / 图片 / 列表。"""
    content = _slice_content(page)
    blocks = _scan_text_run(content, [])
    blocks = _denoise(blocks)
    return blocks


def _scan_text_run(content: str, seed: list[dict]) -> list[dict]:
    """基于标签切分，逐段取纯文本；保留段落边界与图片顺序。"""
    out: list[dict] = []
    pos = 0
    pattern = re.compile(
        r"<img\b[^>]*?(?:data-src|src)=\"(?P<src>[^\"]+)\"[^>]*>"
        r"|</?(?P<tag>h[1-6]|p|li|blockquote|section|br)\b[^>]*>",
        re.I,
    )
    cur_tag = "p"
    for m in pattern.finditer(content):
        chunk = content[pos: m.start()]
        pos = m.end()
        text = _clean_text(chunk)
        if text:
            out.append({"type": cur_tag, "text": text})
        if m.group("src"):
            url = html_mod.unescape(m.group("src"))
            if url.startswith("//"):
                url = "https:" + url
            if url.startswith("http"):
                out.append({"type": "image", "src": url})
            cur_tag = "p"
        elif m.group("tag"):
            tag = m.group("tag").lower()
            if tag.startswith("/"):
                cur_tag = "p"
            elif tag == "br":
                pass
            elif tag in {"h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"}:
                cur_tag = tag
            else:
                cur_tag = "p"
    tail = _clean_text(content[pos:])
    if tail:
        out.append({"type": cur_tag, "text": tail})
    return out


def _clean_text(chunk: str) -> str:
    if not chunk:
        return ""
    text = TAG_RE.sub("", chunk)
    text = html_mod.unescape(text)
    text = text.replace("\u200b", "").replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return text.strip()


NOISE_PATTERNS = [
    re.compile(r"^微信扫一扫"),
    re.compile(r"^关注该公众号"),
    re.compile(r"^继续滑动看下一个"),
    re.compile(r"^轻触阅读原文"),
    re.compile(r"^预览时标签不可点$"),
    re.compile(r"^向上滑动看下一个$"),
    re.compile(r"^不喜欢$"),
    # JS / CSS 残留
    re.compile(r"^var\s+\w+\s*="),
    re.compile(r"^document\.(getElementById|addEventListener)"),
    re.compile(r"^if\s*\(\s*[\"']?\d[\"']?\s*=="),
    re.compile(r"^}\s*$"),
    re.compile(r"^e\.preventDefault\(\)"),
    re.compile(r"^<"),
]


def _looks_like_code(text: str) -> bool:
    """判断是否像 JS/CSS 代码行。"""
    if not text:
        return True
    if text.count("{") + text.count("}") >= 2:
        return True
    if re.search(r"\b(function|document\.|window\.|addEventListener|preventDefault)\b", text):
        return True
    if re.match(r"^[\s{}(),;=+\-*/&|!<>\"'.:\[\]]+$", text):
        return True
    return False


def _denoise(blocks: list[dict]) -> list[dict]:
    out = []
    for b in blocks:
        if b["type"] == "image":
            out.append(b)
            continue
        text = b.get("text", "")
        if any(p.search(text) for p in NOISE_PATTERNS):
            continue
        if _looks_like_code(text):
            continue
        out.append(b)
    # 去掉连续重复段落
    dedup = []
    for b in out:
        if dedup and b.get("text") and dedup[-1].get("text") == b.get("text"):
            continue
        dedup.append(b)
    # 相邻重复图片去重（微信长图懒加载会把同一 URL 重复输出）
    final = []
    for b in dedup:
        if (
            b["type"] == "image"
            and final
            and final[-1]["type"] == "image"
            and final[-1]["src"] == b["src"]
        ):
            continue
        final.append(b)
    return final


# ---------------------------------------------------------------- 图片

EXT_BY_CT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


def analyze_image(data: bytes) -> dict:
    """用 Pillow 分析图片：返回 {edge_ratio, colors, w, h}。
    edge_ratio：相邻像素差异比例；颜色数：降采样后的不同颜色数。
    装饰图（波浪/边框/几何形）两者都极低；照片边缘密集；二维码颜色少但边缘密集。"""
    from io import BytesIO

    from PIL import Image

    info = {"edge_ratio": 1.0, "colors": 1 << 30, "w": 0, "h": 0}
    try:
        im = Image.open(BytesIO(data))
        info["w"], info["h"] = im.size
        im = im.convert("RGB")
        im.thumbnail((160, 160))
        px = list(im.getdata())
        info["colors"] = len(set(px))
        w, h = im.size
        edges = 0
        total = 0
        for y in range(h):
            row = y * w
            for x in range(w):
                if x + 1 < w:
                    a, b = px[row + x], px[row + x + 1]
                    if sum(abs(a[i] - b[i]) for i in range(3)) > 60:
                        edges += 1
                    total += 1
                if y + 1 < h:
                    a, b = px[row + x], px[row + x + w]
                    if sum(abs(a[i] - b[i]) for i in range(3)) > 60:
                        edges += 1
                    total += 1
        info["edge_ratio"] = edges / total if total else 0.0
    except Exception:  # noqa: BLE001
        pass
    return info


def is_decorative(info: dict) -> bool:
    """装饰图判定：边缘稀疏且颜色单调（阈值偏保守，避免误伤二维码/截图）。"""
    return info["edge_ratio"] < 0.02 and info["colors"] < 64


def download_images(
    images: list[str], slug: str, referer: str, dry: bool, prune_decor: bool = False
) -> tuple[dict[str, str], list[str]]:
    """下载图片到 static/images/posts/<slug>/。
    返回 ({原始URL: 站点相对路径}, [被判定为装饰图而丢弃的URL])。"""
    mapping: dict[str, str] = {}
    dropped: list[str] = []
    if dry or not images:
        return mapping, dropped
    target = IMAGES_DIR / slug
    target.mkdir(parents=True, exist_ok=True)
    idx = 0
    for url in images:
        try:
            req = urlreq.Request(url, headers={"User-Agent": UA, "Referer": referer})
            with urlreq.urlopen(req, timeout=30) as resp:
                data = resp.read()
                ct = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
        except Exception as exc:  # noqa: BLE001
            print(f"    [warn] 图片下载失败: {exc}")
            continue
        info = analyze_image(data) if prune_decor else None
        if info is not None and is_decorative(info):
            dropped.append(url)
            print(
                f"    [decor] 丢弃装饰图 "
                f"{info['w']}x{info['h']} colors={info['colors']} edge={info['edge_ratio']:.4f}"
            )
            continue
        idx += 1
        ext = EXT_BY_CT.get(ct) or os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".jpg"
        name = f"{idx:02d}-{hashlib.md5(url.encode()).hexdigest()[:8]}{ext}"
        (target / name).write_bytes(data)
        mapping[url] = f"/images/posts/{slug}/{name}"
        print(f"    [img] {name}  ({len(data) // 1024} KB)")
    return mapping, dropped


# ---------------------------------------------------------------- 渲染

def slugify(title: str, explicit: str | None = None) -> str:
    if explicit:
        return explicit
    # 中文标题无法直接做 slug，用拼音无关的短哈希 + 时间占位由调用方覆盖
    return "wx-" + hashlib.md5(title.encode("utf-8")).hexdigest()[:10]


def render_markdown(meta: dict, img_map: dict[str, str]) -> str:
    blocks = meta["blocks"]
    lines: list[str] = []

    for b in blocks:
        if b["type"] == "image":
            path = img_map.get(b["src"], b["src"])
            alt = meta["title"]
            # 用 pic shortcode（§2.10）：TrimPrefix + relURL 自动带 baseURL 前缀，避免子路径 404
            lines.append(f'{{{{< pic src="{path}" alt="{alt}" >}}}}')
            continue
        text = b.get("text", "").strip()
        if not text:
            continue
        tag = b["type"]
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            level = int(tag[1])
            # 微信正文里的“小标题”多为视觉加粗，降级映射到 ## / ###
            level = max(2, min(level + 1, 4))
            lines.append("#" * level + " " + text)
        else:
            lines.append(text)
        lines.append("")

    body = "\n".join(lines).strip()
    body = re.sub(r"\n{3,}", "\n\n", body)

    fm = ["---"]
    fm.append(f"title: {json.dumps(meta['title'], ensure_ascii=False)}")
    if meta.get("date"):
        fm.append(f"date: {meta['date']}")
    fm.append('postKind: "event"')
    summary = meta.get("author") or meta["title"]
    fm.append(f"summary: {json.dumps(summary, ensure_ascii=False)}")
    fm.append(f"slug: {json.dumps(meta['slug'], ensure_ascii=False)}")
    fm.append("---")
    fm.append("")

    source = ["", "---", "", "原文："]
    if meta.get("account"):
        source.append(f"- 公众号：{meta['account']}")
    if meta.get("url"):
        source.append(f"- [阅读原文]({meta['url']})")

    return "\n".join(fm) + body + "\n" + "\n".join(source) + "\n"


# ---------------------------------------------------------------- 主流程

def process(url: str, *, slug: str | None = None, kind: str = "event",
            images: bool = True, dry: bool = False, summary: str | None = None,
            prune_decor: bool = False) -> Path | None:
    print(f"\n=== 处理：{url}")
    page = http_get(url)
    print(f"    HTML {len(page) // 1024} KB")

    meta = parse_article(page)
    if not meta["date"]:
        # 有些页面用 datetime 属性
        m = re.search(r'id="publish_time"[^>]*>([\d-]+)', page)
        if m:
            meta["date"] = m.group(1)
    print(f"    标题：{meta['title']}")
    print(f"    公众号：{meta['account'] or '?'}  日期：{meta['date'] or '?'}")

    meta["url"] = url
    meta["slug"] = slugify(meta["title"], slug)

    # 图片 URL 去重（保持首现顺序；同一 URL 只下载一次）
    seen: set[str] = set()
    imgs = []
    for b in meta["blocks"]:
        if b["type"] == "image" and b["src"] not in seen:
            seen.add(b["src"])
            imgs.append(b["src"])
    print(f"    正文块 {len(meta['blocks'])}，图片 {len(imgs)}（去重后）")

    if not dry:
        CACHE_DIR.mkdir(exist_ok=True)
        (CACHE_DIR / f"{meta['slug']}.html").write_text(page, encoding="utf-8")

    img_map, dropped = (
        download_images(imgs, meta["slug"], url, dry, prune_decor)
        if (images and imgs) else ({}, [])
    )
    if dropped:
        kept = [b for b in meta["blocks"] if not (b["type"] == "image" and b["src"] in dropped)]
        print(f"    [decor] 共丢弃 {len(dropped)} 张装饰图")
        meta["blocks"] = kept

    body_blocks = [b for b in meta["blocks"] if b["type"] != "image"]
    if len(body_blocks) < 3:
        print("    [warn] 正文段落过少，可能被反爬或页面结构变化，请人工核对缓存 HTML")

    md = render_markdown(meta, img_map)
    if summary:
        md = re.sub(r"^summary: .*$", f"summary: {json.dumps(summary, ensure_ascii=False)}", md, flags=re.M)
    md = md.replace('postKind: "event"', f'postKind: "{kind}"', 1)

    out = POSTS_DIR / f"{meta['slug']}.md"
    if dry:
        print("    [dry-run] 预览前 900 字：")
        print("    " + md[:900].replace("\n", "\n    "))
        return out

    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    print(f"    [ok] 写入 {out.relative_to(ROOT)}  ({len(md)} 字符)")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="爬取微信公众号推文为 Hugo 帖子")
    ap.add_argument("--url", action="append", default=[], help="文章链接，可重复")
    ap.add_argument("--links", help="链接清单文件（每行一个，# 开头为注释）")
    ap.add_argument("--slug", action="append", default=[], help="与 --url 一一对应的 slug")
    ap.add_argument("--kind", default="event", choices=["event", "project"], help="帖子类型")
    ap.add_argument("--no-images", action="store_true", help="跳过图片下载")
    ap.add_argument("--prune-decor", action="store_true",
                    help="丢弃装饰图（波浪/边框等纯图形；照片与二维码不受影响）")
    ap.add_argument("--dry-run", action="store_true", help="只预演不写文件")
    args = ap.parse_args()

    urls = list(args.url)
    if args.links:
        for line in Path(args.links).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    if not urls:
        ap.error("请至少提供一个 --url 或 --links")

    ok = 0
    for i, url in enumerate(urls):
        slug = args.slug[i] if i < len(args.slug) else None
        try:
            if process(url, slug=slug, kind=args.kind, images=not args.no_images,
                       dry=args.dry_run, prune_decor=args.prune_decor):
                ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    [error] {exc}")
        time.sleep(1.0)

    print(f"\n完成：成功 {ok}/{len(urls)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
