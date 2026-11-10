/** A 模块的临时接入层；B 提供公共请求工具后，在此替换请求实现。 */
export interface CompetitionPreviewItem {
  id: string | number
  title: string
  summary: string
  registrationDeadline: string
  status: 'published'
}

function isCompetition(value: unknown): value is CompetitionPreviewItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    ((typeof item.id === 'string' && item.id.trim().length > 0) ||
      (typeof item.id === 'number' && Number.isFinite(item.id))) &&
    typeof item.title === 'string' && item.title.trim().length > 0 &&
    typeof item.summary === 'string' &&
    typeof item.registrationDeadline === 'string' &&
    Number.isFinite(Date.parse(item.registrationDeadline)) &&
    item.status === 'published'
  )
}

/** 暂定响应为 { data: CompetitionPreviewItem[] }，保留后台返回的排序。 */
export async function getCompetitionPreview(signal: AbortSignal): Promise<CompetitionPreviewItem[]> {
  const response = await fetch('/api/competitions', {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('赛事暂时无法加载，请稍后重试。')
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('赛事数据暂时无法读取，请稍后重试。')
  }
  if (!payload.data.every(isCompetition)) {
    throw new Error('赛事数据暂时无法读取，请稍后重试。')
  }
  return payload.data.slice(0, 3)
}
