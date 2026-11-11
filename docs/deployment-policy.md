# Pages 发布边界（Issue #23）

## 工作流规则

- 推送 main 或在 main 手动运行：执行前端 build 和后端 server-check；只有两者都成功才允许部署。
- pull_request：执行检查，不上传正式 Pages 产物，不部署。
- 非 main 手动运行：执行检查，不上传正式 Pages 产物，不部署。
- 普通检查任务仅 contents: read；仅 deploy 任务授予 pages: write、id-token: write。
- deploy 使用 needs: [build, server-check]，保留 GitHub 默认 success() 行为；不使用 always() 绕过失败、取消或跳过状态。
- 前端成功时可以在 main 上传静态产物，但后端未成功时 deploy 仍被阻断。

| 场景 | 检查 | 正式产物上传 | 部署 |
| --- | --- | --- | --- |
| PR | 执行 | 不执行 | 不执行 |
| develop/功能分支手动运行 | 执行 | 不执行 | 不执行 |
| main 推送/手动运行，检查都成功 | 执行 | 执行 | 执行 |
| main 前端失败 | 失败 | 不执行 | 不执行 |
| main 后端失败/取消/跳过 | 非成功 | 前端成功时可上传 | 不执行 |

这是 Pages 静态前端发布边界，不能据此认为 Node API 已部署到云服务器。工作流变更合并到 develop 后，正式 main 工作流要在变更合入 main 后才更新。

## 2026-11-11 验证记录

- YAML 解析通过，校验实际工作流条件、双任务依赖和权限；覆盖 128 个事件/分支/前后端结果组合。
- main 且两项成功保留部署路径；PR、非 main 手动运行，以及任一检查失败/取消/跳过均不能执行部署。
- 未为验证而操作真实 Pages 发布，也未人为制造线上失败。PR 检查结果不能替代 main 的正式发布验证。

## 仓库外部设置核对

通过本机已有登录只读查询 GitHub API，未修改任何仓库策略：

- github-pages 环境：启用自定义分支策略，当前唯一允许的分支为 main，与工作流条件一致。
- 仓库规则集查询为空；main 传统分支保护查询返回 404。未检测到生效的必需检查配置，不能将“CI 存在”当作“禁止绕过 CI 合并”。
- 负责人应在 main 分支保护/规则集中要求 PR，并将 build 和 server-check 设置为必需检查；同时按团队决定审核人数及管理员绕过规则。此项为仓库设置，不能通过该 YAML 自动建立。
- 本次 PR 不更改成员权限或仓库外部保护策略；已有 Pages 环境 main 限制保留。

参考：

- [GitHub workflow syntax：needs、if 与 permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
