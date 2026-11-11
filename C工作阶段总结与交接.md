# C 工作阶段总结与交接

更新日期：2026 年 11 月 11 日  
代码仓库：`TimeOscar/paddlepaddle-club` fork  
当前开发分支：`copilot/c-backend-health`  
代码目录：本机克隆目录下的 `paddlepaddle-club`

## 同步与工作区状态

- 上次远端核对时（2026 年 11 月 11 日上午），本地 `HEAD`、`upstream/develop` 和 `origin/develop` 均为 `a585a6abd6d3d1ea65036adb4b0c7e972c2f4eae`；该记录仅代表当时状态。
- 本次本地核对时，当前分支为 `copilot/c-backend-health`，`HEAD` 为 `d9146fa981fc5200bfc9294b922946ea97d40db9`。工作树有未提交修改；本次未重新抓取或核对远端分支，不能据此判断当前远端同步状态。
- 未推送、合并或执行 GitHub 写操作。最新工作区修改涉及下述 issue 修复及 README 启动路径说明。

## 最新 issue 修复与验证（2026 年 11 月 11 日）

- Issue #21：当前本地实现支持通过 `TRUSTED_PROXY_ADDRESSES` 显式配置可信代理；可信 HTTPS 代理可正确设置 Secure/HttpOnly 会话 Cookie，并按客户端来源隔离登录失败限额；未信任代理时忽略伪造的转发头。相关自动化测试和部署说明已补充。
- Issue #22：管理接口鉴权现在查询管理员记录；管理员被撤销后销毁旧会话、清除 Cookie，并拒绝管理读写请求。
- Issue #28：公开报名新增可配置、按来源/赛事/来源与赛事组合计数的限流；返回 `429 RATE_LIMITED` 和 `Retry-After`，限流状态有过期清理及容量上限。当前限流状态仅保存在单个 Node 进程内存，不适用于跨进程共享额度。
- 三项实现均在本地工作树，尚未提交或合并。最新 `npm.cmd test`：21 项通过；`npm.cmd run build`：通过。测试包含可信 HTTPS 代理、Cookie、登录来源隔离、未信任转发头、管理员撤销和报名限流场景。
- GitHub 上 Issue #21、#22、#28 当前均为 Open，未配置关联的关闭 PR。故本地实现及自动化测试通过不代表 issue 已交付关闭；仍需提交审查，并按目标部署环境验证。

## 1. 阶段目标

给现有 React/Vite 静态官网增加可独立运行的后台服务和 SQLite 数据库，覆盖公开赛事/报名及管理员认证和管理 API。

SQLite 是服务运行目录下的普通数据库文件，不需要注册外部数据库平台。默认文件：`server/data/club.sqlite`。

## 2. 已完成工作

### 后端和数据库

- 新增独立 `server/` Node.js + TypeScript + Express 后端，不改变前端架构。
- SQLite 使用 Node.js 内置 `node:sqlite`，要求 Node.js `>=22.13`。
- 启动时自动应用版本化 SQL 迁移；`npm run db:migrate` 可重复执行。
- 版本化迁移创建 `admins`、`competitions`、`registrations` 和 `sessions` 表，设置状态检查、外键、邮箱/比赛唯一约束和索引；迁移可重复运行且不清空业务数据。
- 默认数据库路径为 `server/data/club.sqlite`；运行时数据库、WAL/SHM 文件由 `.gitignore` 忽略。
- 健康检查 `GET /api/health` 会检查 SQLite 是否可查询。
- 已实现公开赛事列表/详情，以及公开报名提交：
  - 只向公开查询返回已发布比赛；草稿/下架比赛返回 404。
  - 列表按 `createdAt` 倒序、同时间按 `id` 升序；A 首页适配层取前 3 条并使用 `id`、`title`、`summary`、`registrationDeadline`、`status`。
  - 报名校验姓名、邮箱和多余字段；邮箱去空格并转小写。
  - 服务端检查比赛发布状态和截止时间。
  - 同一比赛下规范化邮箱重复报名返回 409。
  - 成功报名写入 SQLite 并返回真实报名 ID，不向公开响应返回个人信息。
- 管理员密码使用 scrypt 哈希，提供交互式初始化命令；实际管理员账号尚未创建。
- 管理员登录、当前用户和退出 API；SQLite 持久会话、HttpOnly Cookie、登录限速和管理写操作来源校验。管理员记录被撤销后，管理接口会终止旧会话。
- 管理员比赛查询/新建/编辑/发布/下架，以及报名查询和处理状态更新 API。
- 管理赛事 `items` 字段：`id,title,summary,rules,registrationDeadline,status,createdAt,updatedAt`；管理报名 `items` 字段：`id,competitionId,name,email,status,createdAt`。报名处理状态为 `pending|confirmed|rejected`。
- 失效/过期会话的退出请求返回 `401 UNAUTHENTICATED` 并清 Cookie；D 端需据此清理前端登录态。
- API 错误统一返回 `{ "error": { "code": "...", "message": "..." } }`。

### 自动化验证

