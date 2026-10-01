import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

/**
 * 使用 HashRouter：站点是纯静态构建（base './'），
 * 部署到 GitHub Pages 子路径时刷新详情页不会 404，也无需服务端 rewrite。
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
