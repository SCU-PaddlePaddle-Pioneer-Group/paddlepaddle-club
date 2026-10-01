import { Link } from 'react-router'

/** 404：描边空心大号 404 + 回首页 / 看动态两个出口。 */
export default function NotFound() {
  return (
    <section className="container-x py-24 md:py-32">
      <p
        className="font-mono text-[clamp(6rem,16vw,12rem)] font-bold leading-none"
        style={{ color: 'transparent', WebkitTextStroke: '2px hsl(var(--primary))' }}
        aria-hidden
      >
        404
      </p>
      <h1 className="mt-8 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em]">
        页面走丢了
      </h1>
      <p className="mt-4 text-[16px] text-muted-foreground">你访问的页面不存在，或已被移动到别处。</p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link to="/" className="btn-primary">
          回到首页
          <span className="btn-arrow" aria-hidden>
            →
          </span>
        </Link>
        <Link to="/posts" className="btn-outline">
          看看社团动态
        </Link>
      </div>
    </section>
  )
}
