import { apiRequest, ApiError } from '@/lib/api'

export interface Competition {
  id: string | number
  title: string
  summary: string
  registrationDeadline: string
  status: 'published'
}
export interface CompetitionDetail extends Competition { rules: string }
export interface RegistrationInput { name: string; email: string }
export interface RegistrationReceipt {
  id: string | number
  competitionId: string | number
  status: 'pending'
  createdAt: string
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
function identifier(value: unknown): value is string | number {
  return (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value))
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
}
function invalid(): never {
  throw new ApiError('赛事数据格式不正确，请稍后重试。', 200, 'INVALID_RESPONSE')
}
export async function getCompetitions(signal?: AbortSignal): Promise<Competition[]> {
  const data = await apiRequest<unknown>('/competitions', { signal })
  if (!Array.isArray(data) || !data.every(competition)) invalid()
  return data
}
export async function getCompetition(id: string, signal?: AbortSignal): Promise<CompetitionDetail> {
  const data = await apiRequest<unknown>(`/competitions/${encodeURIComponent(id)}`, { signal })
  if (!competition(data) || !object(data) || typeof data.rules !== 'string' || String(data.id) !== id) invalid()
  return data as unknown as CompetitionDetail
}
export async function register(id: string, input: RegistrationInput, signal?: AbortSignal): Promise<RegistrationReceipt> {
  const data = await apiRequest<unknown>(`/competitions/${encodeURIComponent(id)}/registrations`, {
    method: 'POST', body: { name: input.name.trim(), email: input.email.trim().toLowerCase() }, signal,
  })
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
