import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getAllPosts, type PostKind } from '@/lib/posts'

type Filter = 'all' | PostKind

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'event', label: '活动' },
  { key: 'project', label: '项目' },
]

/** YYYY-MM-DD → YYYY.MM.DD */
function formatDate(date: string): string {
  return date.replaceAll('-', '.')
}

/**
 * 动态列表页（DESIGN.md §5.4）：
 * 题头三行式 + 全部/活动/项目 文字筛选 + post-row 发丝线列表。
 */
export default function Posts() {
  const [filter, setFilter] = useState<Filter>('all')
  const posts = useMemo(
    () => getAllPosts().filter((post) => filter === 'all' || post.postKind === filter),
    [filter],
  )

  return (
    <section className="container-x py-16 md:py-24">
      <Link to="/" className="link-slide font-mono text-[13px] text-muted-foreground">
        ← 返回首页
      </Link>

      <header className="mt-10">
        <p className="section-eyebrow">动态 / FEED</p>
        <h1 className="section-title">社团动态</h1>
        <p className="section-desc">
          这里记录着社团走过的每一步——新技术的学习分享、正在推进的项目、以及每一次活动留下的成果。
        </p>
      </header>

      <div className="mt-12 flex items-center gap-8" role="group" aria-label="动态类型筛选">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={active}
              className={`relative pb-2 font-mono text-[12px] uppercase tracking-[0.18em] transition-colors duration-200 ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              <span
                aria-hidden
                className={`absolute bottom-0 left-0 h-[2px] w-full origin-left bg-accent transition-transform duration-200 ${
                  active ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          )
        })}
      </div>

      <div className="mt-10">
        {posts.length === 0 ? (
          <p className="border-t border-border py-10 font-mono text-sm text-muted-foreground">
            暂无该类型动态。
          </p>
        ) : (
          posts.map((post) => (
            <Link key={post.slug} to={`/posts/${post.slug}`} className="post-row group">
              <span className="font-mono text-[13px] text-muted-foreground">
                {formatDate(post.date)}
              </span>
              <span>
                <span className={post.postKind === 'project' ? 'tag-project' : 'tag-event'}>
                  {post.postKind === 'project' ? '项目' : '活动'}
                </span>
              </span>
              <span className="row-title text-[17px] font-medium leading-snug">{post.title}</span>
              <span className="row-arrow font-mono text-[15px] text-muted-foreground" aria-hidden>
                →
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}
