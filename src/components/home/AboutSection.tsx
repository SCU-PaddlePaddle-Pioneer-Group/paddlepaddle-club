import { CLUB, STATS } from '@/data/club'

/** 关于我们：题头 + manifesto lead + 全宽核心数据带（数据出自 2025 年终总结报告）。 */
export default function AboutSection() {
  return (
    <section id="about" className="border-t border-border">
      <div className="container-x py-16 md:py-24">
        <p className="section-eyebrow">01 — 关于我们</p>
        <p className="mt-6 max-w-[46ch] text-[clamp(1.15rem,2vw,1.5rem)] font-medium leading-relaxed text-foreground/90">
          {CLUB.manifesto}
        </p>

        {/* 全宽核心数据带 */}
        <div className="mt-14 grid grid-cols-2 divide-x divide-y divide-border border border-border md:grid-cols-4 md:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="p-6 md:p-7">
              <p className="stat-value">{s.value}</p>
              <p className="stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
