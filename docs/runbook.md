# 启动手册（Runbook）— 赛事模块动态化 Demo

> 负责人：D（启动说明与跨电脑验证，依据 AGENTS.md 文件归属）。
> 目标：在**任意一台新电脑**上，仅按本手册完成安装、初始化、启动并走通完整演示，不依赖任何个人绝对路径。
> 全程使用虚构数据与本地测试账号；`.env`、密钥、数据库文件一律不进 Git、不进共享文档。
> 功能验收清单见 `docs/acceptance.md`；接口契约见 `docs/api.md`。

## 0. 环境要求

| 组件 | 版本要求 | 用途 |
| --- | --- | --- |
| Node.js | ≥ 22.13（后端使用内置 `node:sqlite` 的硬性要求） | 前端构建与后端运行 |
| npm | 随 Node 附带 | 依赖安装与脚本 |
| Git | 近期任意版本 | 获取代码 |

- 浏览器使用 Chrome / Edge / Firefox 近期版本。
- 无需安装或注册任何数据库平台：SQLite 由 Node.js 内置提供，数据库是 `server/data/` 下的普通文件。
- 演示机建议使用不含中文与空格的项目目录路径。

## 1. 获取代码

Windows PowerShell 与 Linux / macOS 通用（目录名按需替换）：

```bash
git clone https://github.com/SCU-PaddlePaddle-Pioneer-Group/paddlepaddle-club.git
cd paddlepaddle-club
git checkout develop        # 或按验收安排切换到指定集成分支
```

## 2. 后端（终端 1，端口 3001）

> Windows 下统一使用 `npm.cmd` 代替 `npm`，避免 PowerShell 执行策略拦截 `npm.ps1`；Linux / macOS 直接用 `npm`。

```powershell
Set-Location server
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
notepad .env                # 将生成的随机值填入 SESSION_SECRET 后保存
npm.cmd run db:migrate
npm.cmd run dev             # 监听 http://127.0.0.1:3001
```

```bash
cd server
npm ci
[ -f .env ] || cp .env.example .env
openssl rand -hex 32        # 将输出填入 .env 的 SESSION_SECRET
npm run db:migrate
npm run dev                 # 监听 http://127.0.0.1:3001
```

要点：

- `SESSION_SECRET` 是本机生成的随机秘密（≥ 32 字节），只保存在本机 `.env`，不写进聊天、文档或 Git。
- `db:migrate` 可安全重复执行；首次启动也会自动应用未执行的迁移。
- 后端默认只监听 `127.0.0.1:3001`；可通过 `HOST`、`PORT`、`DATABASE_PATH` 环境变量调整。

### 2.1 管理员初始化（仅测管理功能时需要）

```powershell
npm.cmd run db:create-admin     # Linux / macOS: npm run db:create-admin
```

- 在交互终端输入管理员用户名（3–64 位字母数字点下划线连字符）与密码（≥ 12 位，两次确认，不回显）。
- 该命令只创建**首个**管理员；管理员与会话都存于同一 SQLite 文件，会话有效期 8 小时。
- 密码由使用者本机输入，不经过聊天工具或 AI，也不写入任何文档。

### 2.2 健康检查

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health    # 预期 {"status":"ok"}
```

```bash
curl http://127.0.0.1:3001/api/health                  # 预期 {"status":"ok"}
```

返回 `503` 表示 SQLite 不可用，先检查数据库文件与磁盘。

## 3. 前端（终端 2，端口 3000）

回到项目根目录：

```powershell
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
# 确认 .env.local 中 API_PROXY_TARGET=http://127.0.0.1:3001
npm.cmd run dev             # http://localhost:3000
```

```bash
npm ci
[ -f .env.local ] || cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

要点：

- Vite 已配置 `/api` 代理转发到 `API_PROXY_TARGET`（默认后端 3001），代理不改变 Origin/Host。
- 前端端口 3000 为 `strictPort`：被占用时**明确失败**，不静默换端口（换端口会导致 Origin 白名单失效）。
- 修改 `.env.local` 后需要重启前端 dev 进程。
- 联调检查：`http://localhost:3000/api/health` 应返回 `{"status":"ok"}`，而不是 HTML 或 404。

