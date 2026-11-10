# 官网 API 服务（开发阶段）

当前提供 SQLite 数据库初始化、健康检查、已发布比赛公开查询和报名提交；管理员认证及管理 API 尚未实现。

```powershell
cd server
npm install
npm run db:migrate
npm run dev
```

默认监听 `http://127.0.0.1:3001`，默认数据库文件为 `server/data/club.sqlite`。首次启动会自动创建目录、数据库并应用尚未执行的迁移。

- `GET /api/health`：HTTP 服务和 SQLite 查询都成功时返回 `200 {"status":"ok"}`；数据库不可用时返回 `503`。
- `GET /api/competitions`、`GET /api/competitions/:id`：只读取已发布比赛。
- `POST /api/competitions/:id/registrations`：校验报名信息、比赛状态和截止时间，成功后写入 SQLite；重复邮箱报名返回 `409`。
- 其他未实现路径返回统一 JSON `404`。

可通过 `HOST`、`PORT` 和 `DATABASE_PATH` 环境变量修改监听地址、端口和数据库文件路径。相对数据库路径以 `server/` 为基准，不依赖命令执行时的当前目录。迁移文件位于 `server/migrations/`；已应用的迁移会校验 SHA-256，不能原地修改，后续变更应添加新迁移。迁移操作不清空已有业务数据。

SQLite 使用 Node.js 内置的 `node:sqlite`，不需要单独安装或注册数据库平台；运行环境要求 Node.js 22.13 或更新版本。数据库文件、WAL 文件和备份不应提交到 Git，`server/data/` 已加入忽略规则。

构建并运行：

```powershell
npm test
npm run build
npm start
```

`npm run db:migrate` 可安全重复运行。服务启动时也会自动应用未执行的迁移。
