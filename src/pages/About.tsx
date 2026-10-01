import { Link } from 'react-router'
import { CLUB } from '@/data/club'

/** 「我们相信」四条 —— 出自 legacy/content/about/_index.md。 */
const BELIEFS = [
  {
    index: '01',
    title: '从基础出发',
    text: '一起补齐 Python、机器学习、深度学习与工程实践基础。',
  },
  {
    index: '02',
    title: '用项目学习',
    text: '围绕真实问题完成从想法、实验到部署的完整闭环。',
  },
  {
    index: '03',
    title: '在协作中成长',
    text: '通过 Issue、Pull Request、Code Review 和技术分享积累团队经验。',
  },
  {
    index: '04',
    title: '把成果留下来',
    text: '沉淀学习笔记、实验记录、工具脚本和可复用项目，持续建设公开技术社区。',
  },
] as const

/** 关于页：宣言 + 学习闭环 +「我们相信」四列 + 参与方式，角落水印 CULTURE。 */
export default function About() {
  return (
    <section className="relative overflow-hidden">
      <div className="container-x py-16 md:py-24">
        <p className="section-eyebrow">关于社团</p>
        <p className="mt-8 max-w-[30ch] font-display text-[clamp(1.3rem,2.4vw,1.9rem)] font-medium leading-relaxed">
          {CLUB.manifesto}
        </p>
        <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[13.5px] text-muted-foreground">
          {CLUB.flow.map((step, i) => (
            <span key={step} className="flex items-center gap-3">
              {step}
              {i < CLUB.flow.length - 1 && (
                <span className="text-accent" aria-hidden>
                  →
                </span>
              )}
            </span>
          ))}
        </p>

        <div className="mt-20">
          <p className="section-eyebrow">我们相信</p>
          <div className="mt-10 grid gap-10 border-t border-border pt-10 sm:grid-cols-2 md:grid-cols-4 md:gap-0 md:divide-x md:divide-border">
            {BELIEFS.map((b) => (
              <div key={b.index} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <p className="font-mono text-[12px] tracking-[0.2em] text-muted-foreground">{b.index}</p>
                <h3 className="mt-3 font-display text-[19px] font-bold">{b.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 flex flex-wrap gap-4">
          <Link to="/posts" className="btn-primary">
            查看社团动态
            <span className="btn-arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link to="/#join" className="btn-outline">
            加入我们
          </Link>
        </div>
      </div>
      <span className="watermark bottom-4 right-0 hidden text-[13vw] md:block" aria-hidden>
        CULTURE
      </span>
    </section>
  )
}
