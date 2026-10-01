# DESIGN.md — 四川大学飞桨领航团官网 · 设计与工程契约

> 本文件是全站重构的**唯一事实源**。所有页面、组件、样式、内容迁移都必须遵守本契约。
> 技术栈：React 18 + TypeScript + Vite + Tailwind CSS 3.4 + shadcn/ui + react-router（HashRouter）+ markdown-it。

---

## 0. 设计方向：「川大蓝 · 编辑风」

旧站问题（已被否决的方向，禁止回退）：近黑深蓝底 + 荧光绿 #cbff45 + 青 #5ce1e6 的“黑客霓虹”风，与团徽气质冲突；卡片套卡片；占位数据「—」；首屏 ∞ 符号与社团无关。

新方向三条铁律：

1. **品牌诚实**：主色必须取自团徽蓝 `#0C519F`，白底纸面质感。社团是川大 + 百度的学生技术社区，气质是“开放、认真、年轻”，不是赛博朋克。
2. **编辑风版式**：学报纸/杂志的排版秩序——发丝线分隔、左对齐不对称网格、区块题头三行式、水印大字、大量留白。**禁止**卡片套卡片、禁止渐变、禁止玻璃拟态、禁止圆角泛滥（radius 0.375rem）。
3. **克制的动效**：只有 hover 微交互（下划线滑动、箭头位移、图片灰度还原）与平滑锚点滚动。禁止滚动触发淡入、禁止视差、禁止 loading 花哨动画。

## 1. 设计令牌（已在 `src/index.css` 实现，直接用，不要重复定义）

| 语义 | 值 | Tailwind 用法 | 用途 |
| --- | --- | --- | --- |
| paper | `#FAF9F5` | `bg-background` | 页面底色 |
| foreground | `#101C28` | `text-foreground` | 主文字（墨蓝） |
| primary | `#0C519F` | `bg-primary` / `text-primary` | 团徽蓝 · 品牌主色 |
| primary-deep | `#083B76` | `hover:bg-[hsl(var(--primary-deep))]` | 主色 hover |
| accent | `#E4572E` | `bg-accent` / `text-accent` | 信号橙 · 唯一强调色，克制使用 |
| ink | `#0A2540` | `bg-[hsl(var(--ink))]` | 深海军蓝平涂色域（部门区/页脚/CTA） |
| secondary | `#E7EDF2` | `bg-secondary` | 冷灰蓝次级表面 |
| muted-foreground | `#5C6B7A` | `text-muted-foreground` | 次要文字 |
| border | `#D8E0E7` | `border-border` | 发丝线 |

字体（`index.html` 已引入 Google Fonts；中文回退系统字体栈，已在 CSS 变量中配置）：

- 显示字体：`font-display`（Archivo + 中文系统栈）。标题 `font-extrabold/black`，`tracking-[-0.02em]`。
- 等宽字体：`font-mono`（IBM Plex Mono）。用于序号、日期、标签、按钮旁注。
- **中文绝不使用斜体**；强调用字重/颜色。

已实现的组件类（在 `index.css` 的 `@layer components`，直接用）：

- 布局：`container-x`（max-w-1280, px-6/10）
- 题头三行式：`section-eyebrow`（自带橙色短杠）+ `section-title` + `section-desc`
- 水印大字：`watermark`（描边空心）/ `watermark-solid`（淡填充），绝对定位、`aria-hidden`
- 按钮：`btn-primary`（蓝底胶囊，自带箭头位移）/ `btn-outline` / `btn-accent` / `btn-ghost-on-ink`（深底用）
- 标签：`tag-event`（橙框活动）/ `tag-project`（蓝框项目）
- 动态行：`post-row`（发丝线行。移动端两行式：日期|标签|箭头在上、标题通栏在下；≥md 单行四列 130px/110px/1fr/40px。子元素顺序固定为 日期→标签→标题→箭头，hover 背景微染 + 标题变蓝 + 箭头位移）
- 链接：`link-slide`（下划线滑动；当前项加 `is-active`）
- 色域：`field-ink` / `field-blue`
- 数据：`stat-value` + `stat-label`
- 帖子正文：`post-body`（markdown 容器，h2 带橙色短杠、figure/figcaption、引用、代码全部已定）
- 图片：`img-toned`（微灰度，hover 还原彩色）

