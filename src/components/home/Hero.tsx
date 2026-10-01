import { Link } from 'react-router'
import { CLUB } from '@/data/club'
import { asset } from '@/lib/asset'

/** Hero：左 7 列文案 + 右 5 列大团徽与平涂几何装饰，角落水印 PADDLE。 */
export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="container-x grid items-center gap-14 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-7">
          <p className="section-eyebrow">SICHUAN UNIVERSITY · EST. 2025</p>
          <h1 className="mt-6 font-display text-[clamp(2.6rem,6.2vw,5.2rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
            {CLUB.slogan}
            <br />
            <span className="text-primary">{CLUB.sloganAccent}</span>
          </h1>
          <p className="mt-7 max-w-[52ch] text-[16.5px] leading-relaxed text-muted-foreground">{CLUB.heroLede}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/#feed" className="btn-primary">
              查看社团动态
              <span className="btn-arrow" aria-hidden>
                →
              </span>
            </Link>
            <Link to="/about" className="btn-outline">
              了解社团
            </Link>
          </div>
        </div>

        {/* 视觉列：大团徽 + 平涂几何（圆环 / 偏移色块 / 橙色小圆点），移动端排在文案后 */}
        <div className="md:col-span-5">
          <div className="relative mx-auto aspect-square w-full max-w-[380px]">
            <div className="absolute -right-5 top-[6%] h-24 w-24 bg-secondary" aria-hidden />
            <div className="absolute inset-0 rounded-full border-2 border-primary/15" aria-hidden />
            <div className="absolute bottom-[10%] left-[7%] h-4 w-4 rounded-full bg-accent" aria-hidden />
            <img
              src={asset('images/logo.png')}
              alt="四川大学飞桨领航团团徽"
              className="absolute inset-0 m-auto h-[74%] w-[74%]"
            />
          </div>
        </div>
      </div>
      <span className="watermark -bottom-8 left-0 hidden text-[15vw] md:block" aria-hidden>
        PADDLE
      </span>
    </section>
  )
}
