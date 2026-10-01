# 公众号推文爬取管线

把微信公众号推文**完整原文**抓下来，清洗成站点帖子。用于把「大川飞桨领航团」等公众号的内容搬到本站。

> 站点已从 Hugo 重构为 **React + Vite**，脚本随旧管线归档在本目录（`legacy/scripts/`）。
> 产出的内容与图片直接服务当前结构：帖子 `src/content/posts/<slug>.md`、图片 `public/images/posts/<slug>/`。
> 下面命令中的路径均按此为准。

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
python legacy/scripts/fetch_wechat_posts.py --links links.txt

# 方式二：命令行直接传
python legacy/scripts/fetch_wechat_posts.py --url https://mp.weixin.qq.com/s/xxxx

# 指定 slug（与 --url 顺序一一对应）
python legacy/scripts/fetch_wechat_posts.py --links links.txt \
  --slug founding-ai-lecture --slug medical-imaging-contest

# 只抓文字、不下载图片
python legacy/scripts/fetch_wechat_posts.py --links links.txt --no-images

# 预演：不写任何文件，只看抓取效果
python legacy/scripts/fetch_wechat_posts.py --links links.txt --dry-run

# 标记为项目帖（默认 event）
python legacy/scripts/fetch_wechat_posts.py --links links.txt --kind project
```

## 产出

| 路径 | 说明 |
| --- | --- |
| `src/content/posts/<slug>.md` | 帖子正文，front matter 遵守 PROJECT.md §2.5（用 `postKind`） |
| `public/images/posts/<slug>/` | 正文图片，本地化后按顺序编号 |
| `.wechat_cache/<slug>.html` | 原始 HTML 存档，便于复查（已 gitignore） |

## 图片目检：装饰图判定

微信推文里混有大量纯装饰图（色块/叶子/波浪/灰底/图标）。程序指标（边缘密度、颜色数）实测无法可靠区分，所以用「联络表」一次目检全部图片：

```bash
# 生成 .wechat_cache/sheet-<slug>.png 图片墙（缩略图+尺寸+指标），人工判定
python legacy/scripts/make_contact_sheet.py --slug prompt-engineer-certification
```

判定原则（与 recruitment-2026 一致）：

- **保留**：现场照片、证书/海报/长图、数据图表、二维码（含群码）。
- **剔除**：色块、叶子/星星/蝴蝶插画、波浪线条、渐变底图、列表小图标、结尾社徽。

判定后同时做两件事：markdown 里删掉对应 `![](...)` 引用；`public/images/posts/<slug>/` 里删掉对应文件，保持引用与磁盘一致。

## 原版照片替换（高清化）

微信图床对上传图片做二次有损压缩，分辨率下降且带压缩噪点，页面上看会「发糊」。拿到拍摄原图后可换回原版。

**难点**：原版素材文件名是无意义哈希串（`a1b2c3...jpeg`），无法靠文件名配对；原版还可能有裁剪，尺寸也不一致。因此只能靠**图像内容比对**。

```bash
# 1. 感知哈希配对（dHash 16x16 + aHash + 颜色栅格 + 宽高比惩罚），输出候选项
python legacy/scripts/match_originals.py --json .wechat_cache/match.json

# 2. 目检候选（dHash 对平坦画面不敏感，会出假阳性，必须看）
python legacy/scripts/make_review_sheet.py dir --path E:/GitHub/图片/9.21唐卡修复   # 图库图片墙（带 文件夹#序号）
python legacy/scripts/make_review_sheet.py compare --slug thangka-workshop-review    # 站点图 × 候选原图 并排

# 3. 把确认后的映射写成 JSON，渲染成大图校验表做最终确认
python legacy/scripts/make_verify_sheet.py --map .wechat_cache/replace-map.json

# 4. 执行替换（先 --dry-run 预演）
python legacy/scripts/apply_original_photos.py --map .wechat_cache/replace-map.json --dry-run
python legacy/scripts/apply_original_photos.py --map .wechat_cache/replace-map.json
```

映射 JSON 结构（`文件夹#序号` 与 `make_review_sheet.py dir` 的编号一致，同目录按**文件名字符串**排序）：

```json
{
  thangka-workshop-review: [
    {site: 06-f3432b3f.jpg, orig: 9.21唐卡修复#13, alts: [9.21唐卡修复#12]}
  ]
}
```

替换规则：

- 原版是 JPEG 而站点图是 `.png` → 写成同名 `.jpg` 并同步更新 md 引用（避免 png 扩展名配 JPEG 内容）。
- 原版字节**原样复制**，不缩放、不重压缩。
- 结束后自动校验 md 引用 ↔ 磁盘文件，有悬空引用则报错退出。

> **判定提示**：若某张原版的分辨率并不高于站点图（微信端没压缩、或原图本身就小），
> 只要内容一致通常仍值得替换——原版更干净、无二次压缩噪点。但必须**目检确认**，不能只看像素数。
> 同一张原图可能对应多篇帖子里的不同尺寸版本（如招新篇的缩略图与会员篇的大图），这是正常的。

## 抓取质量说明

- **保留**：正文全部段落、原文段落顺序、图片插入位置、小标题层级。
- **过滤**：微信页脚的「关注该公众号」「预览时标签不可点」等 UI 文案，以及尾部残留的 JS 代码。
- **图片**：下载到本地，正文改用站点相对路径引用，不依赖微信图床（微信图床有防盗链，远程引用在页面上会加载失败）。
- **日期**：从页面 `ct` 变量解析发布时间。

## 注意事项

- 抓取后请**人工核对**一遍正文，尤其是图片顺序与长图表的可读性。
- 脚本默认每次请求间隔 1 秒，避免给微信服务器造成压力。
- 微信可能调整页面结构；若正文块数量异常偏少，脚本会告警，此时请检查 `.wechat_cache/` 里的原始 HTML。
