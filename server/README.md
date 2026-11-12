# 官网 API 服务（开发阶段）

当前提供 SQLite 数据库初始化、公开赛事查询/报名，以及管理员登录、比赛管理和报名管理 API。

在 Windows PowerShell 中按以下步骤安装、配置并启动后端（需要 Node.js `>=22.13`）。先在仓库根目录打开 PowerShell；`.env` 配置只需首次创建，迁移可安全重跑。若只测试公开赛事接口，可跳过创建管理员的步骤。

**终端 1：后端安装、初始化和开发启动**

```powershell
Set-Location .\server
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

**终端 2：在仓库根目录打开新的 PowerShell；B 配置好 `/api` 代理后运行前端**

```powershell
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
- 管理员身份在每个管理请求中都通过数据库确认；管理员记录被撤销后，旧会话会被删除并清除 Cookie，管理接口返回 `401`。
- 管理员创建/编辑比赛时，规则字段最多 10,000 个字符；JSON 请求体上限为 64 KiB，以支持中文规则文本达到字段长度上限。
- 未登录的管理请求返回 `401`；未实现路径返回统一 JSON `404`。
- 错误响应格式为 `{"error":{"code":"...","message":"..."}}`。已使用的代码包括 `VALIDATION_ERROR`、`ORIGIN_NOT_ALLOWED`、`UNAUTHENTICATED`、`INVALID_CREDENTIALS`、`COMPETITION_NOT_FOUND`、`REGISTRATION_NOT_FOUND`、`NOT_FOUND`、`DUPLICATE_REGISTRATION`、`REGISTRATION_CLOSED`、`RATE_LIMITED`、`PAYLOAD_TOO_LARGE`、`INTERNAL_ERROR` 和 `SERVICE_UNAVAILABLE`。
- 报名管理状态为 `pending`、`confirmed`、`rejected`；已失效登录态调用 logout 返回 `401 UNAUTHENTICATED` 并清除 Cookie。

首次启动前复制 `.env.example` 为 `.env`，将 `SESSION_SECRET` 替换为本机随机生成的至少 32 字节秘密（例如 `openssl rand -hex 32`）。不要把 `.env` 或其内容提交到 Git。首次管理员通过 `npm run db:create-admin` 在交互式终端设置；密码输入不会回显，也不要发给 AI。

可通过 `HOST`、`PORT`、`DATABASE_PATH`、`SESSION_SECRET`、`COOKIE_SECURE`、`ALLOWED_ORIGINS`、`TRUSTED_PROXY_ADDRESSES` 及下列报名限流环境变量配置服务：

- `REGISTRATION_RATE_LIMIT_WINDOW_MS`：统计窗口毫秒数，默认 `900000`（15 分钟）。
- `REGISTRATION_RATE_LIMIT_PER_SOURCE`：每来源每窗口最多报名请求数，默认 `60`。
- `REGISTRATION_RATE_LIMIT_PER_COMPETITION`：每赛事每窗口最多报名请求数，默认 `300`。
- `REGISTRATION_RATE_LIMIT_PER_SOURCE_COMPETITION`：每来源对单个赛事每窗口最多请求数，默认 `5`。

赛事级阈值必须高于来源+赛事阈值，确保单一来源不能耗尽赛事额度。超限返回 `429 RATE_LIMITED` 和 `Retry-After` 秒数；请求仅在限流通过后进入报名校验/写入。限流状态只存于当前 Node 进程，窗口过期后自动回收；来源状态最多 `10,000` 个，每个来源最多跟踪 `100` 个赛事，赛事状态最多 `10,000` 个，达到边界时淘汰最早状态。首次触发超限时写一条 JSON 告警日志，不包含来源地址、请求体、报名信息或会话数据。`request.ip` 默认只识别直接连接来源，不信任客户端自行提供的转发头；反向代理部署须与可信代理配置配套（参见 issue #21），否则代理后的用户可能被视为同一来源。多进程/多副本部署的限流状态彼此独立；需要跨实例统一额度时，应在扩容前接入共享限流存储或入口层限流，不能依赖会话粘性来共享额度。

`TRUSTED_PROXY_ADDRESSES` 为可信反向代理的地址或 CIDR 逗号分隔列表，默认空值（不信任代理）；支持 Express `proxy-addr` 的已知名称（例如 `loopback`）。部署时只配置后端实际观察到的代理地址/网段，不能设置通配范围。只有来自该范围的代理转发信息才用于 `request.ip` 与 HTTPS 判定。入口代理必须覆盖而不是沿用客户端提交的 `X-Forwarded-For`、`X-Forwarded-Proto` 和 `X-Forwarded-Host`，例如 Nginx：

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
```

HTTPS 反向代理部署应设置 `COOKIE_SECURE=true` 并配置准确的 `TRUSTED_PROXY_ADDRESSES`；本地 HTTP 开发保持 `COOKIE_SECURE=false` 且可信代理列表留空。管理写请求必须携带允许来源的 `Origin`，允许列表默认为 Vite 开发源 `http://localhost:3000,http://127.0.0.1:3000`，部署时须显式设置 `ALLOWED_ORIGINS`。迁移文件位于 `server/migrations/`；校验 SHA-256 时会统一换行符，因此 LF/CRLF 差异不会阻止打开既有数据库，但 SQL 内容变更仍会报错。已应用的迁移不可修改，后续变更应添加新迁移。迁移操作不清空已有业务数据。

SQLite 使用 Node.js 内置的 `node:sqlite`，不需要单独安装或注册数据库平台；运行环境要求 Node.js 22.13 或更新版本。数据库文件、WAL 文件和备份不应提交到 Git，`server/data/` 已加入忽略规则。管理员会话存于同一 SQLite 文件，8 小时过期。

构建并运行：

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

这些命令在 `server/` 目录运行。开发模式使用 `npm.cmd run dev`；`npm.cmd start` 运行前需先 `npm.cmd run build`。`npm.cmd run db:migrate` 可安全重复运行。服务启动时也会自动应用未执行的迁移。
