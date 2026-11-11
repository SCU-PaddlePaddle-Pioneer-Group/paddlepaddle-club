import type { Competition, Registration } from '@/types/competition'

/** 全部为虚构数据，仅用于骨架期布局与状态展示 */
export const MOCK_COMPETITIONS: Competition[] = [
  {
    id: 'comp-001',
    title: '2026 秋季 AI 创新应用挑战赛',
    summary: '面向全校同学的 AI 应用开发比赛，鼓励围绕学习、生活与校园场景创作。',
    rules: '1. 1-3 人组队；\n2. 作品须使用大模型或机器学习能力；\n3. 现场答辩 5 分钟。',
    registrationDeadline: '2026-11-20T23:59:59+08:00',
    status: 'published',
    createdAt: '2026-11-01T10:00:00+08:00',
    updatedAt: '2026-11-09T15:30:00+08:00',
  },
  {
    id: 'comp-002',
    title: '校园智能体创意征集（筹备中）',
    summary: '征集校园场景下的智能体创意方案，优胜方案将进入下一期开发孵化。',
    rules: '1. 以文档形式提交创意方案；\n2. 方案需说明场景、做法与可行性。',
    registrationDeadline: '2026-12-05T23:59:59+08:00',
    status: 'draft',
    createdAt: '2026-11-08T09:00:00+08:00',
    updatedAt: '2026-11-08T09:00:00+08:00',
  },
  {
    id: 'comp-003',
    title: '2025 年冬季程序设计迎新赛',
    summary: '已完成历史赛事，保留存档用于演示下架状态。',
    rules: '1. 个人参赛；\n2. 线上 OJ 作答。',
    registrationDeadline: '2025-12-10T23:59:59+08:00',
    status: 'offline',
    createdAt: '2025-11-20T10:00:00+08:00',
    updatedAt: '2026-01-05T18:00:00+08:00',
  },
]

/** 全部为虚构报名数据 */
export const MOCK_REGISTRATIONS: Registration[] = [
  {
    id: 'reg-0001',
    competitionId: 'comp-001',
    name: '张三',
    email: 'zhangsan@example.com',
    status: 'pending',
    createdAt: '2026-11-09T12:00:00+08:00',
  },
  {
    id: 'reg-0002',
    competitionId: 'comp-001',
    name: '李四',
    email: 'lisi@example.com',
    status: 'confirmed',
    createdAt: '2026-11-09T14:30:00+08:00',
  },
  {
    id: 'reg-0003',
    competitionId: 'comp-001',
    name: '王五',
    email: 'wangwu@example.com',
    status: 'rejected',
    createdAt: '2026-11-10T09:15:00+08:00',
  },
  {
    id: 'reg-0004',
    competitionId: 'comp-003',
    name: '赵六',
    email: 'zhaoliu@example.com',
    status: 'confirmed',
    createdAt: '2025-12-01T20:00:00+08:00',
  },
]
