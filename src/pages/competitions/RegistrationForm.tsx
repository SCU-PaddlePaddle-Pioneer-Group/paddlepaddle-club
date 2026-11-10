import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '@/lib/api'
import { register } from '@/pages/competitions/data'
import type { RegistrationReceipt } from '@/pages/competitions/data'

export default function RegistrationForm({ competitionId, closed }: { competitionId: string; closed: boolean }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.current?.abort() }
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || closed || unavailable || receipt) return
    const trimmedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    if (!trimmedName || trimmedName.length > 80) { setError('请填写姓名（1 至 80 个字符）。'); return }
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError('请填写有效的邮箱地址。'); return }
    inFlight.current = true
    controller.current = new AbortController()
    setPending(true); setError('')
    try {
      const result = await register(competitionId, { name: trimmedName, email: normalizedEmail }, controller.current.signal)
      if (mounted.current) setReceipt(result)
    } catch (cause) {
      if (!mounted.current) return
      const uncertain = cause instanceof ApiError && (cause.status === 0 || cause.status >= 500 || cause.code === 'INVALID_RECEIPT' || cause.code === 'INVALID_RESPONSE')
      setError(uncertain
        ? '暂时无法确认报名结果，请联系管理员核实后再重试，勿连续提交。'
        : cause instanceof Error ? cause.message : '报名未完成，请稍后重试。')
      if (cause instanceof ApiError && (cause.status === 404 || ['REGISTRATION_CLOSED', 'COMPETITION_UNAVAILABLE'].includes(cause.code))) setUnavailable(true)
    } finally {
      inFlight.current = false
      if (mounted.current) setPending(false)
    }
  }
  if (receipt) return <div className="border-y border-border py-8" role="status">
    <h3 className="text-xl font-bold text-primary">报名已提交</h3>
    <p className="mt-3">报名编号：<strong className="break-all font-mono">{receipt.id}</strong></p>
    <p className="mt-3 text-muted-foreground">处理状态：待处理。请保存编号，等待管理员确认。</p>
  </div>
  return <form onSubmit={submit} noValidate className="mt-6 max-w-xl" aria-busy={pending}>
    <fieldset disabled={pending || closed || unavailable} className="space-y-6 disabled:opacity-70">
      <legend className="sr-only">个人报名信息</legend>
      <div><label htmlFor="registration-name" className="mb-2 block text-sm font-semibold">姓名（必填）</label>
        <input id="registration-name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required maxLength={80} aria-describedby={error ? 'registration-error' : undefined} className="w-full rounded-md border border-border bg-background px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary" />
      </div>
      <div><label htmlFor="registration-email" className="mb-2 block text-sm font-semibold">邮箱（必填）</label>
        <input id="registration-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} aria-describedby={`registration-hint${error ? ' registration-error' : ''}`} className="w-full rounded-md border border-border bg-background px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary" />
        <p id="registration-hint" className="mt-2 text-sm text-muted-foreground">同一比赛请使用同一邮箱，勿重复报名。</p>
      </div>
      <button type="submit" className="btn-primary disabled:cursor-not-allowed">{pending ? '正在提交…' : closed || unavailable ? '当前不可报名' : '提交报名'} <span aria-hidden="true">→</span></button>
    </fieldset>
    {error && <p id="registration-error" role="alert" className="mt-5 break-words text-sm text-accent">{error}</p>}
    <p className="mt-4 text-sm text-muted-foreground">提交是否成功以服务器返回结果为准。</p>
  </form>
}
