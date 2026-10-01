/**
 * 帖子数据层（DESIGN.md §5.1 / §5.3）。
 * 构建期通过 import.meta.glob 读取 src/content/posts/*.md，
 * 自写精简 front matter 解析，正文用 markdown-it 渲染为 HTML 字符串。
 */

import MarkdownIt from 'markdown-it'
import type { RendererRule } from 'markdown-it'

export type PostKind = 'project' | 'event'

export interface PostMeta {
  title: string
  slug: string
  /** ISO 日期 YYYY-MM-DD */
  date: string
  postKind: PostKind
  summary: string
}

export interface Post extends PostMeta {
  /** 渲染后的 HTML 正文 */
  html: string
}

const md = new MarkdownIt({ html: true, linkify: true })

// §5.3：图片渲染为 figure + figcaption（图注取自 alt），懒加载 + img-toned 灰度还原
md.renderer.rules.image = ((tokens, idx) => {
  const token = tokens[idx]
  const src = String(token.attrGet('src') ?? '')
  const alt = token.content
  const caption = alt ? `<figcaption>${md.utils.escapeHtml(alt)}</figcaption>` : ''
  return `<figure><img src="${md.utils.escapeHtml(src)}" alt="${md.utils.escapeHtml(alt)}" loading="lazy" class="img-toned">${caption}</figure>\n`
}) as RendererRule

/** 解析 `---` 包裹的 YAML 子集：key: value，值可带单/双引号，date 原样保留字符串。 */
function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { data: {}, body: raw }
  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[m[1]] = value
  }
  return { data, body: raw.slice(match[0].length) }
}

const rawPosts = import.meta.glob<string>('@/content/posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const posts: Post[] = Object.values(rawPosts)
  .map((raw): Post | undefined => {
    const { data, body } = parseFrontMatter(raw)
    const { title, date, slug } = data
    if (!title || !date || !slug) return undefined
    const postKind: PostKind = data.postKind === 'project' ? 'project' : 'event'
    return {
      title,
      slug,
      date,
      postKind,
      summary: data.summary ?? '',
      html: md.render(body),
    }
  })
  .filter((post): post is Post => post !== undefined)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

const metas: PostMeta[] = posts.map(({ title, slug, date, postKind, summary }) => ({
  title,
  slug,
  date,
  postKind,
  summary,
}))

/** 全部帖子元信息，按 date 时间倒序（最新在前）。 */
export function getAllPosts(): PostMeta[] {
  return metas
}

/** 按 slug 取单篇帖子（含渲染好的 HTML 正文）；不存在返回 undefined。 */
export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug)
}
