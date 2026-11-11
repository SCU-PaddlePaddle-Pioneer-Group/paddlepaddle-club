import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router'
import CompetitionList from '@/pages/competitions/CompetitionList'
import CompetitionDetail from '@/pages/competitions/CompetitionDetail'
import AdminAccess from '@/components/layout/AdminAccess'
import AdminLogin from '@/pages/admin/Login'
import AdminCompetitionList from '@/pages/admin/CompetitionList'
import AdminCompetitionEdit from '@/pages/admin/CompetitionEdit'
import AdminRegistrations from '@/pages/admin/Registrations'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Posts from './pages/Posts'
import PostDetail from './pages/PostDetail'
import NotFound from './pages/NotFound'

/**
 * 路由与页面映射（DESIGN.md §页面映射）：
 *   /            首页（hero / 关于 / 部门 / 动态预览 / 加入我们）
 *   /posts       动态列表（全部 · 活动 · 项目 筛选）
 *   /posts/:slug 帖子详情
 *   /about       社团文化
 *   *            404
 * 站内锚点用带 hash 的路由（如 /#join、/#feed），由 ScrollManager 统一滚动。
 */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:slug" element={<PostDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/competitions" element={<CompetitionList />} />
          <Route path="/competitions/:id" element={<CompetitionDetail />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminAccess />}>
            <Route index element={<Navigate to="/admin/competitions" replace />} />
            <Route path="competitions" element={<AdminCompetitionList />} />
            <Route path="competitions/new" element={<AdminCompetitionEdit />} />
            <Route path="competitions/:id/edit" element={<AdminCompetitionEdit />} />
            <Route path="competitions/:id/registrations" element={<AdminRegistrations />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
