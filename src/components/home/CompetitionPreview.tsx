import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getCompetitionPreview } from '@/lib/competition-preview'
import type { CompetitionPreviewItem } from '@/lib/competition-preview'

type PreviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; items: CompetitionPreviewItem[] }

const deadlineFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export default function CompetitionPreview() {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    // 同时限制等待时间，接口无响应时也允许用户重试。
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    let active = true
    getCompetitionPreview(controller.signal)
      .then((items) => {
        if (active) setState({ status: 'success', items })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  return (
    <section id="competitions" aria-labelledby="competition-preview-title" className="border-t border-border">
      <div className="container-x py-16 md:py-24">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="section-eyebrow">COMPETITIONS · 赛事中心</p>
            <h2 id="competition-preview-title" className="section-title">让所学，在赛场发生</h2>
            <p className="section-desc">关注近期赛事，了解比赛规则与报名安排。</p>
          </div>
          <Link to="/competitions" className="link-slide shrink-0 text-[14px] font-medium text-primary">
            全部赛事 <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-10" aria-busy={state.status === 'loading'}>
          <div role="status" aria-live="polite">
            {state.status === 'loading' && (
              <p className="border-y border-border py-10 text-muted-foreground">正在加载近期赛事…</p>
            )}
            {state.status === 'error' && (
              <div className="flex flex-wrap items-center justify-between gap-5 border-y border-border py-10">
                <p className="text-muted-foreground">赛事暂时无法加载，请稍后重试。</p>
                <button type="button" className="btn-outline" onClick={() => {
                  setState({ status: 'loading' })
                  setAttempt((value) => value + 1)
                }}>重新加载</button>
              </div>
            )}
            {state.status === 'success' && state.items.length === 0 && (
              <p className="border-y border-border py-10 text-muted-foreground">暂无已发布赛事，欢迎稍后关注。</p>
            )}
          </div>
          {state.status === 'success' && state.items.length > 0 && (
            <ul className="divide-y divide-border border-y border-border">
              {state.items.map((item) => (
                <li key={item.id}>
                  <Link to={`/competitions/${encodeURIComponent(String(item.id))}`}
                    className="group grid gap-4 py-7 transition-colors duration-200 hover:bg-secondary/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-muted-foreground">
                        报名截止（北京时间） <time dateTime={item.registrationDeadline}>
                          {deadlineFormatter.format(new Date(item.registrationDeadline))}
                        </time>
                      </p>
                      <h3 className="mt-3 break-words text-xl font-bold leading-snug transition-colors duration-200 group-hover:text-primary">{item.title}</h3>
                      <p className="mt-2 break-words text-[15px] text-muted-foreground">{item.summary}</p>
                    </div>
                    <span className="text-[14px] font-semibold text-primary">查看详情 <span aria-hidden="true">→</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
