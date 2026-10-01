# 四川大学飞桨领航团 · 官网

面向全校同学的 AI 学习、技术实践与创新交流社区。React + TypeScript + Vite + Tailwind CSS 构建的纯静态站点。

## 快速上手

```bash
npm install        # 安装依赖
npm run dev        # 本地开发（热更新）
npm run build      # 生产构建 → dist/（纯静态，可部署到任意静态托管）
npm run preview    # 本地预览构建产物
```

## 日常维护（技术部）

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
├── DESIGN.md               # 设计与工程契约
└── legacy/                 # 旧 Hugo 站点存档（勿动，仅供参考）
```

## 部署

`npm run build` 产物 `dist/` 为纯静态文件，使用 HashRouter，部署到 GitHub Pages 子路径时刷新详情页不会 404，无需服务端 rewrite。旧 Hugo 的 CI 工作流已随旧站归档到 `legacy/.github/`，如需自动部署请为 Vite 构建新建 workflow。
