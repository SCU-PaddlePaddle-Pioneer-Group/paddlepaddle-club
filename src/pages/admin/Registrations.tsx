/**
 * 报名管理页（D5 骨架）：路由 /admin/competitions/:id/registrations。
 * 按比赛查看报名列表，修改处理状态（待处理 / 已确认 / 已拒绝）。
 * 骨架阶段：比赛选择用统一模拟数据；状态修改不伪造成功，仅显示「未接入」提示。
 * TODO(D5): 接口就绪后本页应支持「从比赛管理跳转指定比赛」与「页内切换比赛」两种入口。
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  MOCK_COMPETITIONS,
  MOCK_REGISTRATIONS,
  formatBeijingTime,
} from '@/mocks/competitions'
import { AdminPageHeader, RegistrationStatusBadge } from './shared'

const thClass =
  'py-3 pr-6 align-bottom font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'
const tdClass = 'py-4 pr-6 align-middle text-sm text-foreground'
const selectClass =
  'border border-border bg-background px-3 py-2.5 text-[15px] text-foreground transition-colors duration-200 focus:border-primary focus:outline-none'
const rowActionClass =
  'font-mono text-[12px] text-muted-foreground transition-colors duration-200 hover:text-primary disabled:pointer-events-none disabled:opacity-40'

export default function Registrations() {
  // 路由参数 :id 就绪后作为初始选中比赛；骨架阶段路由尚未接入（A 负责），先允许页内切换。
  const { id } = useParams<{ id: string }>()
  const [competitionId, setCompetitionId] = useState<string>(
    id ?? MOCK_COMPETITIONS[0]?.id ?? '',
  )
  const [notice, setNotice] = useState<string | null>(null)

  const registrations = useMemo(
    () => MOCK_REGISTRATIONS.filter((item) => item.competitionId === competitionId),
    [competitionId],
  )

  const notWired = () => {
    // 细则红线：状态修改结果必须来自后台响应；骨架阶段不显示成功。
    setNotice('「修改报名状态」后台接口未接入：骨架阶段不提交数据。')
  }

  return (
    <section className="container-x py-16 md:py-24">
      <Link to="/admin/competitions" className="link-slide font-mono text-[13px] text-muted-foreground">
        ← 返回比赛管理
      </Link>

      <AdminPageHeader title="报名管理" desc="按比赛查看报名记录并处理；邮箱等个人信息不进入任何公开接口。" />

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <label htmlFor="registrations-competition" className={thClass}>
          选择比赛
        </label>
        <select
          id="registrations-competition"
          className={selectClass}
          value={competitionId}
          onChange={(event) => {
            setCompetitionId(event.target.value)
            setNotice(null)
          }}
        >
          {MOCK_COMPETITIONS.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.title}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <p className="mt-6 border border-accent/50 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-accent">
          {notice}
        </p>
      )}

      <div className="mt-8 overflow-x-auto">
        {registrations.length === 0 ? (
          <p className="border-t border-border py-10 font-mono text-sm text-muted-foreground">
            该比赛暂无报名。
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
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
                        disabled={registration.status === 'confirmed'}
                        onClick={notWired}
                      >
                        确认
                      </button>
                      <button
                        type="button"
                        className={rowActionClass}
                        disabled={registration.status === 'rejected'}
                        onClick={notWired}
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
        骨架版本 · 数据为统一模拟数据，真实保存以后台响应为准
      </p>
    </section>
  )
}