## 2. 页面映射（HashRouter，已在 `src/App.tsx` 配置）

| 路由 | 页面 | 文件 | 归属 |
| --- | --- | --- | --- |
| `/` | 首页 | `src/pages/Home.tsx` | A |
| `/posts` | 动态列表（筛选：全部/活动/项目） | `src/pages/Posts.tsx` | B |
| `/posts/:slug` | 帖子详情 | `src/pages/PostDetail.tsx` | B |
| `/about` | 社团文化 | `src/pages/About.tsx` | A |
| `*` | 404 | `src/pages/NotFound.tsx` | A |
| 布局 | 页头/页脚 | `src/components/layout/Header.tsx` `Footer.tsx` | A |

- 站内锚点：`/#about` `/#departments` `/#feed` `/#join`（App.tsx 的 ScrollManager 已处理滚动）。
- 页头导航：首页 `/` · 社团动态 `/posts` · 关于社团 `/about` · 加入我们 `/#join`（`btn-primary` 胶囊）。
- 页头：sticky + `bg-background/85 backdrop-blur` + 底部发丝线；左侧团徽（`asset('images/logo.png')`，32px）+ 名称两行（`font-display font-bold` 中文名 + `font-mono text-[10px] tracking-[0.2em]` 英文名）；移动端汉堡菜单（可用 shadcn `Sheet`）。
- 页脚：`field-ink` 深底，大号社团全称「四川大学百度飞桨领航团」+ 链接列（GitHub 组织 / 招新 QQ 群 1098392715 / 公众号「大川飞桨领航团」）+ 底部 `font-mono` 小字 `© {year} SCU PaddlePaddle Pioneer Group`。

## 3. 首页区块（A 实现，顺序固定）

1. **Hero**（id `top`）：左 7 列文案（`section-eyebrow` 写 `SICHUAN UNIVERSITY · EST. 2025` → H1 两行：「让想法跑起来」/「让学习真正发生」（第二行 `text-primary`），H1 用 `text-[clamp(2.6rem,6.2vw,5.2rem)] font-extrabold leading-[1.08]` → `CLUB.heroLede` → 按钮组：`btn-primary`「查看社团动态」→`/#feed`，`btn-outline`「了解社团」→`/about`）；右 5 列视觉：大团徽（约 380px，`asset('images/logo.png')`），背后平涂几何（一个 `border-2 border-primary/15` 的大圆环或偏移的 `bg-secondary` 方块 + 一枚 `bg-accent` 小圆点做点缀，平涂、无渐变）。区块右下或左下放 `watermark`「PADDLE」。
2. **关于我们**（id `about`）：题头三行式（`01 — 关于我们` / `CLUB.manifesto` 可作 desc 或独立 lead）。manifesto 段落下方放**全宽数据带**：`STATS` 四格（`grid-cols-2 md:grid-cols-4 divide-x divide-border border border-border`，每格 `stat-value` + `stat-label`）。（`CLUB.flow` 六环节仍在 club.ts 保留，由 `/about` 页面使用。）
3. **三大部门**（id `departments`）：`field-ink` 深色平涂色域整区。题头 `02 — 三大部门`（深底上 eyebrow 文字用白色 60%）。三列（`md:grid-cols-3`，列间 `divide-x divide-white/10`）：每列 `DEPARTMENTS` 的 index（`font-mono text-white/40`）+ 中文名大字 + nameEn 等宽小字 + intro + points 列表（marker 用橙色）。水印「JOIN US」描边白 8%。
4. **社团动态预览**（id `feed`）：题头 `03 — 社团动态` + 右侧「查看全部动态 →」（`/posts`，`link-slide`）。用 `getAllPosts().slice(0, 5)` 渲染 `post-row` 列表：mono 日期（YYYY.MM.DD）+ `tag-event/tag-project` + 标题 + `→`。每行整行是 `<Link to={/posts/slug}>`。
5. **加入我们**（id `join`）：`field-blue` 平涂蓝色域。左：大标题 `JOIN.title`（白色，`clamp(2rem,4vw,3.4rem)`）+ `JOIN.desc`（白 80%）。右：信息块——`JOIN.qqNote` + 群号（`font-mono text-3xl`）、`JOIN.wechatNote` + 「大川飞桨领航团」、GitHub 按钮 `btn-ghost-on-ink`。底部可放一条真实活动照片横带（3 张，`img-toned`，`aspect-[4/3] object-cover`，从 §5 清单选不同活动的）。

