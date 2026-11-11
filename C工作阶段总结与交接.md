# C 工作阶段总结与交接

更新日期：2026 年 11 月 10 日
代码仓库：`TimeOscar/paddlepaddle-club` fork
当前开发分支：`copilot/c-backend-health`
代码目录：`D:\AAAcode storage total\paddle\paddlepaddle-club`

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
- 管理员登录、当前用户和退出 API；SQLite 持久会话、HttpOnly Cookie、登录限速和管理写操作来源校验。
- 管理员比赛查询/新建/编辑/发布/下架，以及报名查询和处理状态更新 API。
- 管理赛事 `items` 字段：`id,title,summary,rules,registrationDeadline,status,createdAt,updatedAt`；管理报名 `items` 字段：`id,competitionId,name,email,status,createdAt`。报名处理状态为 `pending|confirmed|rejected`。
- 失效/过期会话的退出请求返回 `401 UNAUTHENTICATED` 并清 Cookie；D 端需据此清理前端登录态。
- API 错误统一返回 `{ "error": { "code": "...", "message": "..." } }`。

### 自动化验证

- `npm test`：14 项通过，覆盖迁移、数据和会话持久性、认证/来源限制、管理流程、公开可见性、列表排序、报名返回 ID 与数据库主键一致、去重及截止/输入校验。
- `npm run build`：TypeScript 编译通过。
- `npm test`、`npm run build` 已在本机通过；完整 Linux/浏览器端联调尚未进行。验收时需用公开报名成功响应中的 `item.id` 对照管理员报名列表/SQLite 记录，并重启服务确认数据保留。

## 3. 当前未完成

- 与 B 的 Vite 代理、与 B/D 的页面联调及完整浏览器流程。
- B 配置 Vite 代理并与 A/C 完成真实查询、报名和浏览器联调。
- C 在目标环境配置 `SESSION_SECRET`、创建虚构测试管理员并完成 Linux/演示机验收。
- 用户指定 SCU 仓库/分支的交付确认；当前 `origin` 是 TimeOscar fork，不应误认为已合入 SCU 官方仓库。

## 4. 当前交接状态

- 分支：`copilot/c-backend-health`，跟踪 `origin/copilot/c-backend-health`；`origin` 指向 `TimeOscar/paddlepaddle-club`。
- 本轮提交：`7fde9539d164c9e21f848a4f0d2315b1af661d95`（列表排序实现与测试）；`ecb22f402899b90253a61851e85922b6c43152ff`（Windows 启动说明）；`3de4e26db57eed24f55c15eebecc57f3aa3e6894`（验证报名响应 ID 与 SQLite 主键一致）。均在本地 `copilot/c-backend-health`，尚未推送（分支领先远程 3 个提交）。
- 未确认目标仓库/分支前不推送到 SCU 官方仓库，也不更改远程地址。
- SQLite 数据库文件是运行数据，不提交、不复制到代码 PR。

## 5. Linux 本地测试与启动

```bash
git clone --branch copilot/c-backend-health --single-branch \
  https://github.com/TimeOscar/paddlepaddle-club.git
cd paddlepaddle-club/server
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

在 PowerShell 中执行以下命令；需安装 Node.js `>=22.13`。`npm.cmd` 用于避免 PowerShell 执行策略拦截 `npm.ps1`：

```powershell
Set-Location 'D:\AAAcode storage total\paddle\paddlepaddle-club\server'
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

1. 由 B 配置 `/api` 代理并验证 `http://localhost:3000/api/health` 可到达 `http://127.0.0.1:3001/api/health`；当前尚未真实联调。
2. C 与 A/B 按已统一的公开列表合同联调赛事查询与报名；验收核对响应 `item.id` 与数据库/管理列表记录，并重启服务验证持久化。
3. D 确认管理端字段、状态文案及失效登录处理；当前实现细节见本交接文档第 2 节和 API 开发文档第 6.6-6.8 节。
4. 由 C 在目标 Linux/演示机按上方步骤验证当前代码；由维护者确认 PR 目标分支及远程仓库。

新增依赖安装如果遇到系统权限、网络、操作系统组件或需要用户确认的提示，应停下并把命令和提示交给 C；不要绕过机器策略。管理员初始化只创建虚构/本地测试账号，真实密码由 C 本地输入，不写进文档。

## 8. 本阶段不应做

- 不在未确认前把代码推到 SCU 官方仓库或改变远程地址。
- 不把 `.env`、管理员密码、session 密钥、SQLite 数据库或报名个人信息提交到 Git。
- 不把 GitHub Pages 当成可运行 Express/持久化 SQLite 的后端主机。
- 不以自动化测试通过代替 Linux/目标演示机实测。
- 不声称目标 Linux/浏览器端完整业务流程已验收；当前通过的是本机自动化测试和构建。