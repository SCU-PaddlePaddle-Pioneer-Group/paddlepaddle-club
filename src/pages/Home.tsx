import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import DepartmentsSection from '@/components/home/DepartmentsSection'
import FeedSection from '@/components/home/FeedSection'
import JoinSection from '@/components/home/JoinSection'

/** 首页：Hero → 关于我们 → 三大部门 → 社团动态预览 → 加入我们（DESIGN.md §首页区块，顺序固定）。 */
export default function Home() {
  return (
    <>
      <Hero />
      <AboutSection />
      <DepartmentsSection />
      <FeedSection />
      <JoinSection />
    </>
  )
}
