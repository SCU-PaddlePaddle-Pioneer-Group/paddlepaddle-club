import { getCompetitions } from '@/pages/competitions/data'
import type { Competition } from '@/pages/competitions/data'

export type CompetitionPreviewItem = Pick<Competition,
  'id' | 'title' | 'summary' | 'registrationDeadline' | 'status'>

/** 复用 B 的 items 契约、字段校验与公共请求工具，保留后台排序。 */
export async function getCompetitionPreview(signal: AbortSignal): Promise<CompetitionPreviewItem[]> {
  const competitions = await getCompetitions(signal)
  return competitions.slice(0, 3)
}
