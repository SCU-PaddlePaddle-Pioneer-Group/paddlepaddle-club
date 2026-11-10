/** Shared development fixture proposal. Never imported by production pages. */
import type { CompetitionDetail } from '@/pages/competitions/data'

const day = 24 * 60 * 60 * 1000
export const sampleCompetitions: CompetitionDetail[] = [
  {
    id: 1001,
    title: '示例赛事 · AI 创意实践挑战',
    summary: '用一个小项目练习把想法变成作品。本条为界面开发样本，不是真实开放的比赛。',
    rules: '1. 本周 Demo 仅支持个人报名。\n2. 请阅读比赛说明后填写姓名和邮箱。\n3. 本预览不会保存报名，不接受真实个人信息。',
    registrationDeadline: new Date(Date.now() + 7 * day).toISOString(),
    status: 'published',
  },
  {
    id: 1002,
    title: '示例赛事 · 已截止的学习挑战',
    summary: '用于验证截止后仍能阅读规则、但无法通过表单继续报名的状态。',
    rules: '这是已截止的开发样本。规则仍可查看，报名按钮应禁用。',
    registrationDeadline: new Date(Date.now() - day).toISOString(),
    status: 'published',
  },
]