- `npm.cmd test`：21 项通过，覆盖可信代理与转发头校验、HTTPS Cookie/登录限流隔离、管理员撤销后旧会话失效、公开报名限流隔离及过期恢复。
- `npm run build`：TypeScript 编译通过。
- 本次测试和构建针对当前本机工作区；完整目标环境验收仍由用户最后执行。验收时需核对报名返回的 `item.id` 与管理列表/SQLite 记录，并重启服务确认数据保留。

## 3. 当前未完成

- PR #17 记录了 B 配置 Vite 代理及部分真实接口联调；C 本人和用户的目标环境验收仍未完成，管理页面完整流程也待回归。
- Issue #21 的本地可信反向代理配置与回归测试已实现；目标环境/真实入口代理验证及提交交付仍待完成。
- Issue #21、#22、#28 的修改均尚未提交；目标环境最终验收由用户执行。
- 用户指定 SCU 仓库/分支的交付确认；当前 `origin` 是 TimeOscar fork，不应误认为已合入 SCU 官方仓库。

## 4. 当前交接状态

- 分支：`copilot/c-backend-health`，跟踪 `origin/copilot/c-backend-health`；`origin` 指向 `TimeOscar/paddlepaddle-club`。本次本地 `HEAD` 为 `d9146fa981fc5200bfc9294b922946ea97d40db9`；远端本次未重新核对。
- 未确认目标仓库/分支前不推送到 SCU 官方仓库，也不更改远程地址。
- SQLite 数据库文件是运行数据，不提交、不复制到代码 PR。

## 5. Linux 本地测试与启动

以下命令须在包含待验证代码的工作区运行。当前 #21/#22/#28 改动尚未提交；从远端重新克隆的代码不会包含这些本地改动。

```bash
cd path/to/paddlepaddle-club/server
node --version                 # 需要 v22.13 或更新
npm ci
if [ ! -f .env ]; then cp .env.example .env; fi
# 编辑 .env 设置 SESSION_SECRET；生成值可用：openssl rand -hex 32
# 秘密只保存在本机，不要粘贴到聊天、提交或共享文档
npm test
npm run build
npm run db:migrate
npm run db:create-admin       # 交互式输入；只在需要验证管理 API 时执行
npm run dev
```

另一个终端：

```bash
curl -i http://127.0.0.1:3001/api/health
curl -i http://127.0.0.1:3001/api/competitions
```

默认端口为 `3001`，默认只监听 `127.0.0.1`。服务应返回健康状态 `200` 和赛事列表 `200 {"items":[]}`（新数据库尚无比赛）。公开接口可在没有管理员账号时验证；完整报名成功流程需要一条已发布测试赛事。管理接口还需 `.env` 和本机创建的测试管理员。测试后在服务终端按 `Ctrl+C`；不要删除或覆盖正式/共享数据库文件。浏览器联调需要 B 配置 Vite 将 `/api` 代理到 `http://127.0.0.1:3001`。

## 6. Windows 本地安装、初始化与启动

先在包含待验证代码的仓库根目录打开 PowerShell；需安装 Node.js `>=22.13`。`npm.cmd` 用于避免 PowerShell 执行策略拦截 `npm.ps1`：

```powershell
Set-Location .\server
node --version
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
notepad .env
```

将上一步生成的随机值填入本机 `.env` 的 `SESSION_SECRET`（不要把值发给他人），保存后继续：

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run db:migrate
npm.cmd run db:create-admin
npm.cmd run dev
```

`db:create-admin` 会在交互终端要求输入管理员用户名和密码，密码不回显。只在需要测试管理 API 时创建测试管理员；只测公开 API 可以跳过。默认监听 `http://127.0.0.1:3001`。另开 PowerShell 检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/competitions
```

结束服务在运行窗口按 `Ctrl+C`。不要覆盖已有 `.env` 或生产数据库；真实密码/密钥不写入文档、聊天或 Git。

## 7. 下一阶段

1. 为目标部署环境配置准确的可信代理地址，并验证真实 HTTPS 入口下 Cookie、客户端识别与登录限流行为；不得使用通配信任范围。
2. 由 C 提交/交接 Issue #21、#22、#28 的本地修改；跨进程或多副本部署前，补充共享限流方案或在入口层限流。
3. 目标环境与最终演示验收由用户执行；核对真实报名编号、后台记录及重启后数据持久性。
4. 由维护者确认目标仓库、分支及 PR 安排。

新增依赖安装如果遇到系统权限、网络、操作系统组件或需要用户确认的提示，应停下并把命令和提示交给 C；不要绕过机器策略。管理员初始化只创建虚构/本地测试账号，真实密码由 C 本地输入，不写进文档。

## 8. 本阶段不应做

- 不在未确认前把代码推到 SCU 官方仓库或改变远程地址。
- 不把 `.env`、管理员密码、session 密钥、SQLite 数据库或报名个人信息提交到 Git。
- 不把 GitHub Pages 当成可运行 Express/持久化 SQLite 的后端主机。
- 不以自动化测试通过代替 Linux/目标演示机实测。
- 不声称目标 Linux/浏览器端完整业务流程已验收；当前通过的是本机自动化测试和构建。
