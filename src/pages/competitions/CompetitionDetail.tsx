import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/lib/api'
import { getCompetition, formatDeadline } from '@/pages/competitions/data'
import type { CompetitionDetail as Detail } from '@/pages/competitions/data'
import RegistrationForm from '@/pages/competitions/RegistrationForm'

type State = { kind: 'loading' } | { kind: 'error'; message: string; missing: boolean } | { kind: 'ready'; item: Detail }
function DetailContent({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    getCompetition(id, controller.signal)
      .then(item => { if (active) setState({ kind: 'ready', item }) })
      .catch(error => { if (active) setState({ kind: 'error', message: error instanceof Error ? error.message : '赛事加载失败。', missing: error instanceof ApiError && error.status === 404 }) })
    return () => { active = false; controller.abort() }
  }, [id, attempt])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const closed = state.kind === 'ready' && (state.item.registrationOpen === false || Date.parse(state.item.registrationDeadline) <= now)
  return <section className="container-x py-16 md:py-24">
    <Link to="/competitions" className="link-slide text-sm text-muted-foreground">← 返回赛事列表</Link>
    <div className="mt-10" aria-busy={state.kind === 'loading'}>
      {state.kind === 'loading' && <p role="status" className="py-10">正在加载赛事详情…</p>}
      {state.kind === 'error' && <div role="status" className="border-y border-border py-10">
        <h1 className="section-title">{state.missing ? '赛事不存在或已下架' : '赛事暂时无法加载'}</h1>
        <p className="mt-4 text-muted-foreground">{state.missing ? '请返回列表查看其他已发布赛事。' : state.message}</p>
        {!state.missing && <button className="btn-outline mt-6" onClick={() => { setState({ kind: 'loading' }); setAttempt(value => value + 1) }}>重新加载</button>}
      </div>}
      {state.kind === 'ready' && <>
        <header className="max-w-3xl">
          <p className="section-eyebrow">COMPETITION / 比赛详情</p>
          <h1 className="section-title break-words">{state.item.title}</h1>
          <p className="section-desc break-words">{state.item.summary}</p>
          <p className="mt-6 font-mono text-sm text-muted-foreground">报名截止（北京时间） <time dateTime={state.item.registrationDeadline}>{formatDeadline(state.item.registrationDeadline)}</time></p>
          <p className="mt-3 font-semibold text-primary" role="status">{closed ? '报名已截止' : '报名时间内，请阅读规则后填写报名信息'}</p>
        </header>
        <div className="mt-12 grid gap-12 border-t border-border pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="rules-title" className="min-w-0"><h2 id="rules-title" className="text-2xl font-bold">比赛规则</h2>
            <p className="mt-6 whitespace-pre-wrap break-words leading-8">{state.item.rules || '暂无补充规则。'}</p>
          </section>
          <section aria-labelledby="registration-title" className="min-w-0"><h2 id="registration-title" className="text-2xl font-bold">个人报名</h2>
            <RegistrationForm competitionId={id} closed={closed} />
          </section>
        </div>
      </>}
    </div>
  </section>
}
export default function CompetitionDetail() {
  const { id } = useParams()
  return <DetailContent key={id} id={id ?? ''} />
}
