import { Link } from 'react-router'
import { getAllPosts } from '@/lib/posts'

/** ISO 日期 YYYY-MM-DD → 展示格式 YYYY.MM.DD */
function formatDate(iso: string): string {
  return iso.replaceAll('-', '.')
}

/** 社团动态预览：最新 5 条 post-row 列表，右上角入口查看全部。 */
export default function FeedSection() {
  const posts = getAllPosts().slice(0, 5)

  return (
    <section id="feed">
      <div className="container-x py-16 md:py-24">
        <div className="flex items-end justify-between gap-6">
          <p className="section-eyebrow">03 — 社团动态</p>
          <Link
            to="/posts"
            className="link-slide shrink-0 font-mono text-[13px] tracking-[0.08em] text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            查看全部动态 →
          </Link>
        </div>

        <div className="mt-10">
          {posts.length === 0 ? (
            <p className="border-y border-border py-10 text-muted-foreground">动态整理中，敬请期待。</p>
          ) : (
            posts.map((p) => (
              <Link key={p.slug} to={`/posts/${p.slug}`} className="post-row group">
                <span className="font-mono text-[13px] text-muted-foreground">{formatDate(p.date)}</span>
                <span>
                  {p.postKind === 'event' ? (
                    <span className="tag-event">活动</span>
                  ) : (
                    <span className="tag-project">项目</span>
                  )}
                </span>
                <span className="row-title font-display text-[17px] font-semibold">{p.title}</span>
                <span className="row-arrow justify-self-end font-mono text-[15px] text-muted-foreground" aria-hidden>
                  →
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
