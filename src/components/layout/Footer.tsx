import { CLUB } from '@/data/club'

export default function Footer() {
  return (
    <footer className="field-ink">
      <div className="container-x py-16 md:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[18ch] font-display text-[clamp(1.6rem,3vw,2.4rem)] font-extrabold leading-snug tracking-[-0.02em] text-white">
            {CLUB.nameFull}
          </h2>
          <div className="flex flex-col gap-4 text-[15px]">
            <a
              href={CLUB.links.github}
              target="_blank"
              rel="noopener"
              className="link-slide w-fit text-white/80 transition-colors duration-200 hover:text-white"
            >
              GitHub 组织 ↗
            </a>
            <p className="text-white/60">
              招新 QQ 群 <span className="font-mono tracking-[0.08em] text-white">{CLUB.links.qqGroup}</span>
            </p>
            <p className="text-white/60">微信公众号「{CLUB.links.wechat}」</p>
          </div>
        </div>
        <div className="mt-14 border-t border-white/10 pt-6 font-mono text-[12px] tracking-[0.04em] text-white/50">
          © {new Date().getFullYear()} SCU PaddlePaddle Pioneer Group · Paddle Forward, Pioneer Together
        </div>
      </div>
    </footer>
  )
}
