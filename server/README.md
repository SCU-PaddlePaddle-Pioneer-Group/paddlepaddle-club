# 官网 API 服务（开发阶段）

当前提供 SQLite 数据库初始化、公开赛事查询/报名，以及管理员登录、比赛管理和报名管理 API。

```powershell
cd server
npm install
npm run db:create-admin
npm run db:migrate
npm run dev
```

默认监听 `http://127.0.0.1:3001`，默认数据库文件为 `server/data/club.sqlite`。首次启动会自动创建目录、数据库并应用尚未执行的迁移。

- `GET /api/health`：HTTP 服务和 SQLite 查询都成功时返回 `200 {"status":"ok"}`；数据库不可用时返回 `503`。
- `GET /api/competitions`、`GET /api/competitions/:id`：只读取已发布比赛；列表先显示尚未截止的比赛，再按截止时间升序，已截止赛事排后。
- `POST /api/competitions/:id/registrations`：校验报名信息、比赛状态和截止时间，成功后写入 SQLite；重复邮箱报名返回 `409`。
- `POST /api/admin/login`、`GET /api/admin/me`、`POST /api/admin/logout`：管理员登录态。
- 管理员比赛接口：`GET/POST /api/admin/competitions`、`PATCH /api/admin/competitions/:id`。
- 管理员报名接口：`GET /api/admin/competitions/:id/registrations`、`PATCH /api/admin/registrations/:id`。
- 未登录的管理请求返回 `401`；未实现路径返回统一 JSON `404`。
- 错误响应格式为 `{"error":{"code":"...","message":"..."}}`。已使用的代码包括 `VALIDATION_ERROR`、`ORIGIN_NOT_ALLOWED`、`UNAUTHENTICATED`、`INVALID_CREDENTIALS`、`COMPETITION_NOT_FOUND`、`REGISTRATION_NOT_FOUND`、`NOT_FOUND`、`DUPLICATE_REGISTRATION`、`REGISTRATION_CLOSED`、`RATE_LIMITED`、`PAYLOAD_TOO_LARGE`、`INTERNAL_ERROR` 和 `SERVICE_UNAVAILABLE`。

首次启动前复制 `.env.example` 为 `.env`，将 `SESSION_SECRET` 替换为本机随机生成的至少 32 字节秘密（例如 `openssl rand -hex 32`）。不要把 `.env` 或其内容提交到 Git。首次管理员通过 `npm run db:create-admin` 在交互式终端设置；密码输入不会回显，也不要发给 AI。

可通过 `HOST`、`PORT`、`DATABASE_PATH`、`SESSION_SECRET`、`COOKIE_SECURE` 和 `ALLOWED_ORIGINS` 环境变量配置服务。相对数据库路径以 `server/` 为基准，不依赖命令执行时的当前目录。`COOKIE_SECURE=true` 仅用于 HTTPS；本地 HTTP 开发默认 `false`。管理写请求必须携带允许来源的 `Origin`，允许列表默认为 Vite 开发源 `http://localhost:3000,http://127.0.0.1:3000`，部署时须显式设置 `ALLOWED_ORIGINS`。迁移文件位于 `server/migrations/`；已应用迁移会校验 SHA-256，不能原地修改，后续变更应添加新迁移。迁移操作不清空已有业务数据。

SQLite 使用 Node.js 内置的 `node:sqlite`，不需要单独安装或注册数据库平台；运行环境要求 Node.js 22.13 或更新版本。数据库文件、WAL 文件和备份不应提交到 Git，`server/data/` 已加入忽略规则。管理员会话存于同一 SQLite 文件，8 小时过期。

构建并运行：

```powershell
npm test
npm run build
npm start
```

`npm run db:migrate` 可安全重复运行。服务启动时也会自动应用未执行的迁移。
