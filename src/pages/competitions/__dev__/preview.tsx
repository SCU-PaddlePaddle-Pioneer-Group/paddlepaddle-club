import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router'
import CompetitionList from '@/pages/competitions/CompetitionList'
import CompetitionDetail from '@/pages/competitions/CompetitionDetail'
import '@/index.css'

async function start() {
  if (!import.meta.env.DEV) return
  const sample = new URLSearchParams(window.location.search).get('source') !== 'live'
  if (sample) {
    const { installPreviewMock } = await import('@/pages/competitions/__dev__/mock')
    installPreviewMock()
  }
  createRoot(document.getElementById('root')!).render(<StrictMode>
    <div className="border-b border-border bg-secondary px-6 py-4 text-sm">
      <p className="font-bold">B 开发预览 · {sample ? '示例数据，不会真实报名' : '真实接口模式，后台未接通时会提示失败'}</p>
      <p className="mt-2">此入口仅用于开发验证，尚未接入官网导航。演示只填虚构姓名及 example.com 邮箱。</p>
      <div className="mt-2 flex flex-wrap gap-5 text-primary">
        <a className="underline" href="?source=sample#/competitions">示例数据</a>
        <a className="underline" href="?source=live#/competitions">真实接口</a>
        <a className="underline" href="/">返回原官网</a>
      </div>
    </div>
    <HashRouter><main><Routes>
      <Route path="/competitions" element={<CompetitionList />} />
      <Route path="/competitions/:id" element={<CompetitionDetail />} />
      <Route path="*" element={<Navigate to="/competitions" replace />} />
    </Routes></main></HashRouter>
  </StrictMode>)
}
void start()
