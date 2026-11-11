# C 工作开发文档：后台与数据库

日期：2026 年 11 月 10 日
适用范围：社团官网动态化 Demo 的 C 负责人
关联任务：`官网动态化Demo分工细则.md` 第 6、8、9、10、13、14 节

关于 AI 可协助范围、当前工作区限制及 C 必须亲自确认/执行的事项，见[《C工作执行边界与本人待办》](C工作执行边界与本人待办.md)。

## 1. 目标与交付边界

C 负责实现赛事 Demo 的服务端与数据库，使官网从静态展示具备真实数据流：

> 管理员登录 → 管理比赛 → 公开赛事信息 → 用户报名 → 管理员处理报名 → 服务重启后数据仍在

本周的交付必须包括：

- 独立的 `server/` Node.js + TypeScript + Express 服务。
- SQLite 数据库、可重复执行的迁移和首次管理员初始化工具。
- 管理员登录态与全部管理接口鉴权。
- 公开赛事查询、报名写入、比赛管理、报名查询和处理状态更新接口。
- 服务端字段、权限、截止时间、重复报名和错误响应校验。
- `.env.example`、启动/验证命令、数据库路径和备份说明。
- API 调用示例，以及与 B、D 联调所需的接口交接记录。

C 不负责赛事页面、管理页面、首页和前端路由；不直接修改前端页面。前端仍由 Vite 构建为静态资源，浏览器通过 `/api` 请求本服务。

## 2. 源码现状与集成原则