## 4. 关于页 / 404（A 实现）

- **About**：题头 `关于社团`。首段大字宣言（`CLUB.manifesto`，`text-[clamp(1.3rem,2.4vw,1.9rem)] leading-relaxed font-medium`）；「我们相信」区块（内容见 `legacy/content/about/_index.md`：从基础出发 / 用项目学习 / 在协作中成长 / 把成果留下来，四列发丝线分隔，每列小标题 + 一句话）；「参与方式」指向 `/#join`。页面底部水印「CULTURE」。
- **404**：大号 `font-mono` 描边空心「404」（`text-[clamp(6rem,16vw,12rem)]`，`color:transparent; -webkit-text-stroke:2px hsl(var(--primary))`）+「页面走丢了」+ `btn-primary` 回首页 + `btn-outline` 看动态。

## 5. 内容与数据契约（B 实现）

### 5.1 数据层 `src/lib/posts.ts`（替换整个文件，签名不可变）

```ts
export type PostKind = 'project' | 'event'
export interface PostMeta { title: string; slug: string; date: string; postKind: PostKind; summary: string }
export interface Post extends PostMeta { html: string }
export function getAllPosts(): PostMeta[]        // 按 date 倒序
export function getPost(slug: string): Post | undefined
```

实现要求：用 Vite `import.meta.glob('@/content/posts/*.md', { query: '?raw', import: 'default', eager: true })` 在构建期读取；自写 20 行内的 front matter 解析（`---` 包裹的 YAML 子集：`key: value`，值可能有引号）；正文用 `markdown-it`（`html: true, linkify: true`）渲染为 HTML 字符串。`postKind` 只可能是 `event`/`project`，非法值按 `event` 处理。

### 5.2 内容迁移 `legacy/content/posts/*.md` → `src/content/posts/*.md`

共 6 篇（文件名与 slug 不变）：`annual-report-2025` `dream-recreation-talk` `member-recruitment-2026` `prompt-engineer-certification` `recruitment-2026` `thangka-workshop-review`。

迁移规则（每篇都要人工过一遍，不是机械替换）：

1. front matter 保留 `title/date/postKind/summary/slug` 五字段，其余删除。
2. `{{< pic src="/images/posts/<slug>/<file>" alt="..." >}}` → 标准 markdown 图片：`![alt](images/posts/<slug>/<file>)`（**去掉前导 `/`**，相对路径）。
3. 清理抓取残留：正文中紧跟图片后、与 alt 重复的独立说明行删除（图注由渲染层从 alt 生成，见 5.3）；开头零散的标题断行（如「聚力 AI\n\n青春启航」这种从公众号版式里掉出来的碎片）合并或删除；文末 `\- END -`、`编辑 | xxx`、`文案丨xxx`、`配图丨xxx` 等署名行统一收敛为一段 blockquote：保留「编辑/文案/配图」信息（有的话）+ 原有的「原文：公众号…[阅读原文](url)」。
4. 正文其余内容（标题、段落、列表）保持原样，不要改写事实。

### 5.3 帖子图片渲染（markdown-it 自定义 image renderer）

