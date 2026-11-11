/**
 * 比赛管理列表页（D2）：路由 /admin/competitions。
 * 真实接口：GET /api/admin/competitions（含全部状态），401 由会话守卫跳登录。
 * 加载 / 空列表 / 失败可重试三种状态完整；数据以后台为准，不做本地过滤。
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { apiRequest, ApiError } from '@/lib/api'
import { formatBeijingTime, type Competition } from '@/mocks/competitions'
import { useAdminSessionGuard } from './useAdminSession'
import { AdminPageHeader, CompetitionStatusBadge } from './shared'

const thClass =
  'py-3 pr-6 align-bottom font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'
const tdClass = 'py-4 pr-6 align-middle text-sm text-foreground'

export default function CompetitionList() {
  useAdminSessionGuard()
  const [competitions, setCompetitions] = useState<Competition[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiRequest<{ items: Competition[] }>('/admin/competitions')
      .then((response) => {
        if (!cancelled) setCompetitions(response.items)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiError ? cause.message : '请求未完成，请稍后重试。')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // 重置动作放在事件处理器，effect 内仅发起异步请求（react-hooks/set-state-in-effect）
  const retry = useCallback(() => {
    setCompetitions(null)
    setError(null)
    setReloadKey((key) => key + 1)
  }, [])

  return (
    <section className="container-x py-16 md:py-24">
      <Link to="/" className="link-slide font-mono text-[13px] text-muted-foreground">
        ← 返回首页
      </Link>

      <AdminPageHeader
        title="比赛管理"
        desc="全部状态的比赛在此维护；草稿仅后台可见，下架后前台不可见。"
        actions={
          <Link to="/admin/competitions/new" className="btn-primary">
            新建比赛 <span className="btn-arrow font-mono" aria-hidden>→</span>
          </Link>
        }
      />

      <div className="mt-12 overflow-x-auto">
        {error !== null ? (
          <div className="border-t border-border py-10">
            <p className="text-sm text-accent">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="link-slide mt-4 font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:text-primary"
            >
              重试 →
            </button>
          </div>
        ) : competitions === null ? (
          <p className="border-t border-border py-10 font-mono text-sm text-muted-foreground">
            正在加载比赛数据…
          </p>
        ) : competitions.length === 0 ? (
          <div className="border-t border-border py-10">
            <p className="font-mono text-sm text-muted-foreground">暂无比赛。</p>
            <Link
              to="/admin/competitions/new"
              className="link-slide mt-4 inline-block font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:text-primary"
            >
              新建第一场比赛 →
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass}>比赛名称</th>
                <th className={thClass}>状态</th>
                <th className={thClass}>报名截止</th>
                <th className={thClass}>更新时间</th>
                <th className={thClass}>操作</th>
              </tr>
            </thead>
            <tbody>
              {competitions.map((competition) => (
                <tr key={competition.id} className="border-b border-border">
                  <td className={`${tdClass} max-w-[280px] font-medium leading-snug`}>
                    {competition.title}
                  </td>
                  <td className={tdClass}>
                    <CompetitionStatusBadge status={competition.status} />
                  </td>
                  <td className={`${tdClass} font-mono text-[13px]`}>
                    {formatBeijingTime(competition.registrationDeadline)}
                  </td>
                  <td className={`${tdClass} font-mono text-[13px] text-muted-foreground`}>
                    {formatBeijingTime(competition.updatedAt)}
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/admin/competitions/${competition.id}/edit`}
                        className="link-slide font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:text-primary"
                      >
                        编辑 →
                      </Link>
                      <Link
                        to={`/admin/competitions/${competition.id}/registrations`}
                        className="link-slide font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:text-primary"
                      >
                        报名 →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
