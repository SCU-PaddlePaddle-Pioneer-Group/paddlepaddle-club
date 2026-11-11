import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { ADMIN_UNAUTHORIZED_EVENT, ApiError, apiRequest } from '@/lib/api'

type SessionState = { key: string; status: 'ready' | 'unauthorized' | 'error' }

/** 管理路由统一预检，包括没有查询请求的新建页；接口仍由 C 独立鉴权。 */
export default function AdminAccess() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const [session, setSession] = useState<SessionState | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const key = `${pathname}:${attempt}`

  useEffect(() => {
    const unauthorized = () => navigate('/admin/login', { replace: true })
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, unauthorized)
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, unauthorized)
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    apiRequest<{ admin: { id: string; username: string } }>('/admin/me', { signal: controller.signal })
      .then(() => { if (active) setSession({ key, status: 'ready' }) })
      .catch((error: unknown) => {
        if (active) setSession({ key, status: error instanceof ApiError && error.status === 401 ? 'unauthorized' : 'error' })
      })
    return () => { active = false; controller.abort() }
  }, [key])

  if (session?.key !== key) return <p className="container-x py-16" role="status">正在确认管理员身份…</p>
  if (session.status === 'unauthorized') return <Navigate to="/admin/login" replace />
  if (session.status === 'error') return (
    <section className="container-x py-16" role="status">
      <p>暂时无法确认登录状态，请检查服务后重试。</p>
      <button className="btn-outline mt-6" onClick={() => setAttempt(value => value + 1)}>重新加载</button>
      <Link to="/" className="ml-6 link-slide">返回官网</Link>
    </section>
  )

  async function logout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await apiRequest('/admin/logout', { method: 'POST' })
      navigate('/admin/login', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) navigate('/admin/login', { replace: true })
      else setLogoutError('退出未完成，请重试。')
    } finally { setLoggingOut(false) }
  }

  return <>
    <div className="border-b border-border bg-secondary/50">
      <nav className="container-x flex flex-wrap items-center gap-5 py-4 text-sm" aria-label="后台导航">
        <Link to="/admin/competitions" className="link-slide text-primary">比赛管理</Link>
        <Link to="/" className="link-slide">返回官网</Link>
        <button className="ml-auto font-semibold text-primary disabled:opacity-50" disabled={loggingOut} onClick={logout}>
          {loggingOut ? '正在退出…' : '退出登录'}
        </button>
      </nav>
      {logoutError && <p className="container-x pb-4 text-sm text-accent" role="alert">{logoutError}</p>}
    </div>
    <Outlet />
  </>
}
