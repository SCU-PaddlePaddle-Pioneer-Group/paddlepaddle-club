import Hero from '@/components/home/Hero'
import AboutSection from '@/components/home/AboutSection'
import DepartmentsSection from '@/components/home/DepartmentsSection'
import FeedSection from '@/components/home/FeedSection'
import JoinSection from '@/components/home/JoinSection'
import CompetitionPreview from '@/components/home/CompetitionPreview'

/** 保留原区块顺序，在社团动态之后增加赛事预览。 */
export default function Home() {
  return (
    <>
      <Hero />
      <AboutSection />
      <DepartmentsSection />
      <FeedSection />
      <CompetitionPreview />
      <JoinSection />
    </>
  )
}
