/** Development preview reuses the shared fixture from develop. Never imported by production pages. */
import { MOCK_COMPETITIONS } from '@/mocks/competitions'
import type { CompetitionDetail } from '@/pages/competitions/data'

export const sampleCompetitions: CompetitionDetail[] = MOCK_COMPETITIONS
  .filter(item => item.status === 'published')
  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
  .map(item => ({ ...item, status: 'published' as const }))
