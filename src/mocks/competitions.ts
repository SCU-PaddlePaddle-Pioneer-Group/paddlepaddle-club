/**
 * 四人统一模拟数据（D 提案，文件位置待群内商定）。
 *
 * 数据契约：分工细则 §8「最小数据约定」，字段与枚举不得各自猜测。
 * 时间一律 ISO 8601 带时区（北京时间 +08:00）。
 * 接入真实接口后由 B 的 src/lib/api.ts 替换请求层，本文件随后删除。
 */

export type CompetitionStatus = 'draft' | 'published' | 'offline'
export type RegistrationStatus = 'pending' | 'confirmed' | 'rejected'

export interface Competition {
  id: string
  title: string
  summary: string
  rules: string
  /** ISO 8601 带时区；报名是否截止由该时间与当前时间比较，不与发布状态混同 */
  registrationDeadline: string
  status: CompetitionStatus
  createdAt: string
  updatedAt: string
}

export interface Registration {
  id: string
  competitionId: string
  name: string
  email: string
  status: RegistrationStatus
  createdAt: string
}

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

/**
 * ISO 8601 → 北京时间展示文本（YYYY-MM-DD HH:mm）。
 * 界面按北京时间展示是契约要求（细则 §8）；骨架期暂放此处，接入 api.ts 后归位。
 */
export function formatBeijingTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replaceAll('/', '-')
}

/** ISO 8601 → datetime-local 输入框值（北京时间，YYYY-MM-DDTHH:mm） */
export function isoToLocalInputValue(iso: string): string {
  return formatBeijingTime(iso).replace(' ', 'T')
}

/**
 * datetime-local 无时区值 → UTC ISO 8601 字符串。
 * 按北京时间（+08:00）解释输入值，转换结果与机器时区无关（契约：拒绝无时区本地时间）。
 * 供编辑表单提交前调用；无效输入返回空字符串。
 */
export function isoFromLocalInput(local: string): string {
  if (!local) return ''
  // datetime-local 默认精度到分钟（16 字符），含秒（19 字符）时原样使用
  const withSeconds = local.length === 16 ? `${local}:00` : local
  const date = new Date(`${withSeconds}+08:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
