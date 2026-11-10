# 赛事 Demo API 草案 v0.1

日期：2026-11-10。B 整理；**待 C 核对，A/D 确认，尚非已实现或全组批准的契约**。

依据：本周分工细则、AGENTS.md、docs/A-handoff.md。沿用 React/HashRouter、同源 `/api`、Cookie 会话、个人报名。新增成功响应细节、排序、长度限制和错误码均为本次建议；有调整先同步所有调用方。

## 1. 需要团队回复的决定

| 项目 | B 建议（页面按此草案开发） | 确认方 / 状态 |
| --- | --- | --- |
| 成功外层 | 200/201 返回 `{ data: ... }`，204 无响应体 | C/A/D 待确认 |
| id | 数据库可用正整数；前台兼容非空字符串或有限数字；详情返回对应 id | C 待确认 |
| 列表排序 | `createdAt DESC, id DESC`，后台排序，首页取前 3 条；本周不分页 | C/A 待确认 |
| 公开比赛 | 列表返回 published；详情同样限制；已过期仍可查看 | 细则要求，C 待实现验证 |
| 报名字段 | 仅 name/email；姓名 trim 后 1-80 字符；规范化邮箱不超过 254 字符 | C/D 待确认长度和格式边界 |
| 截止 | `serverNow >= registrationDeadline` 时关闭，前端时钟只帮助提示 | C 待确认并实测 |
| 写入返回 | 报名成功 201，含 id、competitionId、pending、createdAt | C/D 待确认 |
| 后台地址 | 尚未知；A 建议 3001，不代表实际端口 | C 提供实际地址及启动命令 |
| Cookie | 同源会话；后台校验来源、管理接口权限；401 由 D 接回登录 | C/D 待联调 |
| 交付节奏 | 公开列表/详情 → 报名 → 登录 → 管理接口 | 请 C 回复每批可联调时间 |

不要把“B 页面通过模拟测试”视为这些决定已确认。C 对字段或返回形状有调整时，先改本文件和统一样本，再改对应调用层；禁止各自猜测。

## 2. 页面与边界

HashRouter 页面 `/competitions` 和 `/competitions/:id`，浏览器地址含 `#/`。B 交付组件，A 接入 `App.tsx`。管理页面按原细则由 D 交付、A 接入。

请求中 id 必须 URL 编码。公开 API 不包含报名人信息。比赛不物理删除，使用 offline。普通访客无需登录即可报名，不增加用户注册。

## 3. 数据

比赛：`id,title,summary,rules,registrationDeadline,status,createdAt,updatedAt`。
比赛状态：`draft | published | offline`。列表可省略 rules；详情必须有 rules。
所有日期为带时区 ISO 8601；展示时转换北京时间，接口不得返回缺时区的本地日期。

报名：`id,competitionId,name,email,status,createdAt`。
报名状态：`pending | confirmed | rejected`。提交默认 pending；后台保存规范化邮箱（去首尾空格、转小写），按 competitionId+email 建联合唯一约束。

规则按纯文本显示，换行保留；本周不支持 HTML/富文本。前台输入校验不替代后台校验。

## 4. 公开接口（优先交付）

### GET /api/health

建议 200：`{"data":{"status":"ok"}}`。不得返回秘密配置。

### GET /api/competitions

无请求体。建议 200，空列表为 `{"data":[]}`。本周全量返回，按第 1 节排序。

```json
{
  "data": [{
    "id": 1001,
    "title": "接口示例比赛（非正式赛事）",
    "summary": "用于前后台联调的虚构比赛",
    "registrationDeadline": "2026-11-20T18:00:00+08:00",
    "status": "published",
    "createdAt": "2026-11-10T10:00:00+08:00",
    "updatedAt": "2026-11-10T10:00:00+08:00"
  }]
}
```

### GET /api/competitions/:id

建议 200：data 是上例单个比赛对象，并增加 `"rules":"个人报名。请遵守比赛规则。"`。不存在、草稿、下架均返回 404，防止暴露非公开数据。

### POST /api/competitions/:id/registrations

Content-Type: application/json，无需管理员 Cookie。

```json
{ "name": "演示同学", "email": "demo@example.com" }
```

后台独立检查字段、published 状态、截止和重复；事务/唯一约束保证并发请求不产生重复记录。建议成功 201：

```json
{
  "data": {
    "id": 2001,
    "competitionId": 1001,
    "status": "pending",
    "createdAt": "2026-11-10T10:30:00+08:00"
  }
}
```

编号必须在数据库保存成功后返回；不返回所有报名者或多余个人信息。字段错误 400，不公开比赛 404，重复/截止 409。网络中断可能发生在保存后，前台不得断言未保存或自动重试 POST，应提示用户先核实结果。

## 5. 管理接口（给 C/D 确认）

除登录外均需后台会话，未登录统一 401；Cookie 只由后台设置，不把 token 放到 localStorage。以下请求/返回为建议示例。