开发时以官网仓库当前实现为准：[paddlepaddle-club](https://github.com/SCU-PaddlePaddle-Pioneer-Group/paddlepaddle-club)。

查看源码所得的集成事实：

- 现有官网是 React、TypeScript、Vite 的静态前端，`package.json` 目前没有 Express 或 SQLite 服务端依赖。
- `src/main.tsx` 使用 `HashRouter`；应用路由在 `src/App.tsx`。赛事和管理页的 URL 是前端路由，不能当作 API 地址。
- `vite.config.ts` 的开发端口目前是 `3000`。本地开发时由 B 在 Vite 配置 `/api` 代理；C 约定后端默认监听 `3001`，需与 B 一起确认可用端口。
- 生产构建输出 `dist/`，GitHub Pages 只能托管静态文件，不能运行 Express 或保存 SQLite 文件。需要动态 API 的演示环境必须同时启动后端；正式部署需为 API 提供可达的服务和持久化磁盘。

接口基址由前端统一使用相对路径 `/api`。不要要求页面各自硬编码后端主机名，也不要把后台页面或管理接口加进静态前端构建。

## 3. 技术约定与目录建议

### 3.1 技术边界

- Node.js + TypeScript + Express；数据库 SQLite。
- 服务端作为独立 npm 工程放在 `server/`，不得把后端依赖混入前端根目录的 `package.json`，除非 B 明确协调后决定改为 monorepo workspace。
- 所有运行配置从环境变量读取；提交 `.env.example`，不提交 `.env`、真实账号密码、数据库文件、日志或会话数据。
- 使用参数化 SQL；数据库启用外键约束。初始化/迁移不得删除已有报名。
- 认证使用随机服务端会话 ID + HttpOnly Cookie；密码只存强哈希，不存明文或可逆加密值。

### 3.2 推荐目录

```text
server/
├── package.json
├── tsconfig.json
├── .env.example
├── migrations/
│   ├── 001_initial.sql
│   └── ...
├── src/
│   ├── app.ts                 # Express app 装配，不在此处启动监听
│   ├── index.ts               # 读取配置并启动服务
│   ├── config.ts              # 环境变量解析与校验
│   ├── db/
│   │   ├── connection.ts
│   │   └── migrate.ts
│   ├── middleware/
│   │   ├── requireAdmin.ts
│   │   ├── errorHandler.ts
│   │   └── verifyOrigin.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── competitions.ts
│   │   ├── registrations.ts
│   │   └── admin.ts
│   ├── services/              # 报名与比赛业务规则
│   ├── repositories/          # 数据库读写
│   ├── validation/            # 请求体校验
│   └── scripts/
│       └── createAdmin.ts
└── data/                      # 运行时数据库目录，不提交
```

允许按实际实现合并小文件，但路由、业务规则、数据库访问和启动脚本要有清晰边界。不要在路由处理器里复制多份截止、状态或邮箱规范化逻辑。

### 3.3 初始命令约定

`server/package.json` 至少提供下列命令，脚本名可与团队讨论后统一：

```text
npm run dev            # 本地热重载
npm run build          # TypeScript 编译
npm start              # 运行编译产物
npm run db:migrate     # 应用尚未执行的迁移
npm run db:create-admin # 交互式创建首个管理员
npm test               # 运行服务端测试
```

若当前实现暂未有完整测试框架，至少提供可自动执行的接口冒烟测试并在交接时说明。不要把“能启动”当作所有 API 已验证。

## 4. 配置、启动和运行数据

建议 `.env.example` 字段：

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3001
DATABASE_PATH=./data/club.sqlite
SESSION_SECRET=replace-with-a-random-secret-of-at-least-32-bytes
SESSION_TTL_HOURS=8
COOKIE_SECURE=false
```

要求：

1. 启动时校验必要配置；缺失或格式错误时打印明确错误并以非零状态退出，不要回退为固定秘密或内存数据库。
2. `SESSION_SECRET` 必须随机生成且不提交。`COOKIE_SECURE=false` 仅用于本机 HTTP 开发；对外 HTTPS 部署必须设为 `true`。
3. 使用稳定的绝对数据库路径，避免因执行命令时当前工作目录不同而创建多份数据库。启动日志只打印数据库路径和监听地址，不输出 Cookie、密钥、密码、报名邮箱或请求体。
4. SQLite 数据库和备份文件位于 `server/data/`（或部署者显式配置的持久化目录），纳入 `.gitignore`。迁移只增不毁；备份通过停止服务后复制数据库，或使用 SQLite 在线备份机制。
5. `/api/health` 只报告服务和数据库是否可用，不返回环境变量、路径、版本密钥或管理员信息。
6. 正常关闭时关闭数据库连接；运行错误需写入标准错误/结构化日志，并以非成功响应返回。

本地启动顺序：

```text
终端 1：进入 server/，安装依赖，复制 .env.example 为 .env，设置本机 SESSION_SECRET
终端 1：运行迁移，交互式创建管理员，启动服务
终端 2：在官网根目录运行 npm run dev（由 B 配置 Vite /api 代理）
浏览器：打开 http://localhost:3000；API 健康检查为 http://localhost:3001/api/health
```

不要在文档、命令历史或截图中放入真实管理员密码。

## 5. 数据模型

表名采用 `snake_case`；所有时间存 UTC 的 ISO 8601/RFC 3339 字符串，带 `Z` 或明确时区。前端按北京时间显示。数据库由 SQLite 生成的主键 ID 应作为不透明字符串返回 API，不让前端依赖 ID 的内部格式。

### 5.1 `admins`

| 字段 | 约束 | 说明 |
|---|---|---|
| `id` | 主键 | 管理员 ID |
| `username` | 非空、唯一 | 去除首尾空格；用户名大小写规则固定并统一 |
| `password_hash` | 非空 | 使用密码哈希算法生成，绝不返回 API |
| `created_at` | 非空 | UTC 创建时间 |

不实现管理员公开注册、改密、找回密码或删除管理员。首个管理员由受控初始化命令创建；创建第二个账号必须是明确的运维操作。

### 5.2 `competitions`

| 字段 | 约束 | 说明 |
|---|---|---|
| `id` | 主键 | 比赛 ID |
| `title` | 非空 | 标题 |
| `summary` | 非空 | 列表/首页摘要 |
| `rules` | 非空 | 详情规则文本；纯文本/安全渲染，不作为 HTML 执行 |
| `registration_deadline` | 非空 | 带时区的截止时间 |
| `status` | CHECK：`draft` / `published` / `offline` | 草稿、已发布、已下架 |
| `created_at` | 非空 | UTC 创建时间 |
| `updated_at` | 非空 | 每次成功编辑时更新 |

比赛不提供删除接口。下架只更新状态，报名记录保留。截止时间是独立于发布状态的业务条件；已发布但截止时间已过的比赛仍可公开查看，但不可报名。

### 5.3 `registrations`

| 字段 | 约束 | 说明 |
|---|---|---|
| `id` | 主键 | 报名编号，提交成功后返回 |
| `competition_id` | 非空、外键 | 关联比赛；不可因比赛下架而级联删除报名 |
| `name` | 非空 | 报名人姓名 |
| `email` | 非空 | 经去空格、转小写后的邮箱 |
| `status` | CHECK：`pending` / `confirmed` / `rejected` | 初始为待处理 |
| `created_at` | 非空 | UTC 提交时间 |

必须建立 `UNIQUE(competition_id, email)`，并为 `competition_id`、`created_at` 建索引。邮箱唯一性必须由数据库约束兜底，不能只依赖先查询再插入。

### 5.4 迁移与事务

- 启用 `PRAGMA foreign_keys = ON`；合理配置 busy timeout，并可使用 WAL 模式改善单机并发读写。
- 使用版本化迁移表记录已应用迁移；同一迁移不可重复执行副作用。
- 比赛创建/编辑、报名创建和报名状态更新必须按业务需要使用事务。
- 报名流程先在同一事务内读取比赛状态和截止时间，再写入报名；依靠唯一约束最终解决并发重复提交。把唯一约束冲突映射为 `409 DUPLICATE_REGISTRATION`。
- 状态更新只接受明确允许的目标状态；未知状态不可静默保存。

## 6. API 契约

### 6.1 通用约定

- API 前缀：`/api`；成功响应为 JSON，UTF-8。
- 日期时间必须为含时区的 ISO 8601 字符串。比较截止时间时统一转成 UTC 时间点。
- 错误响应统一为：

```json
{
  "error": {
    "code": "DUPLICATE_REGISTRATION",
    "message": "该邮箱已报名此比赛"
  }
}
```

- 错误消息可供用户阅读；不返回 SQL、堆栈、磁盘路径、密码哈希、Cookie/session ID 或内部配置。
- 输入校验错误为 `400`；未登录/会话无效为 `401`；不存在或公开不可见为 `404`；重复报名、已截止等业务冲突为 `409`；频率限制为 `429`；未预期错误为 `500`。
- 所有接口设置合理 JSON body 大小上限；拒绝畸形 JSON 和未知字段（或明确忽略并记录，团队应统一，推荐拒绝）。
- 接口字段命名使用 camelCase；DB snake_case 仅存在于后端内部。

### 6.2 健康检查

`GET /api/health`（公开）

成功 `200`：

```json
{ "status": "ok" }
```

数据库不可用时返回 `503`，消息不暴露底层错误。

### 6.3 公开比赛列表

`GET /api/competitions`（公开）

只返回 `published` 比赛，不返回草稿、下架内容和报名数据。响应示例：

```json
{
  "items": [
    {
      "id": "competition-id",
      "title": "比赛标题",
      "summary": "比赛简介",
      "rules": "比赛规则",
      "registrationDeadline": "2026-11-20T15:59:00.000Z",
      "status": "published",
      "createdAt": "2026-11-10T02:00:00.000Z",
      "updatedAt": "2026-11-10T02:00:00.000Z",
      "registrationOpen": true
    }
  ]
}
```

列表只返回 `published`，按 `createdAt` 倒序；创建时间相同时按 `id` 升序，保证顺序稳定。首页适配层从列表取前 3 条，并使用 `id`、`title`、`summary`、`registrationDeadline`、`status` 字段。列表项还包含详情所需的 `rules`、`createdAt`、`updatedAt` 和 `registrationOpen`；首页可以只选用所需字段。截止时间不改变列表顺序，已截止赛事仍可显示并标记 `registrationOpen: false`。当前实现与 C 侧确认一致。

### 6.4 公开比赛详情

`GET /api/competitions/:id`（公开）

- 只查得到 `published` 比赛；草稿、下架及不存在的 ID 一律 `404 COMPETITION_NOT_FOUND`，避免公开接口泄漏内部状态。
- 返回同一比赛字段及 `registrationOpen`；不返回报名数量、邮箱、管理员 ID 或内部备注。

### 6.5 提交报名

`POST /api/competitions/:id/registrations`（公开）

请求：

```json
{
  "name": "张同学",
  "email": "student@example.edu"
}
```

成功 `201`：

```json
{
  "item": {
    "id": "registration-id",
    "competitionId": "competition-id",
    "status": "pending",
    "createdAt": "2026-11-10T02:30:00.000Z"
  }
}
```

服务端顺序和结果：

1. 校验 ID、姓名和邮箱，去除姓名首尾空白，邮箱去首尾空格并转小写。
2. 检查比赛存在、状态为 `published` 且 `now < registrationDeadline`；下架/草稿/不存在返回 `404`，截止返回 `409 REGISTRATION_CLOSED`。
3. 尝试插入报名；重复邮箱返回 `409 DUPLICATE_REGISTRATION`。
4. 返回真实生成的报名编号，不得在数据库写入成功前返回成功。

公共 API 不应返回邮箱及个人报名数据。不要通过不同错误消息泄露该邮箱是否在其他比赛报名。

### 6.6 管理员登录态

#### `POST /api/admin/login`

请求：

```json
{ "username": "admin", "password": "输入的密码" }
```

成功 `200`：设置 session Cookie，响应中仅返回公开管理员字段：

```json
{ "admin": { "id": "admin-id", "username": "admin" } }
```

账号或密码错误统一返回 `401 INVALID_CREDENTIALS`，不区分账号是否存在。登录接口加频率限制；不要记录密码或返回账户哈希。

#### `GET /api/admin/me`

有效会话返回 `{ "admin": { "id": "...", "username": "..." } }`；否则返回 `401 UNAUTHENTICATED`。

#### `POST /api/admin/logout`

验证有效会话后销毁服务端会话并清除 Cookie；成功 `200` 返回 `{ "ok": true }`。会话缺失或失效时返回 `401 UNAUTHENTICATED`，同时清除客户端 Cookie。D 端可在收到该 401 后清理登录态并跳转登录页；已注销的旧 Cookie 不可继续访问管理路由。

### 6.7 管理比赛

以下路由均要求管理员登录：

| 方法 | 路径 | 用途 | 成功状态 |
|---|---|---|---|
| `GET` | `/api/admin/competitions` | 查询所有状态比赛 | `200` |
| `POST` | `/api/admin/competitions` | 新建草稿 | `201` |
| `PATCH` | `/api/admin/competitions/:id` | 更新比赛内容或状态 | `200` |

新建请求：

```json
{
  "title": "比赛标题",
  "summary": "列表简介",
  "rules": "比赛规则",
  "registrationDeadline": "2026-11-20T15:59:00.000Z"
}
```

创建时状态由服务端设为 `draft`。编辑请求只更新传入的允许字段；`status` 仅接受 `draft`、`published`、`offline`。切换为 `published` 前校验标题、简介、规则和有效截止时间格式；已截止但仍发布的比赛视为已关闭报名，而不是允许继续提交。

管理列表需要返回状态和时间字段，不包含密码/session 字段。不存在的比赛返回 `404 COMPETITION_NOT_FOUND`。任何下架操作应即时影响公开查询和报名接口，无需重启服务。

### 6.8 管理报名

| 方法 | 路径 | 用途 | 成功状态 |
|---|---|---|---|
| `GET` | `/api/admin/competitions/:id/registrations` | 查询某比赛报名 | `200` |
| `PATCH` | `/api/admin/registrations/:id` | 修改报名处理状态 | `200` |

管理列表响应为 `{ "items": [...] }`，项字段为 `id`、`competitionId`、`name`、`email`、`status`、`createdAt`。只向已认证管理员暴露报名个人信息。报名状态为 `pending`（待处理）、`confirmed`（已确认）、`rejected`（已拒绝）；报名列表按 `createdAt ASC`、同时间按 `id ASC` 排序。D 请确认页面文案是否采用上述映射。

更新请求：

```json
{ "status": "confirmed" }
```

允许目标值只有 `pending`、`confirmed`、`rejected`。成功后返回更新后的记录；未知状态 `400 VALIDATION_ERROR`，ID 不存在 `404 REGISTRATION_NOT_FOUND`。

## 7. 服务端校验与安全要求

浏览器端校验仅用于改善体验，不能替代后端验证。

### 7.1 字段校验

- 字符串先检查类型，再规范化；拒绝空白必填值、超长内容和异常类型。
- 姓名、标题、简介、规则字段限制合理最大长度，并与 B、D 的表单约定一致。建议首版上限：姓名 80、标题 120、简介 1000、规则 10000 个字符。
- 邮箱长度不超过 254；执行基本格式校验，不尝试发送验证邮件。本 Demo 不验证邮箱真实归属。
- 时间必须可解析且含时区；拒绝 `NaN`、无时区本地时间及非法日期。
- `status` 使用白名单；不能把用户提供的任意字段直接展开写入 SQL。
- 规则内容按纯文本处理。若将来允许 Markdown/HTML，需安全渲染或清洗，禁止直接注入 `dangerouslySetInnerHTML`。

### 7.2 身份认证与会话

- 密码使用成熟的自适应单向哈希算法及安全参数；禁止明文、固定盐或自制算法。
- Cookie 至少设置 `HttpOnly`、`SameSite=Lax`、明确过期时间和 `Path=/`；HTTPS 环境加 `Secure`。
- 登录成功后轮换 session ID，避免会话固定；退出时服务端销毁 session。
- 所有 `/api/admin/*` 管理读写接口（登录接口除外）逐个经过后端鉴权，不能依赖 React 隐藏按钮。
- 不使用只存在进程内存的开发 MemoryStore 作为正式会话存储。SQLite session store 与业务库可同目录，但需清楚区分会话数据表和业务表。
- 写接口校验 `Origin`/请求来源，仅允许约定的前端开发源和部署源；禁止通配 CORS 与反射任意来源。使用 Vite 同源 `/api` 代理可避免本地跨域。
- 如果前端与 API 被部署到不同站点，Cookie 的 SameSite、Secure、CORS 和 CSRF 需要重新评估；优先通过同站点反向代理部署，不要默认假设 GitHub Pages 与任意 API 域名的 Cookie 可以工作。

### 7.3 个人信息、输入及错误

- 报名信息只在管理 API 中返回；日志不记录报名请求体、邮箱、密码、session ID。
- SQL 一律参数化；数据库唯一约束、外键和状态 CHECK 约束必须启用。
- 设置请求体大小限制、登录限速和合理的安全响应头；生产环境 HTTPS。
- 统一错误处理中间件；预期业务错误映射成已约定的状态码和 `error.code`。未预期异常记服务端日志并返回通用 `500 INTERNAL_ERROR`，不能静默吞错或返回伪成功。
- ID 格式、请求字段和状态要在入口校验；不能用 `as any`/未经校验的对象强转来绕过 TypeScript。

## 8. 推荐实现顺序与联调交付

按以下顺序让前端可以增量接入：

### 阶段 1：骨架与数据库

- 新建 `server/` 独立工程；明确 Node 版本、脚本、端口和 `.env.example`。
- 建立迁移、数据库连接、健康检查和统一错误格式。
- 验证重复运行迁移不会清空数据；确认数据库文件被忽略，不会进入 Git。
- 交付：B 可从本机访问 `GET /api/health`。

### 阶段 2：公开查询和报名

- 完成比赛表、公开列表/详情、报名表、唯一约束和事务报名流程。
- 用 HTTP 请求验证草稿/下架不可见、有效比赛可查、成功返回真实报名 ID、重复报名冲突、截止拒绝。
- 交付：B 可先接公开列表、详情和真实报名。

### 阶段 3：认证和管理 API

- 完成管理员初始化、密码哈希、会话 Cookie、me/logout、管理接口鉴权和来源校验。
- 完成比赛草稿编辑/发布/下架及报名查询/状态更新。
- 交付：D 可接登录、比赛维护和报名管理页面。

### 阶段 4：持久化、失败场景和交接

- 重启服务后验证比赛、报名和处理状态仍保留。
- 检查 401、404、409、无效字段、非法时间、无效状态、数据库错误等响应。
- 更新 API 示例与本开发文档中实际不一致之处；向 B、D 提供接口可用地址、字段差异、启动步骤和已知限制。
- 与 B 确认 Vite 代理路径和端口，与 D 确认状态文字及报名字段。

接口一批交付即通知使用者，不要等所有管理功能完成才开放联调。接口发生不兼容变更前，先通知 B、D 并同步更新 API 文档。

## 9. 验证清单

每次交付最少运行构建/类型检查、迁移检查和以下 API 场景。命令以 `server/package.json` 最终脚本为准。

### 9.1 正常流程

- [ ] 服务健康检查成功；错误配置启动失败且原因明确。
- [ ] 首次管理员创建成功，数据库中仅出现哈希，不出现明文密码。
- [ ] 管理员登录后 `GET /api/admin/me` 成功，退出后再请求管理接口返回 401。
- [ ] 未登录时逐个直接请求每种管理接口均返回 401。
- [ ] 新建草稿后公开列表和详情都不可见。
- [ ] 发布后公开列表和详情可见；修改内容后前端刷新能读到新数据。
- [ ] 下架后详情不可见，并且直接提交报名也被服务端拒绝。
- [ ] 有效比赛报名返回 `201` 和真实 ID；管理报名接口查到同一条记录。
- [ ] 管理员更新报名状态后重新查询仍是新状态。
- [ ] 重启服务后比赛、报名、状态仍存在。

### 9.2 边界与安全流程

- [ ] 同一比赛相同规范化邮箱重复提交（含大小写和首尾空格差异）只有一条记录，后续请求为 409。
- [ ] 在截止时间等于或晚于当前时刻提交均被拒绝；截止判断由服务端时间完成。
- [ ] 空标题、超长字段、格式错误邮箱、无时区日期和未知状态不能写入数据库。
- [ ] 草稿、下架及不存在的比赛对公开接口都不泄漏详情或报名数据。
- [ ] 公开列表、详情和错误响应都没有报名人姓名/邮箱。
- [ ] 篡改 Cookie、退出后复用旧 Cookie、伪造/缺失请求来源不能执行管理写操作。
- [ ] 登录失败不区分账号不存在与密码错误；尝试频率受限。
- [ ] 数据库异常或未知异常不会返回成功，也不会将堆栈/SQL 返回浏览器。
- [ ] 初始化和迁移不会删除现有报名；数据库、`.env`、日志、备份没有进入 Git。

联调时使用虚构报名数据。不要把真实个人信息用于测试或截图。

## 10. 错误代码建议

| HTTP | `error.code` | 场景 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 缺字段、类型、长度、邮箱、时间或状态无效 |
| 403 | `ORIGIN_NOT_ALLOWED` | 管理员请求的 `Origin` 不在允许列表中 |
| 401 | `UNAUTHENTICATED` | 管理接口没有有效会话 |
| 401 | `INVALID_CREDENTIALS` | 用户名或密码不正确 |
| 404 | `COMPETITION_NOT_FOUND` | 比赛不存在，或公开查询目标不是已发布比赛 |
| 404 | `REGISTRATION_NOT_FOUND` | 报名记录不存在 |
| 404 | `NOT_FOUND` | 未匹配到 API 路由 |
| 409 | `DUPLICATE_REGISTRATION` | 同一比赛邮箱已报名 |
| 409 | `REGISTRATION_CLOSED` | 比赛已发布但报名截止时间已过；草稿、下架或不存在的比赛按 404 处理 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过大小限制 |
| 429 | `RATE_LIMITED` | 登录等敏感操作请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 未预期服务端错误 |
| 503 | `SERVICE_UNAVAILABLE` | 健康检查发现服务依赖不可用 |

错误响应统一为 `{ "error": { "code": "...", "message": "..." } }`。以上错误码按当前实现整理；B、D 需确认客户端是否依赖具体 `message` 文案，业务判断应使用稳定的 HTTP 状态码和 `error.code`。

## 11. 完成定义与交接内容

C 的工作满足以下全部条件才算完成：

1. 服务可按文档在干净环境启动，配置缺失时明确失败。
2. API 字段和状态与团队共同约定一致；所有管理接口在后端做认证。
3. 数据库迁移可重复运行且不丢数据，业务数据重启后持久化。
4. 重复报名、截止、下架、无效输入和登录失效的验收项通过。
5. B 能使用真实公开 API 和报名 API；D 能使用登录、比赛管理和报名管理 API。
6. `server/`、`.env.example`、迁移、管理员初始化方式、测试命令及数据备份位置已提交到 C 的分支/PR。
7. 交接说明包含已实现接口、实际启动命令、联调地址、测试结果、未完成项和已知风险；不包含秘密或真实报名数据。

## 12. 明确不做的事项

本周不实现普通用户账号、团队报名、上传、验证码/邮件、作品评测、排行榜、报名导出、多管理员权限体系、管理员自助注册、在线数据库迁移 UI 或生产级云平台部署。新需求先评估是否影响主流程和截至日期，再由团队确认。

上线正式收集报名数据之前，需另外完成 HTTPS、生产 Cookie/CORS/CSRF 策略、备份恢复演练、访问日志隐私评估、数据库权限和运维监控；本地 Demo 通过验收不代表已达到生产开放报名标准。
