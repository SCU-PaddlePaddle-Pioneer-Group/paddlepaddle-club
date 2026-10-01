/**
 * 静态资源路径助手。
 * 站点以 base './' 构建并可能部署在子路径（如 GitHub Pages 项目页），
 * 因此 public/ 下的资源一律通过该函数拼接，禁止写死 '/images/...' 绝对路径。
 *
 * 用法：asset('images/logo.png') → './images/logo.png'
 */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`
}
