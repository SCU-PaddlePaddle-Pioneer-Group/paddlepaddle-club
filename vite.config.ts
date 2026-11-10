import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Set only after C confirms the backend address. No fake success fallback.
  const target = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET
  if (target) {
    const url = new URL(target)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('API_PROXY_TARGET must be an HTTP(S) origin without credentials or a path')
    }
  }
  return {
    base: './',
    plugins: [inspectAttr(), react()],
    server: {
      port: 3000,
      proxy: target ? { '/api': { target, changeOrigin: false } } : undefined,
    },
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  }
})
