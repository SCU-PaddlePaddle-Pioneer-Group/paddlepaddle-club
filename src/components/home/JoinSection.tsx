import { CLUB, JOIN } from '@/data/club'
import { asset } from '@/lib/asset'

/** 真实活动照片横带（选自 DESIGN.md §图片素材清单，三个不同活动）。 */
const PHOTOS = [
  {
    src: asset('images/posts/thangka-workshop-review/13-adf46509.jpg'),
    alt: '「一日唐卡修复师」活动：参与者体验唐卡亲绘',
  },
  {
    src: asset('images/posts/thangka-workshop-review/15-e0631ae3.jpg'),
    alt: '唐卡 AI 修复工作坊活动合照',
  },
  {
    src: asset('images/posts/prompt-engineer-certification/11-e6bf8c53.jpg'),
    alt: '提示词工程师认证培训现场',
  },
]

/** 加入我们：团徽蓝平涂色域，招新信息 + QQ 群号 + GitHub 入口 + 活动照片横带。 */
export default function JoinSection() {
  return (
    <section id="join" className="field-blue">
      <div className="container-x py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <p className="section-eyebrow text-white/60">04 — 加入我们</p>
            <h2 className="mt-6 font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
              {JOIN.title}
            </h2>
            <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed text-white/80">{JOIN.desc}</p>
          </div>

          <div className="flex flex-col justify-center gap-8">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/60">{JOIN.qqNote}</p>
              <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.08em] text-white md:text-4xl">
                {CLUB.links.qqGroup}
              </p>
            </div>
            <div className="border-t border-white/15 pt-8">
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-white/60">{JOIN.wechatNote}</p>
              <p className="mt-2 font-display text-xl font-bold text-white">「{CLUB.links.wechat}」</p>
            </div>
            <div className="border-t border-white/15 pt-8">
              <a href={CLUB.links.github} target="_blank" rel="noopener" className="btn-ghost-on-ink">
                GitHub 组织
                <span aria-hidden>↗</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {PHOTOS.map((p) => (
            <img
              key={p.src}
              src={p.src}
              alt={p.alt}
              loading="lazy"
              className="img-toned aspect-[4/3] w-full border border-white/20 object-cover"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
