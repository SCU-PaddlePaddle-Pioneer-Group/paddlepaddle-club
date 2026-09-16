# PaddlePaddle Club

一个基于 Hugo 的纯静态技术社团官网，适合直接部署到 GitHub Pages。

## 本地运行

需要安装 [Hugo Extended](https://gohugo.io/installation/)。

```bash
hugo server -D
```

访问 `http://localhost:1313/` 预览。

## GitHub Pages 部署

1. 将仓库默认分支设置为 `main`，并推送代码。
2. 在仓库 `Settings → Pages → Build and deployment` 中选择 `GitHub Actions`。
3. 修改 `hugo.toml` 中的 `baseURL` 为你的 Pages 地址（工作流部署时会自动覆盖构建地址）。

站点入口内容在 `layouts/index.html`，样式在 `static/css/main.css`。页面不依赖前端框架或运行时 JavaScript。

