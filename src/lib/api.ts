/** Shared same-origin JSON transport. Returns the full response; see docs/api.md. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status = 0, code = 'NETWORK_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const ADMIN_UNAUTHORIZED_EVENT = 'api:admin-unauthorized'
type ApiOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown
  timeoutMs?: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Paths omit /api. Returns { items }, { item }, { admin }, etc. without unwrapping. */
export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    throw new ApiError('接口地址配置错误。', 0, 'INVALID_PATH')
  }
  const { body, timeoutMs = 10000, signal, headers, ...init } = options
  const controller = new AbortController()
  let timedOut = false
  const cancel = () => controller.abort(signal?.reason)
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: requestHeaders,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (response.status === 204 && response.ok) return undefined as T
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = isObject(payload) && isObject(payload.error) ? payload.error : null
      const code = typeof error?.code === 'string' ? error.code : `HTTP_${response.status}`
      if (response.status === 401 && path.startsWith('/admin/') && path !== '/admin/login') {
        window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT))
      }
      const message = response.status >= 500
        ? '服务暂时不可用，请稍后重试。'
        : typeof error?.message === 'string' ? error.message : '请求未完成，请稍后重试。'
      throw new ApiError(message, response.status, code)
    }
    if (!isObject(payload)) {
      throw new ApiError('返回的数据格式不正确，请稍后重试。', response.status, 'INVALID_RESPONSE')
    }
    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (signal?.aborted) throw error
    if (timedOut) throw new ApiError('请求超时，请稍后重试。', 0, 'TIMEOUT')
    throw new ApiError('网络连接失败，请检查网络后重试。')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
