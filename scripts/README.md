# 公众号推文爬取管线

把微信公众号推文**完整原文**抓下来，清洗成 Hugo 帖子。用于把「大川飞桨领航团」等公众号的内容搬到本站。

## 为什么需要手动给链接

微信公众号的历史文章列表在微信生态里是闭合的，没有官方公开 API：

| 路径 | 可行性 |
| --- | --- |
| 直连单篇文章 `mp.weixin.qq.com/s/xxx` | ✅ 可抓完整 HTML 原文 |
| 微信图床 `mmbiz.qpic.cn` 图片 | ✅ 可下载（需带 Referer） |
| 搜狗微信的账号文章列表 | ⚠️ 收录极少，且跳转被 antispider 拦截 |
| 微信 `profile_ext` 历史文章接口 | ❌ 需客户端凭证（pass_ticket） |

所以流程是：**你提供文章链接 → 脚本批量抓取**。

## 用法

```bash
# 方式一：把链接写进 links.txt（每行一个，# 为注释）
python scripts/fetch_wechat_posts.py --links links.txt

# 方式二：命令行直接传
python scripts/fetch_wechat_posts.py --url https://mp.weixin.qq.com/s/xxxx

# 指定 slug（与 --url 顺序一一对应）
python scripts/fetch_wechat_posts.py --links links.txt \
  --slug founding-ai-lecture --slug medical-imaging-contest

# 只抓文字、不下载图片
python scripts/fetch_wechat_posts.py --links links.txt --no-images

# 预演：不写任何文件，只看抓取效果
python scripts/fetch_wechat_posts.py --links links.txt --dry-run

# 标记为项目帖（默认 event）
python scripts/fetch_wechat_posts.py --links links.txt --kind project
```

## 产出

| 路径 | 说明 |
| --- | --- |
| `content/posts/<slug>.md` | 帖子正文，front matter 遵守 PROJECT.md §2.5（用 `postKind`） |
| `static/images/posts/<slug>/` | 正文图片，本地化后按顺序编号 |
| `.wechat_cache/<slug>.html` | 原始 HTML 存档，便于复查（已 gitignore） |

## 图片目检：装饰图判定

微信推文里混有大量纯装饰图（色块/叶子/波浪/灰底/图标）。程序指标（边缘密度、颜色数）实测无法可靠区分，所以用「联络表」一次目检全部图片：

```bash
# 生成 .wechat_cache/sheet-<slug>.png 图片墙（缩略图+尺寸+指标），人工判定
python scripts/make_contact_sheet.py --slug prompt-engineer-certification
```

判定原则（与 recruitment-2026 一致）：

- **保留**：现场照片、证书/海报/长图、数据图表、二维码（含群码）。
- **剔除**：色块、叶子/星星/蝴蝶插画、波浪线条、渐变底图、列表小图标、结尾社徽。

判定后同时做两件事：markdown 里删掉对应 `![](...)` 引用；`static/images/posts/<slug>/` 里删掉对应文件，保持引用与磁盘一致。

## 抓取质量说明

- **保留**：正文全部段落、原文段落顺序、图片插入位置、小标题层级。
- **过滤**：微信页脚的「关注该公众号」「预览时标签不可点」等 UI 文案，以及尾部残留的 JS 代码。
- **图片**：下载到本地，正文改用站点相对路径引用，不依赖微信图床（微信图床有防盗链，远程引用在页面上会加载失败）。
- **日期**：从页面 `ct` 变量解析发布时间。

## 注意事项

- 抓取后请**人工核对**一遍正文，尤其是图片顺序与长图表的可读性。
- 脚本默认每次请求间隔 1 秒，避免给微信服务器造成压力。
- 微信可能调整页面结构；若正文块数量异常偏少，脚本会告警，此时请检查 `.wechat_cache/` 里的原始 HTML。
