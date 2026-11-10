import { Link } from 'react-router'

/** B、D 页面交付前的路由占位，不模拟报名或管理员认证。 */
export default function ModulePending({ title, description }: { title: string; description: string }) {
  return (
    <section className="container-x py-20 md:py-28">
      <p className="section-eyebrow">SCU PADDLEPADDLE</p>
      <h1 className="section-title">{title}</h1>
      <p className="section-desc">{description}</p>
      <Link to="/" className="btn-outline mt-8">返回首页 <span aria-hidden="true">→</span></Link>
    </section>
  )
}
