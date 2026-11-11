# 四川大学飞桨领航团 · 官网

面向全校同学的 AI 学习、技术实践与创新交流社区。前端为 React + TypeScript + Vite + Tailwind CSS 构建的静态站点（GitHub Pages 发布）；赛事模块 Demo 另含独立的 Node.js + Express + SQLite 后端（`server/`），仅本地或自有服务器运行，详细启动步骤见 [`docs/runbook.md`](docs/runbook.md)。

## 快速上手

```bash
npm install        # 安装依赖
npm run dev        # 本地开发（热更新）
npm run build      # 生产构建 → dist/（纯静态，可部署到任意静态托管）
npm run preview    # 本地预览构建产物
```

## 日常维护

**发一篇新动态**（两步）：

1. 在 `src/content/posts/` 新建 `<slug>.md`，front matter 五字段缺一不可：

   ```markdown
   ---
   title: "标题"
   date: 2026-10-01
   postKind: "event"        # event=活动 / project=项目
   summary: "一句话摘要，显示在列表与详情页题头"
   slug: "my-new-post"      # 与文件名一致
   ---
   正文 Markdown。图片写法：![图注](images/posts/my-new-post/01.jpg)
   ```

2. 把图片放进 `public/images/posts/<slug>/`。图片 src 用相对路径 `images/posts/...`，**不要**加前导 `/`。

构建时文章自动进入列表与详情页，无需改任何代码。

**改文案 / 数据 / 部门 / 联系方式**：只改 `src/data/club.ts`（核心数据必须与事实一致，出处见 DESIGN.md §7）。

**改设计**：`DESIGN.md` 是全站设计与工程契约（唯一事实源），样式令牌集中在 `src/index.css`，改之前先读契约。

## 赛事模块 Demo（本地联调）

官网与赛事 Demo 是两个进程：静态前端（本仓库根目录）与独立 API 服务（`server/`）。本地联调需同时启动两者：

```bash
# 终端 1：后端（见 server/README.md 与 docs/runbook.md）
cd server && npm ci && npm run dev          # http://127.0.0.1:3001

# 终端 2：前端（API_PROXY_TARGET 指向 3001）
npm ci && npm run dev                        # http://localhost:3000，/api 代理到后端
```

完整步骤（双平台命令、环境配置、管理员初始化、备份恢复、常见问题）见 [`docs/runbook.md`](docs/runbook.md)；接口契约见 [`docs/api.md`](docs/api.md)；验收清单见 [`docs/acceptance.md`](docs/acceptance.md)；协作与文件归属约定见 [`AGENTS.md`](AGENTS.md)。生产部署说明（HTTPS、持久化与备份）见 runbook §6。

## 目录结构

```
├── src/
│   ├── data/club.ts        # 站点文案与数据（唯一事实源）
│   ├── content/posts/      # 动态文章（Markdown）
│   ├── lib/posts.ts        # 构建期文章加载与渲染（glob + markdown-it）
│   ├── components/layout/  # 页头 / 页脚
│   ├── components/home/    # 首页五区块
│   ├── pages/              # Home / Posts / PostDetail / About / NotFound
│   └── index.css           # 设计令牌与组件类
├── public/images/          # 团徽与活动照片
├── server/                  # 赛事 Demo 后端（Node + Express + SQLite，本地运行）
├── docs/                    # runbook / acceptance / api 契约与交接文档
├── DESIGN.md               # 设计与工程契约
├── AGENTS.md               # 协作与文件归属约定
└── legacy/                 # 旧 Hugo 站点存档（勿动，仅供参考）
```

## 部署

`npm run build` 产物 `dist/` 为纯静态文件，使用 HashRouter，部署到 GitHub Pages 子路径时刷新详情页不会 404，无需服务端 rewrite。`.github/workflows/deploy.yml` 在 `main` 分支更新时自动构建并发布；赛事 Demo 的后端不随 Pages 发布，本地或服务器运行方式见 [`docs/runbook.md`](docs/runbook.md)。
