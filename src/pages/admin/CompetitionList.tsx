/**
 * 比赛管理列表页（D2 骨架）：路由 /admin/competitions。
 * 展示全部状态（draft / published / offline）的比赛，可进入编辑与新建。
 * 骨架阶段数据来自统一模拟数据，不做伪造的成功操作。
 */
import { Link } from 'react-router'
import { MOCK_COMPETITIONS, formatBeijingTime } from '@/mocks/competitions'
import { AdminPageHeader, CompetitionStatusBadge } from './shared'

const thClass =
  'py-3 pr-6 align-bottom font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'
const tdClass = 'py-4 pr-6 align-middle text-sm text-foreground'

/**
 * 比赛管理列表（D2 骨架）。
 * 数据源：统一模拟数据；接口就绪后替换为 GET /api/admin/competitions。
 */
export default function CompetitionList() {
  const competitions = MOCK_COMPETITIONS

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
        {competitions.length === 0 ? (
          <p className="border-t border-border py-10 font-mono text-sm text-muted-foreground">
            暂无比赛。
          </p>
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
                    <Link
                      to={`/admin/competitions/${competition.id}/edit`}
                      className="link-slide font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:text-primary"
                    >
                      编辑 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        骨架版本 · 数据为统一模拟数据，发布 / 下架操作在编辑页
      </p>
    </section>
  )
}
