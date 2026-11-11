/**
 * 报名管理页（D5）：路由 /admin/competitions/:id/registrations。
 * 真实接口：GET /api/admin/competitions/:id/registrations；PATCH /api/admin/registrations/:id（单字段 status）。
 * 状态修改以真实后台响应为准；401 由会话守卫跳登录；操作期间行按钮禁用防重复提交。
 * 报名排序以后台为准（createdAt ASC、同时间 id ASC），页面不二次排序。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiRequest, ApiError } from '@/lib/api'
import {
  formatBeijingTime,
  type Competition,
  type Registration,
  type RegistrationStatus,
} from '@/mocks/competitions'
import { useAdminSessionGuard } from './useAdminSession'
import {
  AdminPageHeader,
  CompetitionStatusBadge,
  RegistrationStatusBadge,
} from './shared'

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; competition: Competition | null; registrations: Registration[] }

type Notice = { tone: 'success' | 'warning'; text: string }

const thClass =
  'py-3 pr-6 align-bottom font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'
const tdClass = 'py-4 pr-6 align-middle text-sm text-foreground'
const rowActionClass =
  'font-mono text-[12px] text-muted-foreground transition-colors duration-200 hover:text-primary disabled:pointer-events-none disabled:opacity-40'

const noticeClass = (tone: Notice['tone']) =>
  tone === 'success'
    ? 'border border-primary/50 bg-primary/5 px-4 py-3 text-[13px] leading-relaxed text-primary'
    : 'border border-accent/50 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-accent'

const statusActionText = (status: RegistrationStatus) =>
  status === 'confirmed' ? '确认' : status === 'rejected' ? '拒绝' : ''

export default function Registrations() {
  const { id } = useParams<{ id: string }>()
  useAdminSessionGuard()

  const [loadState, setLoadState] = useState<LoadState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [actionPending, setActionPending] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    // 比赛列表用于页面题头显示比赛名称与状态；报名列表是本页主数据。
    const competitionsRequest = apiRequest<{ items: Competition[] }>('/admin/competitions')
    const registrationsRequest = apiRequest<{ items: Registration[] }>(
      `/admin/competitions/${encodeURIComponent(id)}/registrations`,
    )
    Promise.all([competitionsRequest, registrationsRequest])
      .then(([competitionResponse, registrationResponse]) => {
        if (cancelled) return
        setLoadState({
          phase: 'done',
          competition: competitionResponse.items.find((item) => item.id === id) ?? null,
          registrations: registrationResponse.items,
        })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        const code = cause instanceof ApiError ? cause.code : ''
        const fallback =
          code === 'COMPETITION_NOT_FOUND'
            ? '比赛不存在或已不可见。'
            : cause instanceof ApiError
              ? cause.message
              : '请求未完成，请稍后重试。'
        setLoadState({ phase: 'error', message: fallback })
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

  const registrations = useMemo(
    () => (loadState.phase === 'done' ? loadState.registrations : []),
    [loadState],
  )

  const changeStatus = useCallback(
    async (registrationId: string, status: RegistrationStatus) => {
      setActionPending(true)
      setNotice(null)
      try {
        const response = await apiRequest<{ item: Registration }>(
          `/admin/registrations/${encodeURIComponent(registrationId)}`,
          { method: 'PATCH', body: { status } },
        )
        setLoadState((state) =>
          state.phase === 'done'
            ? {
                ...state,
                registrations: state.registrations.map((item) =>
                  item.id === response.item.id ? response.item : item,
                ),
              }
            : state,
        )
        setNotice({
          tone: 'success',
          text: `已${statusActionText(status)}：处理状态已由后台保存。`,
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
    [],
  )

  if (loadState.phase === 'loading') {
    return (
      <section className="container-x py-16 md:py-24">
        <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
          ← 返回比赛管理
        </Link>
        <p className="mt-10 font-mono text-sm text-muted-foreground">正在加载报名数据…</p>
      </section>
    )
  }

  if (loadState.phase === 'error') {
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

  const competition = loadState.competition

  return (
    <section className="container-x py-16 md:py-24">
      <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
        ← 返回比赛管理
      </Link>

      <AdminPageHeader
        title="报名管理"
        desc={
          competition
            ? `比赛「${competition.title}」 · 报名人信息仅管理员可见，不进入任何公开接口。`
            : '报名人信息仅管理员可见，不进入任何公开接口。'
        }
        actions={competition ? <CompetitionStatusBadge status={competition.status} /> : undefined}
      />

      {notice && <p className={`mt-8 ${noticeClass(notice.tone)}`}>{notice.text}</p>}

      <div className="mt-8 overflow-x-auto">
        {registrations.length === 0 ? (
          <p className="border-t border-border py-10 font-mono text-sm text-muted-foreground">
            该比赛暂无报名。
          </p>
        ) : (
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass}>报名编号</th>
                <th className={thClass}>姓名</th>
                <th className={thClass}>邮箱</th>
                <th className={thClass}>状态</th>
                <th className={thClass}>提交时间</th>
                <th className={thClass}>操作</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => (
                <tr key={registration.id} className="border-b border-border">
                  <td className={`${tdClass} whitespace-nowrap font-mono text-[12px]`}>{registration.id}</td>
                  <td className={`${tdClass} font-medium`}>{registration.name}</td>
                  <td className={`${tdClass} font-mono text-[13px]`}>{registration.email}</td>
                  <td className={tdClass}>
                    <RegistrationStatusBadge status={registration.status} />
                  </td>
                  <td className={`${tdClass} font-mono text-[13px] text-muted-foreground`}>
                    {formatBeijingTime(registration.createdAt)}
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className={rowActionClass}
                        disabled={actionPending || registration.status === 'confirmed'}
                        onClick={() => changeStatus(registration.id, 'confirmed')}
                      >
                        确认
                      </button>
                      <button
                        type="button"
                        className={rowActionClass}
                        disabled={actionPending || registration.status === 'rejected'}
                        onClick={() => changeStatus(registration.id, 'rejected')}
                      >
                        拒绝
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        处理状态以后台保存为准 · 刷新与重启后保留
      </p>
    </section>
  )
}
