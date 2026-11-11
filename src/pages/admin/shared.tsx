/**
 * 管理端页面共用件（D 负责）。
 * 只复用 index.css 组件类与设计令牌；本文件仅导出组件（react-refresh 约束）。
 */
import type { ReactNode } from 'react'
import type { CompetitionStatus, RegistrationStatus } from '@/types/competition'

/** 三行式题头，右侧可放页面级操作（如「新建比赛」按钮） */
export function AdminPageHeader({
  title,
  desc,
  actions,
}: {
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <header className="mt-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <p className="section-eyebrow">管理后台 / ADMIN</p>
        <h1 className="section-title">{title}</h1>
        {desc && <p className="section-desc">{desc}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  )
}

const COMPETITION_STATUS_META: Record<CompetitionStatus, { label: string; tone: string }> = {
  draft: { label: '草稿', tone: 'border-border text-muted-foreground' },
  published: { label: '已发布', tone: 'border-primary/70 text-primary' },
  offline: { label: '已下架', tone: 'border-accent/70 text-accent' },
}

export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  const meta = COMPETITION_STATUS_META[status]
  return <span className={`tag ${meta.tone}`}>{meta.label}</span>
}

const REGISTRATION_STATUS_META: Record<RegistrationStatus, { label: string; tone: string }> = {
  pending: { label: '待处理', tone: 'border-border text-muted-foreground' },
  confirmed: { label: '已确认', tone: 'border-primary/70 text-primary' },
  rejected: { label: '已拒绝', tone: 'border-accent/70 text-accent' },
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const meta = REGISTRATION_STATUS_META[status]
  return <span className={`tag ${meta.tone}`}>{meta.label}</span>
}
