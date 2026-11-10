# B 周二交接：参赛页面与公共工具

日期：2026-11-10。分支 `feat/b-competition-pages`，PR 目标 `develop`。以 AGENTS.md 的本周边界为准。

## 范围和状态

完成今日开发准备：接口草案、公共请求工具、可配置代理、列表/详情/表单及独立开发预览。**本次不是周三的真实报名入库交付**；C 的真实接口、团队契约确认、A 的正式路由接入仍待完成。

没有修改 A 的 App.tsx、Header.tsx、Home.tsx、CompetitionPreview.tsx 或临时 competition-preview.ts，也没有修改 server/ 或 D 的管理页面。不新增依赖，不替换技术栈，不新增本周范围外功能。

## 给 A：两个默认导出组件

```tsx
import CompetitionList from '@/pages/competitions/CompetitionList'
import CompetitionDetail from '@/pages/competitions/CompetitionDetail'
```

由 A 将已经存在的 `/competitions` element 替换为 `<CompetitionList />`，`/competitions/:id` 替换为 `<CompetitionDetail />`。保留原路由地址，不重复注册路由；两页自身不包含全站 Header/Footer。

公共工具可供首页适配层使用：

```ts
import { apiRequest } from '@/lib/api'
const data = await apiRequest<unknown>('/competitions', { signal })
// 返回已拆出的 data；保留现有首页字段校验和取前 3 条行为。
```

B 没有擅自替换 A 的适配层。正式站的赛事入口在 A 接入前仍显示占位，与独立预览不同。

## 给 C：优先确认再分批联调

请看 docs/api.md 第 1 节并回复：成功包装、id、排序、输入长度、报名返回字段/错误码、Cookie 策略、后台端口和启动命令。列表沿用 A 预留的 `{data:[...]}`，不是另起一套结构。

交付顺序：公开列表/详情 → 报名 → 登录 → 管理接口。公开查询可用即开始接入，不等待全部后台完成。周三目标必须提供真实数据库中与页面编号一致的报名记录。

## 给 D：工具与前端运行信息

- `apiRequest<T>` 路径不含 /api；body 传对象，工具发送 JSON；same-origin Cookie 自动携带。
- 用 `ApiError.status/code/message` 区分错误。仅管理请求 401 发 `ADMIN_UNAUTHORIZED_EVENT`；D 负责页面级回登录，不在公开页面强制登录。
- Node 22.12 或更高兼容版本；`npm ci`、`npm run dev`；检查 `npm run lint`、`npm run build`。
- `.env.example` 展示代理变量，C 确认后写入不提交的 `.env.local`，重启 Vite；无后台时真实接口模式应失败。
- 本机在 C 盘工作，云盘发生过大量依赖写入失败；建议在普通本地目录开发。本机预览端口 3011 是运行参数，不写入团队默认配置。

## 给本人：今天只验证这些

打开 `/src/pages/competitions/__dev__/preview.html?source=sample#/competitions`：

1. 顶部清晰写着“示例数据，不会真实报名”。
2. 两场示例比赛可以打开，详情含简介、规则、北京时间截止日期。
3. 空姓名/错误邮箱有提示；只用“演示同学”和 demo@example.com 试填。
4. 有效填写后点提交，显示“开发预览，报名未发送、未保存”，不能出现成功编号。
5. 已截止示例能读规则，表单禁用；返回列表和刷新详情正常。
6. 缩窄窗口检查排版。切换真实接口模式，未接后台时看到失败提示是当前预期。

## 每日同步草稿（由本人确认后发给队友）

完成：B 的接口草案、公共请求工具、可配置 /api 代理及列表/详情/报名页面开发预览。原站已跑通。

验证：原站由本人验证；新增页面的技术检查和模拟测试结果见下方记录，真实接口/数据库尚未验收。

阻碍：需要 C 核对接口并提供后台地址/启动方式/可联调时间，A 接入正式路由，A/D 确认共用字段与模拟数据。

下一步：C 交付公开接口即接列表和详情；报名接口一到即核对数据库编号，周三晚争取真实入库。

## 验证记录

本轮验证完成（2026-11-10）：

- `npm run lint`：通过。
- `npm run build`：通过，含新增页面 TypeScript 检查。正式构建不含开发预览入口、示例赛事和 PREVIEW_ONLY 模拟逻辑。
- 浏览器检查 17 组全部通过，未捕获页面 JavaScript 异常：示例列表/详情、模拟预览拒绝写入、截止禁用、390px 布局/详情刷新、加载/空列表、500/重试、非 JSON/非公开数据、404、表单校验、提交中禁用/邮箱规范化/测试响应编号、重复/截止/下架/断网/无效回执、Cookie/管理 401 事件/204/超时、旧站回归。
- 已查看桌面列表/详情、手机列表/详情截图，无明显溢出和重叠。
- 可配置 /api 代理：临时本地测试服务验证了路径、POST 内容、Cookie、Origin/Host 保留；没有连接 C 的真实后台。
- 旧站回归包括首页、动态列表、文章详情、关于和正式赛事占位页。A 负责的文件保持原样。
- 浏览器检查使用测试拦截和虚构数据；外部字体请求在测试中隔离，页面加载以内容就绪为准。没有把截图中的测试报名编号当成真实入库。
- 本地检查脚本与结果：`.temp/b-day1-smoke.cjs`、`.temp/proxy-check.cjs`、`.temp/b-checks/result.json` 及 PNG 截图；均为本机临时验证产物，不提交仓库。脚本使用 Codex 自带浏览器测试依赖，没有修改 package.json/lockfile；其他电脑可按上述手动步骤验收。

待确认：本人对新增页面的浏览器验收；C/A/D 对 docs/api.md 草案的确认；C 的真实接口/数据库校验；A 的正式路由与首页公共工具接入。每日同步中的完成范围仅指今日前台开发准备，不代表 B1-B8 的最终真实后台验收已完成。
