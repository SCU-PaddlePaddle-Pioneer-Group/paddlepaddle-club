# PaddlePaddle Club — 项目文档

> 版本：v2.5　·　状态：代码已清空，功能全部待实现　·　最近更新：2026-09-

---

## 1. 项目概述

PaddlePaddle Club 是社团的**技术社团官网**，基于 Hugo 构建的纯静态站点，直接部署到 GitHub Pages。站点的定位为"介绍页 + 作品集 + 招募页"——通过动态帖子流（项目 + 活动）呈现社团的技术活力，吸引同学加入共创。

一句话定位：**让想法跑起来。** 用静态站点的极简代价，承载社团对外展示与招募的全部职能。

>以下功能均为**待实现**规划。

---

## 2. 需求

### 2.1 项目目标

- 为社团提供一个可长期维护、可版本化、零成本的官网
- 通过动态帖子流（项目 + 活动）展示，传递社团技术文化与开源精神
- 降低门槛：让新人无需复杂的注册/登录流程即可了解社团

### 2.2 功能需求（待实现）

| 模块 | 说明 | 状态 |
| --- | --- | --- |
| 首屏 Hero | 社团 slogan + 动画 | 待实现 |
| 关于我们 | 社团宣言 + 核心数据（成员/项目/分享） | 待实现 |
| 动态流（发推文） | 项目与活动合并为统一帖子流，按时间倒序展示，用 `type` 标签区分 | 待实现 |
| 404 页 | 兜底错误页，指向首页 | 待实现 |



#### 首页跳转与落地页（JS 驱动）

**跳转链接统一由 JS 装配**。

| # | 需求 | 目标 |
| --- | --- | --- |
| 1 | 动态帖子流跳转 | 帖子流中每条帖子跳转到对应详情页（`/posts/<slug>/`） |

设计要点：

- **了解社团文化**：→ 社团文化页（`/about/`）
- **动态帖子流**：项目与活动合并为统一的「帖子流」，每条帖子用 `type` 标签区分（项目 / 活动）。
- **统一数据源**：帖子统一存于 `content/posts/*.md`（front matter：`type` / `date` / `title` / 简介），构建时由 Hugo 导出为 JSON，JS 统一加载。
- **统一装配**：帖子数据不再硬编码在模板中，改由 content 存储、JS 统一加载渲染，并装配详情跳转链接。

#### 待扩展需求

- 多语言支持
- 移动端网页适配

### 2.4 范围边界

- 所有内容为静态展示，不处理用户提交与交互逻辑。

---

### 2.5 帖子 Front Matter 规范

> 动态帖子流（发推文）的数据规范，供 **D（内容）** 编写、**A（JSON 导出模板）** 解析、**E（渲染）** 消费。字段名一经确定不再改动。

| 字段 | 必填 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| `title` | 是 | string | 帖子标题 | `从零开始的 Paddle 深度学习` |
| `date` | 是 | string | 日期（ISO `YYYY-MM-DD`），用于时间倒序排序 | `2024-09-06` |
| `kind` | 是 | string | 帖子类型：`project`（项目）/ `event`（活动）。⚠️ 不用 `type`（Hugo 保留键，会覆盖页面类型） | `event` |
| `summary` | 是 | string | 卡片摘要，展示在帖子流中 | `面向初学者的深度学习工作坊` |
| `slug` | 否 | string | URL 唯一标识；缺省时由文件名生成 | `paddle-workshop` |

**示例文件** `content/posts/paddle-workshop.md`：

```yaml
---
title: "从零开始的 Paddle 深度学习"
date: 2024-09-06
kind: event
summary: "从初学者的 Paddle 深度学习工作坊"
slug: "paddle-workshop"
---
支持markdown格式
（正文内容）
```

**约定规则**：

- 排序：帖子按 `date` **时间倒序**渲染，最新在前。
- 类型：`kind` 决定标签文案与配色（`project` / `event`）。
- 跳转：帖子详情链接为 `/posts/<slug>/`。
- 导出：A 的 JSON 导出模板据此输出 `title / type / date / summary / slug` 字段（JSON 中的 `type` 由 front matter 的 `kind` 提供）。

---

### 2.6 CSS 变量命名规范

> 供 **C（样式）** 使用。以「语义」命名、不硬编码色值；变量一经定义不再改动。

**命名规则**

