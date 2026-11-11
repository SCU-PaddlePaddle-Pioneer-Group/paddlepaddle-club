/**
 * 管理员登录页（D1/D6）：路由 /admin/login。
 * 真实接口：POST /api/admin/login（C 已实现）；成功由后台设置 HttpOnly Cookie 后跳比赛管理。
 * 失败按 error.code 映射文案（errorMessages.ts），不匹配 message；凭据错误留在登录页。
 * 401 UNAUTHENTICATED 类失效由 api.ts 统一派发事件、受保护页守卫处理（useAdminSession.ts）。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiRequest, ApiError } from '@/lib/api'
import { loginErrorMessage } from './errorMessages'

const loginSchema = z.object({
  username: z.string().min(1, '请输入管理员账号'),
  password: z.string().min(1, '请输入密码'),
})

type LoginValues = z.infer<typeof loginSchema>

const inputClass =
  'w-full border border-border bg-background px-3.5 py-2.5 text-[15px] text-foreground ' +
  'placeholder:text-muted-foreground/60 transition-colors duration-200 ' +
  'focus:border-primary focus:outline-none'

const labelClass =
  'mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground'

export default function Login() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (values: LoginValues) => {
    setSubmitError(null)
    try {
      await apiRequest<{ admin: { id: string; username: string } }>('/admin/login', {
        method: 'POST',
        body: { username: values.username, password: values.password },
      })
      navigate('/admin/competitions', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(loginErrorMessage(error.code))
        return
      }
      setSubmitError('登录失败，请稍后重试。')
    }
  }

  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto w-full max-w-md">
        <header className="mt-10">
          <p className="section-eyebrow">管理后台 / ADMIN</p>
          <h1 className="section-title">管理员登录</h1>
          <p className="section-desc">赛事管理后台仅限社团管理员使用。</p>
        </header>

        <form className="mt-12 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label htmlFor="admin-username" className={labelClass}>
              管理员账号
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              className={inputClass}
              {...register('username')}
            />
            {errors.username && (
              <p className="mt-1.5 text-[13px] text-accent">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="admin-password" className={labelClass}>
              密码
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1.5 text-[13px] text-accent">{errors.password.message}</p>
            )}
          </div>

          {submitError && (
            <p className="border border-accent/50 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-accent">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full justify-center disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          会话有效期 8 小时 · 权限校验以后台为准
        </p>
      </div>
    </section>
  )
}
