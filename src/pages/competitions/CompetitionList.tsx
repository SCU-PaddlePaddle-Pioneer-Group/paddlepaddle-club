import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getCompetitions, formatDeadline } from '@/pages/competitions/data'
import type { Competition } from '@/pages/competitions/data'

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: Competition[] }

export default function CompetitionList() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    getCompetitions(controller.signal)
      .then(items => { if (active) setState({ kind: 'ready', items }) })
      .catch(error => { if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : '赛事加载失败。' }) })
    return () => { active = false; controller.abort() }
  }, [attempt])
  function retry() { setState({ kind: 'loading' }); setAttempt(value => value + 1) }
  return (
    <section className="container-x py-16 md:py-24">
      <Link to="/" className="link-slide text-sm text-muted-foreground">← 返回首页</Link>
      <header className="mt-10">
        <p className="section-eyebrow">COMPETITIONS / 赛事</p>
        <h1 className="section-title">赛事中心</h1>
        <p className="section-desc">找到感兴趣的比赛，了解规则，让所学在实践中发生。</p>
      </header>
      <div className="mt-12" aria-busy={state.kind === 'loading'}>
        <div role="status" aria-live="polite">
          {state.kind === 'loading' && <p className="border-y border-border py-10 text-muted-foreground">正在加载赛事…</p>}
          {state.kind === 'error' && <div className="flex flex-wrap items-center justify-between gap-5 border-y border-border py-10">
            <p>{state.message}</p><button className="btn-outline" onClick={retry}>重新加载</button>
          </div>}
          {state.kind === 'ready' && state.items.length === 0 && <p className="border-y border-border py-10 text-muted-foreground">暂无已发布赛事，欢迎稍后关注。</p>}
        </div>
        {state.kind === 'ready' && state.items.length > 0 && <ul className="divide-y divide-border border-y border-border">
          {state.items.map(item => <li key={item.id}>
            <Link to={`/competitions/${encodeURIComponent(String(item.id))}`} className="group grid gap-5 py-8 transition-colors duration-200 hover:bg-secondary/40 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">报名截止（北京时间） <time dateTime={item.registrationDeadline}>{formatDeadline(item.registrationDeadline)}</time></p>
                <h2 className="mt-3 break-words text-2xl font-bold group-hover:text-primary">{item.title}</h2>
                <p className="mt-3 break-words text-muted-foreground">{item.summary}</p>
              </div>
              <span className="text-sm font-semibold text-primary">查看详情与报名 <span aria-hidden="true">→</span></span>
            </Link>
          </li>)}
        </ul>}
      </div>
    </section>
  )
}