- 统一 `--` 前缀，小写，多词用 `-` 连接（如 `--ink-soft`）。
- 按类别分组：色板（color）、字体（type）、布局（layout）。
- 全站不出现硬编码色值，颜色一律通过 `var(--x)` 引用。

**色板变量**

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--ink` | `#07111f` | 深蓝主底 |
| `--ink-soft` | `#0d1d31` | 次深底（次级区块） |
| `--paper` | `#edf2ec` | 浅色底（浅色区块） |
| `--muted` | `#9eacba` | 次要文字 |
| `--acid` | `#cbff45` | 荧光绿 · 强调/CTA |
| `--cyan` | `#5ce1e6` | 青 · 辅助/描边 |
| `--line` | `rgba(237,242,236,.16)` | 分隔线 |

**字体变量**

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--display` | `'Space Grotesk', Arial, sans-serif` | 标题/正文显示字体 |
| `--mono` | `'DM Mono', Consolas, monospace` | 代码/标签等宽字体 |

**用法约定**

- 颜色一律 `var(--x)`，禁止在区块内硬编码色值。
- 派生色（透明度/暗化）基于语义色用 `rgba` / `color-mix()` 生成，不改主变量。
- 动效只允许纯 CSS，不引入 JS 动画。

---

### 2.7 JSON 输出结构

> A 的导出模板把 `content/posts/*.md` 在构建期输出为 `static/data/posts.json`，供 **E（nav.js）** 消费。字段名与嵌套结构一经确定不再改动。

**顶层结构**

```json
{
  "posts": [ { … }, { … } ]
}
```

顶层为对象，含 `posts` 数组（便于日后扩展 `meta` 等顶层字段）。

**单条帖子字段**

| 字段 | 类型 | 来源 | 说明 |
| --- | --- | --- | --- |
| `title` | string | front matter `title` | 帖子标题 |
| `type` | string | front matter `kind` | `project` / `event`（JSON 字段名保留 `type`，取 front matter 的 `kind`） |
| `date` | string | front matter `date` | ISO `YYYY-MM-DD` |
| `summary` | string | front matter `summary` | 卡片摘要 |
| `slug` | string | front matter `slug` 或文件名 | URL 标识 |
| `url` | string | 由 `slug` 拼接 | 详情跳转地址 `/posts/<slug>/` |

**示例** `static/data/posts.json`

```json
{
  "posts": [
    {
      "title": "从零开始的 Paddle 深度学习",
      "type": "event",
      "date": "2024-09-06",
      "summary": "从初学者的 Paddle 深度学习工作坊",
      "slug": "paddle-workshop",
      "url": "/posts/paddle-workshop/"
    }
  ]
}
```

**约定规则**

- 排序：导出时按 `date` **时间倒序**输出（最新在前），E 可直接顺序渲染。
- `url`：由导出模板拼接，E 直接使用，无需自行拼路径。
- 字段缺失：`slug`/`url` 由模板生成；`title`/`type`/`date`/`summary` 缺失时该条视为无效帖子，可跳过。

---

### 2.8 页面锚点规范

> 首页为单页结构，区块锚点用于导航跳转。供 **B（页面结构）** 定义 `id`、导航引用。锚点 id 一经确定不再改动。

**首页锚点列表**

| 锚点 | 区块 | 用途 |
| --- | --- | --- |
| `#top` | 页面顶部 | 返回顶部 / 页头 logo 链接 |
| `#about` | 关于我们 | 社团宣言 + 核心数据 |
| `#feed` | 动态帖子流 | 帖子流（E 用 JS 填充） |

**使用约定**

- 每个区块用 `<section id="about">`、`<section id="feed">`，`id` 与锚点一致。
- 导航链接使用 `href="#about"`、`href="#feed"`。
- `#feed` 容器**只由 E（JS）渲染填充**，B 只预留空容器、不写入帖子内容。
- 锚点只做区块内定位；跨页跳转走帖子详情 `/posts/<slug>/`。

---

### 2.9 HTML class 命名规范

> 供 **B（页面结构）** 定义 DOM、**C（样式）** 写 CSS、**E（JS）** 装配的公共 class 命名。一经确定不再改动。

**命名规则**

- 语义化，小写，多词用 `-` 连接（如 `section-pad`）。
- 区块级 class 用于布局/定位（如 `hero`、`about`、`feed`）。
- 组件级 class 用于内部元素（如 `post-card`、`post-type`）。
- 状态修饰用 `is-` 前缀（如 `is-active`）。

**首页区块 class 清单（B 定义）**

| class | 元素 | 说明 |
| --- | --- | --- |
| `.hero` | 首屏 section | 首屏区块 |
| `.section-pad` | 区块内层 | 区块内边距 |
| `.grid-bg` | section | 点阵网格背景 |
| `.stats-row` | 关于区块 | 核心数据行 |
| `.feed` | 动态流容器 | E 填充帖子 |

**帖子卡片 class（E/C 契约）**

| class | 说明 |
| --- | --- |
| `.post-card` | 帖子卡片容器 |
| `.post-type` | 类型标签（project/event） |
| `.post-title` | 帖子标题 |
| `.post-summary` | 摘要 |

**使用约定**

- B 只写结构并用上述 class；C 按这些 class 写样式；E 生成帖子 DOM 时复用 `.post-*` 类。
- 不在 HTML 内联 style（例外：可访问性/语义必需时）。
- 状态类如 `is-active` 只在 JS 控制时使用。

---

## 3. 技术栈

| 层面 | 选型 | 说明 |
| --- | --- | --- |
| 静态站点生成器 | **Hugo** (Extended, v0.135.0) | 编译 markdown/模板为纯静态 HTML |
| 模板语言 | Go Template | Hugo 内置，用于 `layouts/` 下的模板 |
| 样式 | 原生 CSS（单文件） | 无预处理器、无框架 |
| 脚本 | 原生 JavaScript（单文件 `nav.js`） | 统一加载 content 数据并装配首页跳转，不引入框架 |
| 字体 | Space Grotesk / DM Mono（Google Fonts） | 主题显示字体与等宽字体 |
| 语言 | zh-cn | 站点语言与内容语言 |
| 构建/部署 | GitHub Actions + Pages | 推送 `main` 自动构建发布 |
| 版本控制 | Git | 仓库默认分支 `main` |

> JS 定位：仅用**一个原生脚本**（`nav.js`）承担 content 帖子数据加载、动态流渲染与跳转装配，不引入任何前端框架；页面动效仍为纯 CSS，JS 不参与动画。


---

## 4. 实现方式（待实现）

### 4.1 目录结构

```
paddlepaddle-club/
├── hugo.toml                 # 站点配置（baseURL / title / 语言）
├── content/
│   ├── _index.md             # 首页元数据（title / description）
│   └── posts/                # 动态帖子（项目 / 活动，用 type 区分）
├── layouts/
│   ├── index.html            # 首页模板
│   └── 404.html              # 404 模板
├── static/
│   └── css/main.css          # 全部样式（单文件）
├── .github/workflows/hugo.yml # CI 构建 + 部署
├── public/                   # hugo 构建产物（勿手改）
└── README.md                 # 快速上手
```

### 4.2 架构

- **单页结构**：`layouts/index.html` 为唯一的页面模板，通过锚点导航（`#about` / `#feed`）实现单页内跳转。
- **区块划分**：首页由 3 个 `section` 组成（hero → about → feed（动态帖子流））
- **视觉变量**：CSS 变量定义于 `:root`，含色板（`--ink` 深蓝、`--acid` 荧光绿、`--cyan` 青）、字体、分隔线，便于统一维护。（已删除「更换主题」功能）
- **内容渲染**：`index.html` 通过 Hugo 模板变量注入站点级配置（`.Site.Params.description`、`.Site.Title`）；动态内容（项目/活动帖子）由 content 存储 + JS 加载渲染，静态文案仍硬编码。

### 4.3 模板渲染机制

规划在 `index.html` 中使用少量 Hugo Go Template 语法，它们在**构建期**被替换成最终值（待实现）：

```html
<!-- 1. 站点描述：取自 hugo.toml 的 [params].description -->
<meta name="description" content="{{ .Site.Params.description }}">

<!-- 2. 站点标题：取自 hugo.toml 的 title -->
<title>{{ .Site.Title }} · 技术社团</title>

<!-- 3. 资源路径：relURL 会基于 baseURL 生成正确的相对/绝对路径 -->
<link rel="stylesheet" href="{{ "css/main.css" | relURL }}">
```

- `.Site.*`：Hugo 全局站点对象，映射 `hugo.toml` 顶层与 `[params]` 配置。
- `relURL`：把 `css/main.css` 解析为相对 baseURL 的路径，保证不同部署子路径下资源能正确加载。
- 由于 `hugo.toml` 设置了 `markup.goldmark.renderer.unsafe = true`，content 中的原始 HTML 会被保留渲染（当前 `_index.md` 未用到，属前瞻配置）。

### 4.4 样式与视觉实现

规划将全部样式集中在 `static/css/main.css`（单文件）。以下为规划的设计要点（待实现）。

#### 设计系统（CSS 变量）

```css
:root{
  --ink:#07111f;      /* 深蓝主底 */
  --ink-soft:#0d1d31; /* 次深底（projects 区） */
  --paper:#edf2ec;    /* 浅色底（manifesto 区） */
  --muted:#9eacba;    /* 次要文字 */
  --acid:#cbff45;     /* 荧光绿 · 强调/CTA */
  --cyan:#5ce1e6;     /* 青 · 辅助/描边 */
  --line:rgba(237,242,236,.16); /* 分隔线 */
  --display:'Space Grotesk',...; /* 标题字体 */
  --mono:'DM Mono',...;          /* 等宽字体 */
}
```

全站不再出现硬编码色值，颜色集中在 `:root` 统一管理。

#### 网格背景（grid-bg）

用两条 `linear-gradient` 叠加模拟点阵网格，`background-size:72px 72px` 控制格子尺寸，透明青色 `rgba(92,225,230,.055)` 保持低干扰：

```css
.grid-bg{
  background-image:
    linear-gradient(rgba(92,225,230,.055) 1px,transparent 1px),
    linear-gradient(90deg,rgba(92,225,230,.055) 1px,transparent 1px);
  background-size:72px 72px;
}
```

#### 首屏神经网络动效（纯 CSS）

- **轨道** `.visual-orbit`：绝对定位的椭圆，`border-radius:50%` + `rotate(-28deg/42deg)` 交叉出立体轨道感。
- **核心** `.visual-core`：圆形 + `radial-gradient` 径向光晕 + `box-shadow` 外发光，中央 `∞` 符号带荧光绿投影。
- **节点** `.node-*`：四枚 10px 圆点，绝对定位四角，`box-shadow` 模拟辉光。
- **脉冲** `.pulse`：`box-shadow: 0 0 0 5px rgba(...)` 制造呼吸光圈。
- 全部为静态定位 + 渐变/阴影，**无动画帧、无 JS**，渲染零成本。

#### 响应式字号（clamp）

标题用 `clamp()` 实现流式缩放，无需多个断点：

```css
.hero h1{ font-size:clamp(72px,10vw,164px); }
```

- 视口小 → 72px，视口大 → 164px，中间随 `10vw` 平滑过渡。

#### 响应式断点

单一断点 `@media (max-width:800px)`：

- `main-nav` 隐藏，页头简化。
- `hero` 由双栏（`grid-template-columns:1fr 1fr`）塌缩为单列。
- `stats-row` 由 4 列变 2 列。
- `project-card` 改为 `40px 1fr`，`project-art` 移到下方。
- `event-row` 改为 `1fr 26px` 两列布局。
- 页脚由水平排列变垂直堆叠。

### 4.5 构建与部署

- 本地开发：`hugo server -D` → 访问 `http://localhost:1313/`
- 产物输出：`hugo` → `public/` 目录
- 生产构建（CI 内）：`hugo --gc --minify --baseURL "<pages地址>/"`
- 部署链路：`push main` → `hugo.yml` 触发 → 构建 → 上传 `public/` → GitHub Pages 发布

