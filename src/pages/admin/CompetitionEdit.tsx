/**
 * 比赛新建 / 编辑共用页（D3/D4）：
 *   /admin/competitions/new          新建草稿：POST /api/admin/competitions（服务端置 draft）
 *   /admin/competitions/:id/edit     编辑：PATCH /api/admin/competitions/:id；发布/下架单独 PATCH {status}
 * 数据来源：管理接口（编辑页自行拉取，刷新可直接进入）；沿用原值逻辑保留（PR #14 复查意见）。
 * 成功反馈全部来自后台真实响应；失败展示可读 message，401 由会话守卫跳登录。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiRequest, ApiError } from '@/lib/api'
import {
  formatBeijingTime,
  isoFromLocalInput,
  isoToLocalInputValue,
  type Competition,
  type CompetitionStatus,
} from '@/mocks/competitions'
import { useAdminSessionGuard } from './useAdminSession'
import { AdminPageHeader, CompetitionStatusBadge } from './shared'

// 长度上限对齐 C 实现（docs/api.md §2）：标题 120、简介 1000、规则 10000。
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

type Notice = { tone: 'success' | 'warning'; text: string }

type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; competition: Competition | null }

const inputClass =
  'w-full border border-border bg-background px-3.5 py-2.5 text-[15px] text-foreground ' +
  'placeholder:text-muted-foreground/60 transition-colors duration-200 ' +
  'focus:border-primary focus:outline-none'
const textareaClass = `${inputClass} min-h-[110px] resize-y leading-relaxed`
const labelClass =
  'mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground'

const noticeClass = (tone: Notice['tone']) =>
  tone === 'success'
    ? 'border border-primary/50 bg-primary/5 px-4 py-3 text-[13px] leading-relaxed text-primary'
    : 'border border-accent/50 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-accent'

export default function CompetitionEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  useAdminSessionGuard()

  const [loadState, setLoadState] = useState<LoadState>(
    isEdit ? { phase: 'loading' } : { phase: 'idle' },
  )
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [actionPending, setActionPending] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    apiRequest<{ items: Competition[] }>('/admin/competitions')
      .then((response) => {
        if (!cancelled)
          setLoadState({
            phase: 'done',
            competition: response.items.find((item) => item.id === id) ?? null,
          })
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setLoadState({
            phase: 'error',
            message: cause instanceof ApiError ? cause.message : '请求未完成，请稍后重试。',
          })
      })
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  // 重置放在事件处理器；effect 内仅异步请求（react-hooks/set-state-in-effect）
  const retryLoad = useCallback(() => {
    setLoadState({ phase: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  /**
   * 编辑数据派生：仅接受与当前 :id 匹配的结果；
   * 拿到旧 id 数据（切换编辑对象瞬间）视为加载中，避免闪现旧表单。
   */
  const competition =
    loadState.phase === 'done' && loadState.competition?.id === id ? loadState.competition : null
  const loading =
    isEdit &&
    (loadState.phase === 'loading' ||
      (loadState.phase === 'done' && loadState.competition !== null && loadState.competition.id !== id))

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
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues,
  })

  /**
   * 是否存在未保存修改（PR #18 复查意见）：
   * 文本以 trim 后与后台已存版本比较（与保存行为一致），时间与原本地串比较。
   */
  const hasUnsavedChanges = useCallback((): boolean => {
    if (!isEdit || !competition) return false
    const values = getValues()
    return (
      values.title.trim() !== competition.title ||
      values.summary.trim() !== competition.summary ||
      values.rules.trim() !== competition.rules ||
      values.registrationDeadline !== initialDeadlineLocal
    )
  }, [competition, getValues, initialDeadlineLocal, isEdit])

  // 同组件内 :id 变化不重挂载（如 /new → /comp-001/edit），数据到位后显式重置表单（D3）
  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const changeStatus = useCallback(
    async (status: CompetitionStatus) => {
      if (!competition) return
      // PR #18 复查意见：存在未保存修改时阻止发布/下架，避免输入被静默覆盖
      if (hasUnsavedChanges()) {
        setNotice({
          tone: 'warning',
          text: '有未保存的修改：请先点「保存修改」，再发布或下架。',
        })
        return
      }
      setActionPending(true)
      setNotice(null)
      try {
        const response = await apiRequest<{ item: Competition }>(
          `/admin/competitions/${encodeURIComponent(competition.id)}`,
          { method: 'PATCH', body: { status } },
        )
        setLoadState({ phase: 'done', competition: response.item })
        setNotice({
          tone: 'success',
          text:
            status === 'published'
              ? '发布成功：比赛已通过公开接口对前台可见。'
              : '下架成功：比赛已从公开接口隐藏，报名同时关闭。',
        })
      } catch (error) {
        setNotice({
          tone: 'warning',
          text: error instanceof ApiError ? error.message : '请求未完成，请稍后重试。',
        })
      } finally {
        setActionPending(false)
      }
    },
    [competition, hasUnsavedChanges],
  )

  const onSubmit = async (values: EditValues) => {
    // 截止时间（PR #14 复查意见）：
    // 1) 编辑时时间未修改 → 沿用后台原值原字符串；
    // 2) 修改过 → datetime-local 值按北京时间 +08:00 转 UTC ISO 8601（含秒含时区，满足 C 校验）。
    let deadlineIso: string
    if (isEdit && competition && values.registrationDeadline === initialDeadlineLocal) {
      deadlineIso = competition.registrationDeadline
    } else {
      deadlineIso = isoFromLocalInput(values.registrationDeadline)
      if (!deadlineIso) {
        setNotice({ tone: 'warning', text: '报名截止时间无效：请重新选择。' })
        return
      }
    }

    const body = {
      title: values.title.trim(),
      summary: values.summary.trim(),
      rules: values.rules.trim(),
      registrationDeadline: deadlineIso,
    }

    setNotice(null)
    try {
      if (isEdit && competition) {
        const response = await apiRequest<{ item: Competition }>(
          `/admin/competitions/${encodeURIComponent(competition.id)}`,
          { method: 'PATCH', body },
        )
        setLoadState({ phase: 'done', competition: response.item })
        setNotice({ tone: 'success', text: '保存成功：修改已由后台保存。' })
      } else {
        await apiRequest<{ item: Competition }>('/admin/competitions', { method: 'POST', body })
        navigate('/admin/competitions', { replace: true })
      }
    } catch (error) {
      setNotice({
        tone: 'warning',
        text: error instanceof ApiError ? error.message : '请求未完成，请稍后重试。',
      })
    }
  }

  if (isEdit && loading) {
    return (
      <section className="container-x py-16 md:py-24">
        <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
          ← 返回比赛管理
        </Link>
        <p className="mt-10 font-mono text-sm text-muted-foreground">正在加载比赛数据…</p>
      </section>
    )
  }

  if (isEdit && loadState.phase === 'error') {
    return (
      <section className="container-x py-16 md:py-24">
        <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
          ← 返回比赛管理
        </Link>
        <p className="mt-10 text-sm text-accent">{loadState.message}</p>
        <button
          type="button"
          onClick={retryLoad}
          className="link-slide mt-4 font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:text-primary"
        >
          重试 →
        </button>
      </section>
    )
  }

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
              {competition!.status === 'published' ? (
                <button
                  type="button"
                  className="btn-outline disabled:pointer-events-none disabled:opacity-50"
                  disabled={actionPending}
                  onClick={() => changeStatus('offline')}
                >
                  下架
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary disabled:pointer-events-none disabled:opacity-50"
                  disabled={actionPending}
                  onClick={() => changeStatus('published')}
                >
                  发布 <span className="btn-arrow font-mono" aria-hidden>→</span>
                </button>
              )}
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

        {notice && <p className={noticeClass(notice.tone)}>{notice.text}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {isEdit ? (isSubmitting ? '保存中…' : '保存修改') : isSubmitting ? '创建中…' : '保存为草稿'}
          </button>
          <Link to="/admin/competitions" className="btn-outline">
            取消
          </Link>
        </div>
      </form>
    </section>
  )
}
