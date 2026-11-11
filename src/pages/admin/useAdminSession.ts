/**
 * 受保护管理页通用守卫（D6）：收到 api.ts 的 401 事件即清态跳登录。
 * 事件由 B 的 apiRequest 在管理请求返回 401（排除登录接口）时派发；
 * 页面自身不做会话预检，权限校验由后台兜底（细则 D6）。
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ADMIN_UNAUTHORIZED_EVENT } from '@/lib/api'

export function useAdminSessionGuard(): void {
  const navigate = useNavigate()
  useEffect(() => {
    const handleUnauthorized = () => {
      navigate('/admin/login', { replace: true })
    }
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [navigate])
}
