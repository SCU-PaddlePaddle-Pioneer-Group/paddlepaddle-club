# 官网 API 服务（开发阶段）

当前提供 SQLite 数据库初始化、公开赛事查询/报名，以及管理员登录、比赛管理和报名管理 API。

在 Windows PowerShell 中按以下步骤安装、配置并启动后端（需要 Node.js `>=22.13`）。`.env` 配置只需首次创建；迁移可安全重跑。若只测试公开赛事接口，可跳过创建管理员的步骤。

**终端 1：后端安装、初始化和开发启动**

```powershell
Set-Location 'D:\AAAcode storage total\paddle\paddlepaddle-club\server'
node --version
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
notepad .env
npm.cmd run db:migrate
npm.cmd run db:create-admin
npm.cmd run dev
```

将刚才生成的随机值填入本地 `.env` 的 `SESSION_SECRET` 后保存。不要分享密钥或管理员密码；创建管理员时在交互终端输入密码且不会回显。首次启动会自动创建数据库目录、数据库并应用尚未执行的迁移。

**终端 2：B 配置好 `/api` 代理后运行前端**

```powershell
Set-Location 'D:\AAAcode storage total\paddle\paddlepaddle-club'
npm.cmd ci
npm.cmd run dev
```

使用 `npm.cmd` 可避免 PowerShell 执行策略拦截 `npm.ps1`。前端开发地址为 `http://localhost:3000`，后端默认监听 `http://127.0.0.1:3001`，数据库默认为 `server/data/club.sqlite`。由 B 配置 Vite `/api` 代理，并与 C 在浏览器验证 `http://localhost:3000/api/health` 能访问后端。

- `GET /api/health`：HTTP 服务和 SQLite 查询都成功时返回 `200 {"status":"ok"}`；数据库不可用时返回 `503`。
- `GET /api/competitions`：只返回已发布比赛，响应外层为 `{ "items": [...] }`；按 `createdAt DESC`、同时间 `id ASC`。首页取前 3 条，所需 `id`、`title`、`summary`、`registrationDeadline`、`status` 均已包含。
- `GET /api/competitions/:id`：公开比赛详情响应外层为 `{ "item": {...} }`。
- `POST /api/competitions/:id/registrations`：校验报名信息、比赛状态和截止时间，成功后写入 SQLite，返回 `201 { "item": {...} }` 和真实报名 ID；重复邮箱报名返回 `409`。
- `POST /api/admin/login`、`GET /api/admin/me`、`POST /api/admin/logout`：管理员登录态；失效 logout 返回 `401 UNAUTHENTICATED` 并清 Cookie。
- 管理员比赛接口均已实现：`GET/POST /api/admin/competitions`、`PATCH /api/admin/competitions/:id`；列表外层为 `items`，创建/更新外层为 `item`。
- 管理员报名接口均已实现：`GET /api/admin/competitions/:id/registrations`、`PATCH /api/admin/registrations/:id`；列表外层为 `items`，更新结果外层为 `item`，报名状态为 `pending`、`confirmed`、`rejected`。
- 管理员创建/编辑比赛时，规则字段最多 10,000 个字符；JSON 请求体上限为 64 KiB，以支持中文规则文本达到字段长度上限。
- 未登录的管理请求返回 `401`；未实现路径返回统一 JSON `404`。
- 错误响应格式为 `{"error":{"code":"...","message":"..."}}`。已使用的代码包括 `VALIDATION_ERROR`、`ORIGIN_NOT_ALLOWED`、`UNAUTHENTICATED`、`INVALID_CREDENTIALS`、`COMPETITION_NOT_FOUND`、`REGISTRATION_NOT_FOUND`、`NOT_FOUND`、`DUPLICATE_REGISTRATION`、`REGISTRATION_CLOSED`、`RATE_LIMITED`、`PAYLOAD_TOO_LARGE`、`INTERNAL_ERROR` 和 `SERVICE_UNAVAILABLE`。
- 报名管理状态为 `pending`、`confirmed`、`rejected`；已失效登录态调用 logout 返回 `401 UNAUTHENTICATED` 并清除 Cookie。

首次启动前复制 `.env.example` 为 `.env`，将 `SESSION_SECRET` 替换为本机随机生成的至少 32 字节秘密（例如 `openssl rand -hex 32`）。不要把 `.env` 或其内容提交到 Git。首次管理员通过 `npm run db:create-admin` 在交互式终端设置；密码输入不会回显，也不要发给 AI。

可通过 `HOST`、`PORT`、`DATABASE_PATH`、`SESSION_SECRET`、`COOKIE_SECURE` 和 `ALLOWED_ORIGINS` 环境变量配置服务。相对数据库路径以 `server/` 为基准，不依赖命令执行时的当前目录。`COOKIE_SECURE=true` 仅用于 HTTPS；本地 HTTP 开发默认 `false`。管理写请求必须携带允许来源的 `Origin`，允许列表默认为 Vite 开发源 `http://localhost:3000,http://127.0.0.1:3000`，部署时须显式设置 `ALLOWED_ORIGINS`。迁移文件位于 `server/migrations/`；已应用迁移会校验 SHA-256，不能原地修改，后续变更应添加新迁移。迁移操作不清空已有业务数据。

SQLite 使用 Node.js 内置的 `node:sqlite`，不需要单独安装或注册数据库平台；运行环境要求 Node.js 22.13 或更新版本。数据库文件、WAL 文件和备份不应提交到 Git，`server/data/` 已加入忽略规则。管理员会话存于同一 SQLite 文件，8 小时过期。

构建并运行：

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

这些命令在 `server/` 目录运行。开发模式使用 `npm.cmd run dev`；`npm.cmd start` 运行前需先 `npm.cmd run build`。`npm.cmd run db:migrate` 可安全重复运行。服务启动时也会自动应用未执行的迁移。
