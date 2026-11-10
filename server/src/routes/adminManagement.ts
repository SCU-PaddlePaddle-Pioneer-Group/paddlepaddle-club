import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import { ApiError } from '../errors.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

type CompetitionStatus = 'draft' | 'published' | 'offline'
type RegistrationStatus = 'pending' | 'confirmed' | 'rejected'

interface CompetitionInput {
  title: string
  summary: string
  rules: string
  registrationDeadline: string
}

function readString(row: Record<string, SQLOutputValue>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string') {
    throw new Error(`Invalid database value for ${field}`)
  }
  return value
}

function parseObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求内容格式不正确')
  }
  return body as Record<string, unknown>
}

function parseText(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName}为必填项`)
  }
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${fieldName}不能为空且不能超过 ${maxLength} 个字符`,
    )
  }
  return normalized
}

function parseDeadline(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      '报名截止时间必须是带时区的 ISO 8601 时间',
    )
  }

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '报名截止时间无效')
  }
  return new Date(parsed).toISOString()
}

function parseCompetitionInput(
  body: unknown,
  partial: boolean,
): Partial<CompetitionInput> {
  const fields = parseObject(body)
  const allowedFields = new Set([
    'title',
    'summary',
    'rules',
    'registrationDeadline',
    'status',
  ])
  if (Object.keys(fields).some((field) => !allowedFields.has(field))) {
    throw new ApiError(400, 'VALIDATION_ERROR', '比赛信息包含不支持的字段')
  }

  if (partial && Object.keys(fields).length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', '至少提供一个要更新的字段')
  }

  const result: Partial<CompetitionInput> = {}
  if (!partial || 'title' in fields) {
    result.title = parseText(fields.title, '比赛标题', 120)
  }
  if (!partial || 'summary' in fields) {
    result.summary = parseText(fields.summary, '比赛简介', 1000)
  }
  if (!partial || 'rules' in fields) {
    result.rules = parseText(fields.rules, '比赛规则', 10_000)
  }
  if (!partial || 'registrationDeadline' in fields) {
    result.registrationDeadline = parseDeadline(fields.registrationDeadline)
  }
  return result
}

function parseStatus(value: unknown): CompetitionStatus {
  if (value !== 'draft' && value !== 'published' && value !== 'offline') {
    throw new ApiError(400, 'VALIDATION_ERROR', '比赛状态无效')
  }
  return value
}

function mapCompetition(row: Record<string, SQLOutputValue>) {
  const status = parseStatus(row.status)
  return {
    id: readString(row, 'id'),
    title: readString(row, 'title'),
    summary: readString(row, 'summary'),
    rules: readString(row, 'rules'),
    registrationDeadline: readString(row, 'registration_deadline'),
    status,
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  }
}

function getId(value: string | string[] | undefined, entity: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(404, `${entity}_NOT_FOUND`, '请求的记录不存在')
  }
  return value
}

function getCompetition(
  database: DatabaseSync,
  competitionId: string,
): ReturnType<typeof mapCompetition> {
  const row = database
    .prepare(
      `SELECT id, title, summary, rules, registration_deadline, status, created_at, updated_at
       FROM competitions WHERE id = ?`,
    )
    .get(competitionId)
  if (!row) {
    throw new ApiError(404, 'COMPETITION_NOT_FOUND', '比赛不存在')
  }
  return mapCompetition(row)
}

function readRegistrationStatus(value: unknown): RegistrationStatus {
  if (value !== 'pending' && value !== 'confirmed' && value !== 'rejected') {
    throw new ApiError(400, 'VALIDATION_ERROR', '报名处理状态无效')
  }
  return value
}

export function createAdminManagementRouter(database: DatabaseSync): Router {
  const router = Router()
  router.use('/competitions', requireAdmin)
  router.use('/registrations', requireAdmin)

  router.get('/competitions', (_request, response) => {
    const rows = database
      .prepare(
        `SELECT id, title, summary, rules, registration_deadline, status, created_at, updated_at
         FROM competitions
         ORDER BY created_at DESC, id ASC`,
      )
      .all()
    response.status(200).json({ items: rows.map(mapCompetition) })
  })

  router.post('/competitions', (request, response) => {
    const input = parseCompetitionInput(request.body, false) as CompetitionInput
    const id = randomUUID()
    const now = new Date().toISOString()
    database
      .prepare(
        `INSERT INTO competitions
          (id, title, summary, rules, registration_deadline, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .run(
        id,
        input.title,
        input.summary,
        input.rules,
        input.registrationDeadline,
        now,
        now,
      )

    response.status(201).json({
      item: {
        id,
        ...input,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
    })
  })

  router.patch('/competitions/:id', (request, response) => {
    const competitionId = getId(request.params.id, 'COMPETITION')
    const fields = parseObject(request.body)
    const input = parseCompetitionInput(request.body, true)
    const current = getCompetition(database, competitionId)
    const status = 'status' in fields ? parseStatus(fields.status) : current.status
    const updated = {
      ...current,
      ...input,
      status,
      updatedAt: new Date().toISOString(),
    }

    database
      .prepare(
        `UPDATE competitions SET
           title = ?, summary = ?, rules = ?, registration_deadline = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        updated.title,
        updated.summary,
        updated.rules,
        updated.registrationDeadline,
        updated.status,
        updated.updatedAt,
        competitionId,
      )
    response.status(200).json({ item: updated })
  })

  router.get('/competitions/:id/registrations', (request, response) => {
    const competitionId = getId(request.params.id, 'COMPETITION')
    getCompetition(database, competitionId)
    const rows = database
      .prepare(
        `SELECT id, competition_id, name, email, status, created_at
         FROM registrations
         WHERE competition_id = ?
         ORDER BY created_at ASC, id ASC`,
      )
      .all(competitionId)

    const items = rows.map((row) => ({
      id: readString(row, 'id'),
      competitionId: readString(row, 'competition_id'),
      name: readString(row, 'name'),
      email: readString(row, 'email'),
      status: readRegistrationStatus(row.status),
      createdAt: readString(row, 'created_at'),
    }))
    response.status(200).json({ items })
  })

  router.patch('/registrations/:id', (request: Request, response: Response) => {
    const registrationId = getId(request.params.id, 'REGISTRATION')
    const fields = parseObject(request.body)
    if (Object.keys(fields).length !== 1 || !('status' in fields)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '只能更新报名处理状态')
    }
    const status = readRegistrationStatus(fields.status)

    const result = database
      .prepare('UPDATE registrations SET status = ? WHERE id = ?')
      .run(status, registrationId)
    if (result.changes === 0) {
      throw new ApiError(404, 'REGISTRATION_NOT_FOUND', '报名记录不存在')
    }

    const row = database
      .prepare(
        `SELECT id, competition_id, name, email, status, created_at
         FROM registrations WHERE id = ?`,
      )
      .get(registrationId)
    if (!row) {
      throw new ApiError(404, 'REGISTRATION_NOT_FOUND', '报名记录不存在')
    }

    response.status(200).json({
      item: {
        id: readString(row, 'id'),
        competitionId: readString(row, 'competition_id'),
        name: readString(row, 'name'),
        email: readString(row, 'email'),
        status: readRegistrationStatus(row.status),
        createdAt: readString(row, 'created_at'),
      },
    })
  })

  return router
}
