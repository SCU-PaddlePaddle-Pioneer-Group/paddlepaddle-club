import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router'
import ModulePending from '@/pages/ModulePending'
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
          {/* B、D 的页面交付后，替换以下占位 element，保留约定地址。 */}
          <Route path="/competitions" element={<ModulePending title="赛事中心即将开放" description="赛事信息与报名安排将在这里发布，欢迎稍后关注。" />} />
          <Route path="/competitions/:id" element={<ModulePending title="赛事详情即将开放" description="比赛规则与报名入口准备中，欢迎稍后关注。" />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<ModulePending title="管理后台暂未开放" description="管理服务准备中，请稍后访问。" />} />
          <Route path="/admin/competitions" element={<ModulePending title="赛事管理暂未开放" description="管理服务准备中，请稍后访问。" />} />
          <Route path="/admin/competitions/new" element={<ModulePending title="新建赛事暂未开放" description="管理服务准备中，请稍后访问。" />} />
          <Route path="/admin/competitions/:id/edit" element={<ModulePending title="赛事编辑暂未开放" description="管理服务准备中，请稍后访问。" />} />
          <Route path="/admin/competitions/:id/registrations" element={<ModulePending title="报名管理暂未开放" description="管理服务准备中，请稍后访问。" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