## 4. 联调验证（最小闭环）

1. 代理链路：`http://localhost:3000/api/health` → `{"status":"ok"}`。
2. 前台报名：打开 `http://localhost:3000/#/competitions` → 进入已发布比赛详情 → 填写**虚构**姓名与邮箱提交 → 保存回执中的报名编号。
3. 管理端：`http://localhost:3000/#/admin/login` 登录 → 比赛管理 → 新建/编辑比赛并发布。
4. 列表点「报名 →」→ 核对同一报名编号、姓名、邮箱 → 修改处理状态（待处理 / 已确认 / 已拒绝）。
5. 刷新页面与重启后端 → 报名记录与处理状态均应保留。
6. 完整验收逐条对照 `docs/acceptance.md`（16 项），演示证据截图归档。

## 5. 数据持久化、备份与恢复

- 数据库默认文件：`server/data/club.sqlite`（相对路径以 `server/` 为基准，不依赖启动时所在目录）；`server/data/` 已加入忽略规则，不进 Git。
- **备份**：先停止后端进程，再复制 `club.sqlite`（若存在 `-wal` / `-shm` 文件一并复制）到目标位置。后端运行中直接复制可能得到不一致的快照。
- **恢复**：停止后端 → 用备份文件覆盖 `server/data/club.sqlite` → 清理残留的 `-wal` / `-shm` → 启动后端 → 用 `/api/health` 和页面数据核对。
- **演示数据重置**（全部为虚构数据）：停止后端 → 删除 `server/data/club.sqlite` → 重新 `db:migrate` → 重新 `db:create-admin`。或仅删除/修改后台中的演示记录。
- 任何情况下不把数据库文件、`.env`、真实凭据或真实报名人信息提交到 Git 或写入共享文档。

## 6. 生产 HTTPS 与部署说明（概要）

- 前端 `npm run build` 产物 `dist/` 为纯静态文件（HashRouter），由 GitHub Pages 工作流自动发布；静态托管不能运行 Express / SQLite 后端。
- 后端是独立 Node 服务，正式环境部署在自有服务器或云主机，由反向代理统一入口并转发 `/api`。
- 相关环境变量：`COOKIE_SECURE`（HTTPS 部署设为 `true`）、`ALLOWED_ORIGINS`（显式列出部署域名，本地默认允许 `localhost:3000` 与 `127.0.0.1:3000`）、`SESSION_SECRET`。
- HTTPS 反向代理下的会话 Cookie 与登录限流细则以 issue #21 的修复结论为准；本手册当前仅覆盖本地 HTTP 开发场景。
- 正式开放报名前的持久化存储、定期备份与滥用防护另行安排（issue #23、#28）。

## 7. 常见问题

| 现象 | 处理 |
| --- | --- |
| PowerShell 报 `npm.ps1 cannot be loaded` | 使用 `npm.cmd` 代替 `npm` |
| 端口 3000 / 3001 被占用 | 结束占用进程；前端 3000 被保护不静默换端口，避免 Origin 白名单失效 |
| 项目放在中文/空格路径下工具异常 | 把项目移到不含中文与空格的目录 |
| 管理页反复跳回登录 | 会话有效期 8 小时或 Cookie 丢失，重新登录即可 |
| `db:create-admin` 报「管理员已存在」 | 该命令只初始化首个管理员；重置见 §5 演示数据重置 |
| GitHub Pages 上访问 `/api` 404 | 静态托管没有后端；Demo 后端只在本地或自有服务器运行 |

## 8. 已知限制

- 本周 Demo 范围不含普通用户注册、复杂组队、作品上传、通知、富文本编辑、批量导出（AGENTS.md）。
- 自动化检查与文档不替代跨电脑人工验收：验收清单第 14 条（另一台电脑按手册启动）与第 16 条（完整流程两遍）须实际执行并留证据。
- 文本文件行结束符约定：Markdown 等文本一律 LF，行尾不留空白（见仓库 `.gitattributes`）。
