/**
 * 比赛新建 / 编辑共用页（D3/D4 骨架）：
 *   /admin/competitions/new          新建草稿
 *   /admin/competitions/:id/edit     编辑（含发布 / 下架操作占位）
 * 骨架阶段数据来自统一模拟数据；提交与状态操作不伪造成功，仅显示「未接入」提示。
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  MOCK_COMPETITIONS,
  formatBeijingTime,
  isoFromLocalInput,
  isoToLocalInputValue,
} from '@/mocks/competitions'
import { AdminPageHeader, CompetitionStatusBadge } from './shared'

// TODO(D3): 字段与请求体以 docs/api.md 定稿为准（当前约定 POST / PATCH /api/admin/competitions）。
// 长度上限对齐 C 开发文档 §7.1：标题 120、简介 1000、规则 10000；截止时间提交前转 ISO 8601。
const editSchema = z.object({
  title: z
    .string()
    .min(1, '请填写比赛名称')
    .max(120, '比赛名称不能超过 120 字'),
  summary: z
    .string()
    .min(1, '请填写比赛简介')
    .max(1000, '比赛简介不能超过 1000 字'),
  rules: z
    .string()
    .min(1, '请填写比赛规则')
    .max(10000, '比赛规则不能超过 10000 字'),
  registrationDeadline: z
    .string()
    .min(1, '请选择报名截止时间')
    .refine((value) => isoFromLocalInput(value) !== '', '报名截止时间无效，请重新选择'),
})

type EditValues = z.infer<typeof editSchema>

const inputClass =
  'w-full border border-border bg-background px-3.5 py-2.5 text-[15px] text-foreground ' +
  'placeholder:text-muted-foreground/60 transition-colors duration-200 ' +
  'focus:border-primary focus:outline-none'
const textareaClass = `${inputClass} min-h-[110px] resize-y leading-relaxed`
const labelClass =
  'mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground'

export default function CompetitionEdit() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [notice, setNotice] = useState<string | null>(null)

  const competition = useMemo(
    () => (id ? MOCK_COMPETITIONS.find((item) => item.id === id) : undefined),
    [id],
  )

  /** 编辑模式的原始本地时间串，用于判断「时间未修改」沿用原值（PR #14 复查意见） */
  const initialDeadlineLocal = useMemo(
    () => (competition ? isoToLocalInputValue(competition.registrationDeadline) : ''),
    [competition],
  )

  const defaultValues = useMemo<EditValues>(
    () =>
      competition
        ? {
            title: competition.title,
            summary: competition.summary,
            rules: competition.rules,
            registrationDeadline: isoToLocalInputValue(competition.registrationDeadline),
          }
        : { title: '', summary: '', rules: '', registrationDeadline: '' },
    [competition],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues,
  })

  // 同组件内 :id 变化不重挂载（如 /new → /comp-001/edit），显式重置表单（D3：保存后重新打开一致）
  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  if (isEdit && !competition) {
    return (
      <section className="container-x py-16 md:py-24">
        <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
          ← 返回比赛管理
        </Link>
        <p className="mt-10 font-mono text-sm text-muted-foreground">比赛不存在或已不可见。</p>
      </section>
    )
  }

  const onSubmit = (values: EditValues) => {
    // 截止时间（PR #14 复查意见）：
    // 1) 编辑时时间未修改 → 沿用原值原字符串，避免只改标题也改动截止时间；
    // 2) 修改过 → datetime-local 无时区值按北京时间 +08:00 转 UTC ISO 8601。
    // TODO(D3/D4): 接 B 的 api.ts 后，POST / PATCH 时直接提交该 ISO 值。
    let deadlineIso: string
    if (isEdit && competition && values.registrationDeadline === initialDeadlineLocal) {
      deadlineIso = competition.registrationDeadline
    } else {
      deadlineIso = isoFromLocalInput(values.registrationDeadline)
      if (!deadlineIso) {
        setNotice('报名截止时间无效：请重新选择。')
        return
      }
    }
    setNotice(
      `「${isEdit ? '保存修改' : '新建草稿'}」后台接口未接入：骨架阶段不提交数据。` +
        `待提交截止时间（ISO 8601）：${deadlineIso}`,
    )
  }

  const notWired = (action: string) => {
    // 细则红线：操作结果必须来自后台响应；骨架阶段不显示任何成功状态。
    setNotice(`「${action}」后台接口未接入：骨架阶段不提交数据。`)
  }

  const publishActions = (
    <>
      {competition?.status === 'published' ? (
        <button type="button" className="btn-outline" onClick={() => notWired('下架')}>
          下架
        </button>
      ) : (
        <button type="button" className="btn-primary" onClick={() => notWired('发布')}>
          发布 <span className="btn-arrow font-mono" aria-hidden>→</span>
        </button>
      )}
    </>
  )

  return (
    <section className="container-x py-16 md:py-24">
      <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
        ← 返回比赛管理
      </Link>

      <AdminPageHeader
        title={isEdit ? '编辑比赛' : '新建比赛'}
        desc={
          isEdit
            ? `最近更新：${formatBeijingTime(competition!.updatedAt)}`
            : '保存后生成草稿，草稿不在前台任何公开位置出现。'
        }
        actions={
          isEdit ? (
            <>
              <CompetitionStatusBadge status={competition!.status} />
              {publishActions}
            </>
          ) : undefined
        }
      />

      <form className="mt-12 max-w-[720px] space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="competition-title" className={labelClass}>
            比赛名称
          </label>
          <input
            id="competition-title"
            type="text"
            maxLength={120}
            className={inputClass}
            {...register('title')}
          />
          {errors.title && <p className="mt-1.5 text-[13px] text-accent">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="competition-summary" className={labelClass}>
            比赛简介
          </label>
          <textarea
            id="competition-summary"
            maxLength={1000}
            className={textareaClass}
            {...register('summary')}
          />
          {errors.summary && (
            <p className="mt-1.5 text-[13px] text-accent">{errors.summary.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="competition-rules" className={labelClass}>
            比赛规则
          </label>
          <textarea
            id="competition-rules"
            maxLength={10000}
            className={textareaClass}
            {...register('rules')}
          />
          {errors.rules && <p className="mt-1.5 text-[13px] text-accent">{errors.rules.message}</p>}
        </div>

        <div>
          <label htmlFor="competition-deadline" className={labelClass}>
            报名截止时间（北京时间）
          </label>
          <input
            id="competition-deadline"
            type="datetime-local"
            step={1}
            className={inputClass}
            {...register('registrationDeadline')}
          />
          {errors.registrationDeadline && (
            <p className="mt-1.5 text-[13px] text-accent">{errors.registrationDeadline.message}</p>
          )}
        </div>

        {notice && (
          <p className="border border-accent/50 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-accent">
            {notice}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {isEdit ? '保存修改' : '保存为草稿'}
          </button>
          <Link to="/admin/competitions" className="btn-outline">
            取消
          </Link>
        </div>
      </form>
    </section>
  )
}
