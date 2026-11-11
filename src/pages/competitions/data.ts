import { apiRequest, ApiError } from '@/lib/api'

import type {
  PublicCompetition as Competition,
  PublicCompetitionDetail as CompetitionDetail,
  RegistrationInput,
  RegistrationReceipt,
} from '@/types/competition'

export type {
  PublicCompetition as Competition,
  PublicCompetitionDetail as CompetitionDetail,
  RegistrationInput,
  RegistrationReceipt,
} from '@/types/competition'

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/i.test(value)
    && Number.isFinite(Date.parse(value))
}
function competition(value: unknown): value is Competition {
  return object(value) && identifier(value.id)
    && typeof value.title === 'string' && value.title.trim().length > 0
    && typeof value.summary === 'string' && validDate(value.registrationDeadline)
    && value.status === 'published'
    && (value.registrationOpen === undefined || typeof value.registrationOpen === 'boolean')
}
function invalid(): never {
  throw new ApiError('赛事数据格式不正确，请稍后重试。', 200, 'INVALID_RESPONSE')
}
export async function getCompetitions(signal?: AbortSignal): Promise<Competition[]> {
  const payload = await apiRequest<unknown>('/competitions', { signal })
  const data = object(payload) ? payload.items : undefined
  if (!Array.isArray(data) || !data.every(competition)) invalid()
  return data
}
export async function getCompetition(id: string, signal?: AbortSignal): Promise<CompetitionDetail> {
  const payload = await apiRequest<unknown>(`/competitions/${encodeURIComponent(id)}`, { signal })
  const data = object(payload) ? payload.item : undefined
  if (!competition(data) || !('rules' in data) || typeof data.rules !== 'string' || String(data.id) !== id) invalid()
  return data as unknown as CompetitionDetail
}
export async function register(id: string, input: RegistrationInput, signal?: AbortSignal): Promise<RegistrationReceipt> {
  const payload = await apiRequest<unknown>(`/competitions/${encodeURIComponent(id)}/registrations`, {
    method: 'POST', body: { name: input.name.trim(), email: input.email.trim().toLowerCase() }, signal,
  })
  const data = object(payload) ? payload.item : undefined
  if (!object(data) || !identifier(data.id) || String(data.competitionId) !== id
    || data.status !== 'pending' || !validDate(data.createdAt)) {
    throw new ApiError('未能确认报名结果，请联系管理员核实，勿反复提交。', 200, 'INVALID_RECEIPT')
  }
  return data as unknown as RegistrationReceipt
}
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
export const formatDeadline = (date: string) => dateFormatter.format(new Date(date))
