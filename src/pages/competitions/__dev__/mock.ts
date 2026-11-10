import { sampleCompetitions } from '@/pages/competitions/__dev__/fixtures'

export function installPreviewMock() {
  if (!import.meta.env.DEV) throw new Error('Development preview only')
  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/competitions')) return nativeFetch(input, init)
    await new Promise<void>((resolve, reject) => {
      if (request.signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      const cancel = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
      const timer = window.setTimeout(() => { request.signal.removeEventListener('abort', cancel); resolve() }, 350)
      request.signal.addEventListener('abort', cancel, { once: true })
    })
    if (request.method !== 'GET') return Response.json({ error: { code: 'PREVIEW_ONLY', message: '这是开发预览，报名未发送、未保存。请等待真实后台接通后验证。' } }, { status: 409 })
    if (url.pathname === '/api/competitions') return Response.json({ items: sampleCompetitions })
    const item = sampleCompetitions.find(value => url.pathname === `/api/competitions/${value.id}`)
    return item ? Response.json({ item }) : Response.json({ error: { code: 'COMPETITION_NOT_FOUND', message: '赛事不存在或已下架。' } }, { status: 404 })
  }
}
