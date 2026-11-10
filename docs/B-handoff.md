# B 交接：赛事前台、公共工具与接口契约

更新：2026-11-10。开发分支 `feat/b-competition-pages`，PR 目标 `develop`。新版契约在 `docs/api.md`，请使用本分支的最新提交，旧版 data 包装已废弃。

## 当前交付与边界

- 列表、详情和个人报名表单初版，包含加载/空态/错误、北京时间、截止、提交中禁用及结果处理。
- 公共请求工具、可配置 /api 代理、独立开发预览、项目内接口文档。
- 已同步 develop 中 D 的已合并交付，未改 D 页面或样本源文件；开发预览复用该共用样本的 published 子集。
- 没有改 A 的 App.tsx、导航、首页或 competition-preview.ts；没有把 C 的 server/ 未合并代码带进 B 的 PR。
- 本人已验证上一版开发预览；本次 items/item 改动与真实后台验证结果见文末，不能将上一版模拟验收视为真实入库验收。

## A：路由与首页接入

默认导出：

```tsx
import CompetitionList from '@/pages/competitions/CompetitionList'
import CompetitionDetail from '@/pages/competitions/CompetitionDetail'
```

由 A 将现有 `/competitions`、`/competitions/:id` 的占位 element 换成这两个组件，保留原路由；不要重复注册。
首页复用工具时：`const payload = await apiRequest<{items:unknown[]}>('/competitions',{signal})`；保留 A 的字段校验，从 payload.items 取前 3 条，保持后台顺序。
旧的 `{data:[]}` 已失效，A 适配前首页会继续报错，这是待接入项，不要用假数据掩盖。

## C：已静态核对的接入点

对照提交 `3322669a1f1c787f9f830ee53ee54ac95089df4a`：公开列表 items，详情/报名 item，UUID 字符串 id，赛事 createdAt DESC/id ASC，错误 error.code/message，姓名 80/邮箱 254，公开接口 registrationOpen。
后台已有公开接口、认证和管理接口源码；有完整 server/README.md Windows 命令。源码存在不等于运行验收完成，具体测试证据见文末。

## D：请求工具约定

- `apiRequest<T>` 路径不含 /api，返回完整 JSON；按 response.items/item/admin/ok 读取，不再拆 data。
- body 传对象，工具发送 JSON，Cookie 同源携带。保护页面监听 `ADMIN_UNAUTHORIZED_EVENT` 并回登录；登录接口 401 不触发事件，D 应展示登录错误。
- C 登录/me 返回 admin，logout 返回 200 `{ok:true}`，失效 logout 401 并清 Cookie。
- D 仍需确认并完成管理端真实绑定。D 样本文案中的组队、作品/OJ 不代表本周加入这些功能。

## B 本机运行与验收入口

前端 Node 22.13+；`npm.cmd ci`、`npm.cmd run dev`；`.env.local` 设置 API_PROXY_TARGET=http://127.0.0.1:3001，修改后重启。不要提交 .env.local。
普通开发入口 3000；历史本机预览 3011 可保留，但管理写操作请按 C 允许的 3000 origin 联调。
独立预览 `/src/pages/competitions/__dev__/preview.html?source=sample#/competitions` 显示共用样本，写入明确拒绝。
切换 source=live 后请求真实后台；正式官网路由仍等待 A 接入。

## 验证记录

上一阶段：lint/build、17 组模拟浏览器检查及本人开发预览验收通过；阶段提交 4e054f6 已推送。该记录仅为旧 data 草案时期的模拟验证。

本次契约更新验证（2026-11-10）：

- 前端 npm run lint / npm run build 通过；已同步 develop 的 D 模块也通过检查。
- 定向浏览器检查通过：旧 data 外层拒绝、items/item 与 UUID 字符串 id、health/admin/ok 完整响应、登录凭据错误与会话失效事件区分、共用 published 样本、390px 无溢出、模拟报名明确拒绝。
- C 运行副本固定为 3322669a1f1c787f9f830ee53ee54ac95089df4a，独立目录构建成功，未修改后台源码；全新本地 SQLite，仅合成管理员和虚构报名，不使用已有业务数据库。
- 8 组真实核心流程自动检查通过：localhost:3000/api/health 转发 3001 并执行 SQLite 查询；登录 admin 包装；草稿不可见/发布/排序；B 独立 live 预览真实提交；重复/截止/下架拒绝；编辑刷新与报名处理状态；重启后台持久化；退出后管理接口 401 且公开响应无报名隐私。
- 真实报名回执编号 19abab0e-e3c8-4f97-b35d-bca3c1854915 已与数据库同一记录核对，状态通过管理 API 改为 confirmed 后重启仍保留。已查看真实提交页面截图。
- 管理操作由测试脚本调用真实管理 API；没有把 D 页面或 A 首页/正式路由接入说成已完成。新真实流程仍需本人及 A 最终人工验收。
- 证据在本机 .temp/live-contract-checks/result.json、real-registration.png、contract-regression-result.json；脚本、截图、数据库和秘密配置均不提交仓库。

尚未完成 A/D 正式页面接入后的全组真实联调及人工最终验收。可向团队报告本机 B+C 核心接口已验证，但不能报告整站 Demo 已全部通过。
