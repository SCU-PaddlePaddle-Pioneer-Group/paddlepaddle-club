# 赛事 Demo 接口契约 v0.2

更新：2026-11-10。B 维护；公开接口外层按会长最新约定统一为列表 `items`、单条/报名结果 `item`。已静态对照 C 分支提交 `3322669a1f1c787f9f830ee53ee54ac95089df4a` 的实际实现；运行验证结果另记在 B 交接文档。此文件取代 v0.1 的 `{data:...}` 草案，仓库其他旧文档若仍写 data，应由所属负责人更新。

代码核对不等于全组验收。A 首页适配、A 的正式路由接入、D 管理页接接口和完整人工演示仍需各负责人确认。变更此契约必须同步 A/B/C/D。

## 1. 已统一的基础约定

| 项目 | 约定 / 实际实现 |
| --- | --- |
| 同源地址 | 前端请求 `/api`，开发时前端 3000 转发后台 3001 |
| 列表外层 | `{"items": [...]}`；空列表 `{"items":[]}` |
| 单条与报名外层 | `{"item": {...}}` |
| 例外接口 | health 返回 `{status:"ok"}`；login/me 返回 `{admin:{id,username}}`；logout 返回 `{ok:true}` |
| 错误 | `{"error":{"code":"业务代码","message":"可读提示"}}` |
| id | 非空字符串，C 新建记录使用 UUID；不要转换成数字 |
| 赛事排序 | 后台 `createdAt DESC, id ASC`；B 保留顺序，A 取前 3 条 |
| 报名管理列表排序 | C 当前为 `createdAt ASC, id ASC`，与赛事列表不同 |
| 时间 | 带时区 ISO 8601；后台保存规范化 UTC，页面显示北京时间 |
| 身份 | 普通报名无需登录；管理接口由 Cookie 会话鉴权，无普通用户注册 |

## 2. 数据字段与校验

比赛：`id,title,summary,rules,registrationDeadline,status,createdAt,updatedAt`。
状态：`draft | published | offline`。公开接口只返回 published；过期仍可查看。
公开响应另有 `registrationOpen` 布尔值，表示响应时后台判断的报名开放状态。前台提示/按钮不能替代提交时的后台校验；后台在 `now >= deadline` 时拒绝报名。

首页必需字段：`id,title,summary,registrationDeadline,status`，从公开列表取前 3 条。
规则为纯文本，保留换行，不渲染 HTML。

报名：`id,competitionId,name,email,status,createdAt`。公开报名成功回执只含 `id,competitionId,status,createdAt`，没有完整报名名单。
状态：`pending | confirmed | rejected`，提交默认 pending。
后台只接收 name/email；姓名去首尾空格后 1-80 字符，邮箱去空格/转小写后不超过 254 字符并校验格式。同赛事与规范化邮箱建立唯一约束。

管理编辑字段限制（C 当前实现）：title 1-120、summary 1-1000、rules 1-10000 字符，均 trim 后校验；截止时间必须含秒和时区。请求 JSON 上限 64 KiB。新建默认 draft，id/createdAt 不由前端指定。

## 3. 公开接口

### GET /api/health

成功 `200 {"status":"ok"}`；后台执行 SQLite 查询后返回，不是静态页面。数据库故障 `503 SERVICE_UNAVAILABLE`。

### GET /api/competitions

无请求体，本周全量列表。以下均为文档示例数据：

```json
{
  "items": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "接口示例比赛（非正式赛事）",
    "summary": "仅供联调",
    "rules": "个人报名。请阅读规则。",
    "registrationDeadline": "2026-11-20T10:00:00.000Z",
    "status": "published",
    "createdAt": "2026-11-10T02:00:00.000Z",
    "updatedAt": "2026-11-10T02:00:00.000Z",
    "registrationOpen": true
  }]
}
```

### GET /api/competitions/:id

成功 200，外层 `{"item": 上述单个比赛对象}`。id 需 URL 编码；不存在、草稿或下架均 `404 COMPETITION_NOT_FOUND`。

### POST /api/competitions/:id/registrations

```json
{"name":"演示同学","email":"demo@example.com"}
```

成功 201（数据库保存后才返回）：

```json
{
  "item": {
    "id": "22222222-2222-4222-8222-222222222222",
    "competitionId": "11111111-1111-4111-8111-111111111111",
    "status": "pending",
    "createdAt": "2026-11-10T03:00:00.000Z"
  }
}
```

字段错误 400；不存在/非公开 404；重复或截止 409。网络中断可能发生在保存之后，前端不得自动重试 POST 或断言未保存。先提示核实结果，再由用户决定重试。

## 4. 管理接口（D 对照接入）

所有管理写操作要求合法 Origin；除登录外要求会话。浏览器经同源 `/api` 携带 Cookie。密码/哈希不得出现在返回数据中。

| 方法与地址 | 请求 | 成功响应 |
| --- | --- | --- |
| POST /api/admin/login | `{username,password}`，只发送本人输入，不写进源码 | 200 `{admin:{id,username}}`，后台设置 HttpOnly Cookie |
| GET /api/admin/me | 无 | 200 `{admin:{id,username}}` |
| POST /api/admin/logout | 无 | 200 `{ok:true}`，清会话/Cookie；失效时 401 并清 Cookie |
| GET /api/admin/competitions | 无 | 200 `{items:[比赛对象]}`，包含各状态 |
| POST /api/admin/competitions | `{title,summary,rules,registrationDeadline}` | 201 `{item:比赛对象}`，初始 draft |
| PATCH /api/admin/competitions/:id | 非空的允许字段子集，含可选 status | 200 `{item:更新后的比赛对象}` |
| GET /api/admin/competitions/:id/registrations | 无 | 200 `{items:[报名对象]}`，仅管理员可见 name/email |
| PATCH /api/admin/registrations/:id | `{status:"confirmed"}` 等合法状态，仅一个字段 | 200 `{item:更新后的报名对象}` |

