import { Link, useParams } from 'react-router'
import { getPost } from '@/lib/posts'

/** YYYY-MM-DD → YYYY 年 M 月 D 日 */
function formatDateCn(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
}

/**
 * 帖子详情页（DESIGN.md §5.5）：
 * 760px 窄栏，题头区（tag + 日期 + H1 + summary）与正文之间发丝线，
 * 正文由 markdown-it 渲染为 HTML（排版样式全在 index.css 的 .post-body）。
 */
export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined

  if (!post) {
    return (
      <section className="mx-auto max-w-[760px] px-6 py-16 md:py-24">
        <h1 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-[1.2] tracking-[-0.02em]">
          文章不存在或已被移动。
        </h1>
        <Link to="/posts" className="btn-primary mt-10">
          返回动态列表
        </Link>
      </section>
    )
  }

  return (
    <article className="mx-auto max-w-[760px] px-6 py-16 md:py-24">
      <Link to="/posts" className="link-slide font-mono text-[13px] text-muted-foreground">
        ← 返回动态列表
      </Link>

      <header className="mt-10 border-b border-border pb-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className={post.postKind === 'project' ? 'tag-project' : 'tag-event'}>
            {post.postKind === 'project' ? '项目' : '活动'}
          </span>
          <time dateTime={post.date} className="font-mono text-[13px] text-muted-foreground">
            {formatDateCn(post.date)}
          </time>
        </div>
        <h1 className="mt-6 font-display text-[clamp(1.8rem,3.5vw,2.7rem)] font-extrabold leading-[1.2] tracking-[-0.02em]">
          {post.title}
        </h1>
        {post.summary && (
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">{post.summary}</p>
        )}
      </header>

      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />

      <footer className="mt-14 border-t border-border pt-10">
        <Link to="/posts" className="btn-outline">
          ← 返回动态列表
        </Link>
      </footer>
    </article>
  )
}