#### CI 工作流（hugo.yml）分阶段

| 阶段 | 操作 | 关键点 |
| --- | --- | --- |
| Checkout | `actions/checkout@v4` | `submodules: recursive` 拉取子模块 |
| Setup Hugo | `peaceiris/actions-hugo@v3` | 版本锁定 `0.135.0`，`extended: true` |
| Setup Pages | `actions/configure-pages@v5` | 生成 Pages 的 `base_url` 供下一阶段注入 |
| Build | `hugo --gc --minify` | `--baseURL` 由 `configure-pages` 动态覆盖，免手改配置 |
| Upload | `actions/upload-pages-artifact@v3` | 上传 `./public` |
| Deploy | `actions/deploy-pages@v4` | 发布到 Pages，受 `environment: github-pages` 保护 |

> CI 中 `--baseURL` 由 `configure-pages` 动态注入，本地构建可覆盖该参数，无需手动改 `hugo.toml`。

### 4.6 动态帖子流与落地页（JS 实现 · 规划）

本站唯一的运行时 JS，负责**从 content 统一加载帖子数据**，渲染首页动态帖子流，并装配帖子详情跳转。

**内容与数据链路：**

| 文件 | 职责 |
| --- | --- |
| `content/posts/*.md` | 动态帖子源（front matter：`type`（项目/活动）` / `date` / `title` / 简介） |
| `static/data/*.json` | 构建期由 Hugo 从 `content/posts/` 导出的 JSON 数据源 |
| `static/js/nav.js` | 唯一运行时 JS：fetch JSON，按时间倒序渲染帖子流并装配跳转链接 |
| `content/about/` | 「了解社团文化」落地页 |
| `layouts/index.html` | 首页改造：原「项目矩阵」「活动日历」合并为 JS 渲染的「动态帖子流」容器 |

**数据流：**

```
content/posts/*.md ──(Hugo 构建)──▶ static/data/*.json ──(JS fetch)──▶ 首页帖子流 + 跳转
```

**JS 工作流程：**

1. 页面加载 `nav.js`，`fetch` 帖子的 JSON 数据源（构建期由 Hugo 从 `content/posts/` 导出）。
2. 遍历 JSON，按 `date` 时间倒序渲染首页帖子流；每条帖子按 `type` 标记（项目 / 活动），并装配 `<a href="/posts/<slug>/">`。
3. 用户点击 → 通过 `href` 原生跳转到对应帖子详情页（JS 负责加载、渲染与装配链接，跳转由浏览器执行）。

**与既有约定的一致性：**

- 引入 JS 后，`README.md` 与本文档「零运行时依赖」的表述需同步更新为「仅一个最小 JS 脚本」。
- 保留全部纯 CSS 动效不变，JS 只负责帖子渲染与跳转装配，不承担任何动画逻辑。
- 落地页与帖子详情页复用现有 CSS 变量与区块样式（`.section-pad`、`grid-bg`），保证视觉统一。

---

## 5. 协作流程

### 5.1 分支策略

- 默认分支：`main`，为**可发布状态**，直接触发线上部署。
- 开发分支：从 `main` 切出 `feat/<名称>` 或 `fix/<名称>`，如 `feat/event-page`、`fix/nav-mobile`。
- 禁直接 push `main`（维护者 Hotfix 可例外）。

### 5.2 提交规范（Conventional Commits）

```
<type>(<scope>): <描述>
```

| type | 含义 | 示例 |
| --- | --- | --- |
| `feat` | 新功能/新区块 | `feat(projects): 新增第4个项目卡片` |
| `fix` | 修复 | `fix(nav): 修复移动端导航重叠` |
| `style` | 样式调整 | `style(hero): 调整首屏间距` |
| `docs` | 文档 | `docs: 更新 PROJECT.md` |
| `refactor` | 重构 | `refactor: 抽取区块为 partial` |

示例：`fix(events): 修正活动日期文案`

### 5.3 工作流

1. `git checkout -b feat/xxx` 基于 `main` 新建分支
2. 本地开发：`hugo server -D` 实时预览
3. 提交：`git add` → `git commit -m "feat(区块): 说明"`
4. 推送分支 → 发起 **Pull Request** 至 `main`
5. Review（见 5.4）通过后合并 → CI 自动部署
6. 部署后在 Pages 域名人工确认线上效果

### 5.4 代码 Review 要点

- **内容准确性**：文案、日期、数据（成员数/项目数）与事实一致。
- **HTML 语义**：是否正确使用 `header/section/article/time`，是否有 `aria-label`。
- **CSS 一致性**：新样式是否复用 `:root` 变量，不引入硬编码色值。
- **响应式**：在 `<800px` 断点下验证不破版。
- **零 JS 约束**：确认未引入运行时脚本。

### 5.5 发布检查清单

- [ ] `hugo` 本地构建无错误
- [ ] 移动端 / 桌面端均正常（移动端先暂时不管）
- [ ] 外链（GitHub / Email）可用
- [ ] 无硬编码敏感信息
- [ ] CI 构建通过并成功部署

---

## 附：快速命令

| 命令 | 说明 |
| --- | --- |
| `hugo server -D` | 本地实时预览 |
| `hugo` | 生成 `public/` 产物 |
| `hugo --gc --minify` | 清理缓存 + 压缩构建 |