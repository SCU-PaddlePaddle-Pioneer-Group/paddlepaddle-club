import { DEPARTMENTS } from '@/data/club'

/** 三大部门：深海军蓝平涂色域，三列发丝线分隔，角落描边白水印 JOIN US。 */
export default function DepartmentsSection() {
  return (
    <section id="departments" className="field-ink relative overflow-hidden">
      <div className="container-x py-16 md:py-24">
        <p className="section-eyebrow text-white/60">02 — 三大部门</p>
        <div className="mt-14 grid divide-y divide-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
          {DEPARTMENTS.map((d) => (
            <div key={d.index} className="py-10 first:pt-0 last:pb-0 md:px-10 md:py-0 md:first:pl-0 md:last:pr-0">
              <p className="font-mono text-[13px] tracking-[0.2em] text-white/40">{d.index}</p>
              <h3 className="mt-4 font-display text-[clamp(1.6rem,2.4vw,2.1rem)] font-extrabold tracking-[-0.02em] text-white">
                {d.name}
              </h3>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">{d.nameEn}</p>
              <p className="mt-5 text-[15px] leading-relaxed text-white/75">{d.intro}</p>
              <ul className="mt-6 space-y-2.5 text-[14.5px] text-white/85">
                {d.points.map((pt) => (
                  <li key={pt} className="flex gap-3">
                    <span className="text-accent" aria-hidden>
                      ▪
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <span
        className="watermark -bottom-10 right-0 hidden text-[15vw] md:block"
        style={{ WebkitTextStroke: '1.5px rgb(255 255 255 / 0.08)' }}
        aria-hidden
      >
        JOIN US
      </span>
    </section>
  )
}