`![alt](src)` 渲染为 `<figure><img src="..." alt="..." loading="lazy" class="img-toned"><figcaption>alt</figcaption></figure>`（alt 为空时不输出 figcaption）。图片 src 已是相对路径 `images/...`，直接可用（HashRouter 下文档基址始终是 index.html 所在目录）。

### 5.4 动态列表页 `/posts`

题头 `社团动态` + desc。筛选用三个文字按钮（全部 / 活动 / 项目）：`font-mono text-[12px] tracking-[0.18em]`，当前项 `text-foreground` + 下方 2px 橙色指示条，非当前 `text-muted-foreground hover:text-foreground`；不用现成 Tabs 组件的默认样式。列表复用 `post-row`。空态：「暂无该类型动态」。

### 5.5 帖子详情页 `/posts/:slug`

居中窄栏 `max-w-[760px] mx-auto`：顶部 `← 返回动态列表`（`font-mono text-[13px] link-slide`）；题头区：`tag-event/tag-project` + mono 日期（YYYY 年 M 月 D 日）+ H1（`text-[clamp(1.8rem,3.5vw,2.7rem)] font-extrabold`）+ summary（`text-muted-foreground text-[17px]`）；题头区与正文之间发丝线；正文 `<div className="post-body" dangerouslySetInnerHTML>`；底部发丝线 + 「← 返回动态列表」`btn-outline`。slug 不存在时渲染「文章不存在」+ 返回按钮（复用 404 的视觉语言但文案不同）。

## 6. 图片素材清单（已就位 `public/images/`）

- 团徽：`images/logo.png`（蓝白圆形徽章）
- `images/posts/annual-report-2025/`：03-88b40154.jpg 05-7d582352.png 07-c9918478.jpg 08-ce322669.jpg 09-e045a292.jpg 10-da7725ba.jpg 11-93a56836.jpg 12-fbff9c6d.png 13-3700eb2c.jpg（年终总结现场）
- `images/posts/thangka-workshop-review/`：06/09/11/12/13/14/15（唐卡 AI 修复活动，含合照 15-e0631ae3.jpg）
- `images/posts/prompt-engineer-certification/`：11-e6bf8c53.jpg 14-e00d436a.png 21-18bff341.jpg（认证培训现场）
- `images/posts/dream-recreation-talk/`：01/02/03 .jpg（宣讲会）
- `images/posts/member-recruitment-2026/`：09 10 11 13 14 15 16 18 .jpg（会员招募）
- `images/posts/recruitment-2026/`：11-d535ddfc.png（合照）12/13/14/15/16 17-8f244d9b.jpg（QQ 群二维码，仅详情页用）

引用一律 `asset('images/...')`（组件内）或相对路径 `images/...`（markdown 内），禁止前导 `/`。

## 7. 数据出处（事实一致性）

- 社团简介/承办协办关系：《2026 招新》推文「关于我们」。
- 核心数据 400+/5万+/30+：《年终总结报告 2025》推文。
- 部门职责：《2026 招新》推文「三大部门」。
- QQ 群 1098392715：《2026 招新》推文二维码图注。
- GitHub 组织：https://github.com/SCU-PaddlePaddle-Pioneer-Group
- 文案统一从 `src/data/club.ts` 读取，不在组件中另写一份。

## 8. 工程约束

- TypeScript 严格模式；所有新文件 `@/` 别名导入。
- 不新增运行时依赖（markdown-it / react-router-dom 已装）。
- shadcn 组件在 `src/components/ui/`，仅 Header 移动菜单可用 `Sheet`；其余按本契约手写，不套 Card 组件堆叠。
- 每处 `transition` 150–300ms；尊重 `prefers-reduced-motion`（index.css 已全局处理）。
- 响应式：移动端单列、隐藏水印、post-row 退化为 `grid-cols-[auto_1fr_auto]`（tag 与日期可折行）；断点 md(768px) 为主。
- 完工验证：`npm run build` 必须通过。