| 方法与地址 | 请求示例 | 成功返回建议 |
| --- | --- | --- |
| POST /api/admin/login | `{"username":"demo-admin","password":"<用户输入，不进仓库>"}` | 200 `{"data":{"id":1,"username":"demo-admin"}}` + Set-Cookie |
| GET /api/admin/me | 无 | 200 同上管理员公开字段 |
| POST /api/admin/logout | 无 | 204，清除会话与 Cookie |
| GET /api/admin/competitions | 无 | 200 `{"data":[比赛对象]}`，包含所有状态 |
| POST /api/admin/competitions | `{"title":"示例","summary":"摘要","rules":"规则","registrationDeadline":"2026-11-20T18:00:00+08:00"}` | 201 `{"data":比赛对象}`，服务端初始状态 draft |
| PATCH /api/admin/competitions/:id | `{"title":"更新标题"}` 或 `{"status":"published"}` 或 `{"status":"offline"}` | 200 `{"data":更新后的比赛对象}` |
| GET /api/admin/competitions/:id/registrations | 无 | 200 `{"data":[报名对象]}`，包含该比赛报名人的 name/email |
| PATCH /api/admin/registrations/:id | `{"status":"confirmed"}` | 200 `{"data":更新后的报名对象}` |

后台只允许白名单字段；id、createdAt 等不可由客户端修改。发布必须校验必要字段。管理列表与报名列表建议按创建时间倒序。登录响应不得含密码/哈希；管理员创建走 C 初始化脚本，不做注册接口。

## 6. 统一错误（代码均待 C 确认）

```json
{ "error": { "code": "DUPLICATE_REGISTRATION", "message": "该邮箱已报名此比赛，请勿重复提交。" } }
```

| HTTP | code 建议 | 含义 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 必填、格式、长度、非法状态/字段 |
| 401 | INVALID_CREDENTIALS | 登录凭据错误 |
| 401 | UNAUTHENTICATED | 管理会话缺失或失效 |
| 403 | FORBIDDEN | 管理写操作来源校验失败 |
| 404 | COMPETITION_NOT_FOUND | 赛事不存在或不可公开查看 |
| 404 | REGISTRATION_NOT_FOUND | 管理员操作的报名记录不存在 |
| 409 | DUPLICATE_REGISTRATION | 同一赛事与规范化邮箱已存在 |
| 409 | REGISTRATION_CLOSED | 到达/超过报名截止 |
| 500 | INTERNAL_ERROR | 通用失败，不泄漏内部堆栈和秘密 |

前端工具另产生 NETWORK_ERROR、TIMEOUT、INVALID_RESPONSE、INVALID_RECEIPT，用于网络/格式故障；它们不是 C 必须返回的业务错误码。开发预览独有 PREVIEW_ONLY（409），不应在真实后台实现。

## 7. 公共工具接入与开发配置

`src/lib/api.ts` 导出 `apiRequest<T>(path, options)`、`ApiError`、`ADMIN_UNAUTHORIZED_EVENT`。path 不含 `/api`，例如 `apiRequest<Competition[]>('/competitions')`，返回已拆出 data 的内容。200/201 的业务字段由调用方校验；204 返回 undefined。

所有请求使用 same-origin Cookie、Accept JSON、no-store；写请求发送 JSON；默认超时 10 秒，可传 signal 取消。没有自动重试写请求。401 且 path 以 `/admin/` 开头时发出 `api:admin-unauthorized` 事件，D 的受保护页面监听并清除登录显示、回登录页；登录页不要由这个事件形成重定向循环。前端事件不替代后台鉴权。

Vite 配置读取 `API_PROXY_TARGET`。复制 `.env.example` 为 `.env.local`，由 C 确认后填实际后台 origin，再重启前端。没有配置时不转发，也不回退到模拟数据。端口没有写死；代理保留 Origin/Host（changeOrigin false），C 应允许实际前端 origin 并验证写请求来源。开发时后台 Cookie 不能错误限定到其他主机，也不能在普通 HTTP 下要求 Secure。正式 HTTPS 由 C 配置合适的安全属性。

## 8. 同一份模拟数据与验证

候选共用样本：`src/pages/competitions/__dev__/fixtures.ts`，请 A/D 复用同一字段，C 核对。两个示例分别为截止前/截止后，时间相对打开预览的当天生成；样例不属于正式赛事。

独立开发预览：`/src/pages/competitions/__dev__/preview.html?source=sample#/competitions`。只拦截此预览中的公开赛事请求；所有报名写入明确拒绝，不保存、不返回虚假编号。`source=live` 完全使用真实 `/api`。生产入口不导入 __dev__，常规构建不包含预览入口或模拟数据。

周三真实验收：C 创建并发布虚构比赛 → B 列表/详情读取 → 提交虚构姓名和邮箱 → 返回真实编号 → C/D 查到同一条记录。随后验重复、截止、下架、网络故障，并重启确认保留。模拟接口测试不能替代这一过程。