PATCH 比赛允许 title/summary/rules/registrationDeadline/status；不能删除比赛，使用 offline。
管理员初始化由 C 的命令完成，不做管理员注册/找回密码。

## 5. 错误代码（已与 C 源码核对）

```json
{"error":{"code":"DUPLICATE_REGISTRATION","message":"该邮箱已报名此比赛"}}
```

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 字段、格式、非法状态或无效 JSON |
| 401 | INVALID_CREDENTIALS | 登录账号或密码错误 |
| 401 | UNAUTHENTICATED | 管理会话缺失/失效 |
| 403 | ORIGIN_NOT_ALLOWED | 管理写请求来源不允许 |
| 404 | COMPETITION_NOT_FOUND / REGISTRATION_NOT_FOUND / NOT_FOUND | 记录不可见、不存在或未知接口 |
| 409 | DUPLICATE_REGISTRATION / REGISTRATION_CLOSED | 重复报名或截止 |
| 413 | PAYLOAD_TOO_LARGE | JSON 请求体超过限制 |
| 429 | RATE_LIMITED | 登录失败次数超过窗口限制 |
| 500 | INTERNAL_ERROR | 通用内部错误，不向前台泄漏内部细节 |
| 503 | SERVICE_UNAVAILABLE | 健康检查中数据库不可用 |

前端本地产生 NETWORK_ERROR、TIMEOUT、INVALID_RESPONSE、INVALID_RECEIPT。PREVIEW_ONLY 仅用于开发预览阻止写入，不在 C 后台实现。D 可按 code 映射提示，不匹配 message 文案。

## 6. B 公共工具：返回完整响应，不再拆 data

```ts
const response = await apiRequest<{ items: Competition[] }>('/competitions')
const items = response.items
const detail = await apiRequest<{ item: CompetitionDetail }>('/competitions/' + encodeURIComponent(id))
const item = detail.item
```

管理登录调用 `apiRequest<{admin:Admin}>('/admin/login',{method:'POST',body:credentials})`，成功后由 D 使用 `response.admin`。退出读取 `response.ok`。工具也支持 204，但 C 当前 logout 返回 200。

工具固定同源 Cookie、JSON 请求、no-store、10 秒默认超时，可传 signal 取消，不自动重试写请求。管理请求 401（排除 /admin/login）触发 `ADMIN_UNAUTHORIZED_EVENT`，D 的受保护页面清除登录显示并转登录；登录凭据错误留在登录页。事件不代替后台鉴权。

## 7. 代理、Windows 启动与实际联调

B 前端根目录：Node 22.13 或更新兼容版本，`npm.cmd ci`；复制 `.env.example` 为 `.env.local`（已有文件保留其他配置），设置 `API_PROXY_TARGET=http://127.0.0.1:3001`；`npm.cmd run dev`，前端默认 3000 且占用时明确失败，不静默改端口。修改代理环境变量后重启前端。

C 的完整步骤以该提交 `server/README.md` 为准（文中的个人绝对目录需替换为本人目录）：进入 server → `npm.cmd ci` → 首次复制 `.env.example` 为 `.env` → 本机生成 SESSION_SECRET 并写入，勿分享 → `npm.cmd run db:migrate` → 需要管理功能时 `npm.cmd run db:create-admin` 交互创建管理员 → `npm.cmd run dev`。校验 `npm.cmd test`、`npm.cmd run build`；生产模式 build 后 `npm.cmd start`。默认 SQLite 文件 server/data/club.sqlite，不注册数据库平台。

联调检查 `http://localhost:3000/api/health` 应返回上述 health JSON，而非 HTML/404。代理不改 Origin/Host，C 默认允许 localhost:3000 和 127.0.0.1:3000；其他端口须共同配置 ALLOWED_ORIGINS。HTTPS 部署再启用合适 Cookie 安全配置，不把秘密放在 VITE_* 中。

## 8. 模拟数据、边界与验收

开发预览现在复用 develop 中 D 提供的 `src/mocks/competitions.ts`，只显示 published 样本，按同一排序读取；不再另造一套公开赛事样本。样本字段可共用，但样本规则中“组队、作品、OJ”等文字不扩展本周产品范围，由 D 后续调整样本文案。真实接口接通后页面数据以后台为准。

开发预览入口 `/src/pages/competitions/__dev__/preview.html?source=sample#/competitions`。sample 只用于布局测试，所有写入明确拒绝；source=live 请求真实 /api，不拦截或造成功。生产入口不导入 __dev__。

A 负责把首页适配层的 data 改为 items，并接入 B 组件；B 不直接改 A 文件。D 负责管理页真实接口和登录失效流程。联调必须核对返回编号与 SQLite 记录一致，重复/截止/下架由后台拒绝，并重启后确认比赛、报名及处理状态保留。自动检查不替代本人及 A 的最终验收。
