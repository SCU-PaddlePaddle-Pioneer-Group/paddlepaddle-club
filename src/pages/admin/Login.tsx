/**
 * 管理员登录页（D1/D6 骨架）：路由 /admin/login。
 * 骨架阶段不执行真实登录——等待 docs/api.md 定稿后接 B 的 src/lib/api.ts。
 * 不伪造成功：提交仅显示「未接入」提示，不做任何跳转或成功反馈。
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AdminPageHeader } from './shared'

const loginSchema = z.object({
  // TODO(D1): 字段名与请求体以 docs/api.md 定稿为准（当前约定 POST /api/admin/login）
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
  const [notice, setNotice] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = () => {
    // TODO(D1/D6): 调用 POST /api/admin/login；成功保存会话，失败展示后台返回 message。
    // 骨架阶段一律不显示成功状态（细则：失败不得显示成功）。
    setNotice('后台接口未接入：骨架阶段不执行真实登录，等待 docs/api.md 与 src/lib/api.ts 就绪。')
  }

  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto w-full max-w-md">
        <AdminPageHeader title="管理员登录" desc="赛事管理后台仅限社团管理员使用。" />

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

          {notice && (
            <p className="border border-accent/50 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-accent">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full justify-center disabled:pointer-events-none disabled:opacity-50"
          >
            登录
          </button>
        </form>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          骨架版本 · 权限校验以后台会话为准
        </p>
      </div>
    </section>
  )
}
