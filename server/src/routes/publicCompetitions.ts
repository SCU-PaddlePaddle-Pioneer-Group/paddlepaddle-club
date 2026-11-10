import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import { ApiError } from '../errors.js'

interface Competition {
  id: string
  title: string
  summary: string
  rules: string
  registrationDeadline: string
  status: 'draft' | 'published' | 'offline'
  createdAt: string
  updatedAt: string
}

function readString(row: Record<string, SQLOutputValue>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string') {
    throw new Error(`Invalid database value for ${field}`)
  }
  return value
}

function mapCompetition(row: Record<string, SQLOutputValue>): Competition {
  const status = readString(row, 'status')
  if (status !== 'draft' && status !== 'published' && status !== 'offline') {
    throw new Error('Invalid competition status stored in database')
  }

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

function isRegistrationOpen(competition: Competition, now: number): boolean {
  const deadline = Date.parse(competition.registrationDeadline)
  if (!Number.isFinite(deadline)) {
    throw new Error(`Invalid registration deadline for competition ${competition.id}`)
  }
  return now < deadline
}

function toPublicCompetition(competition: Competition, now: number) {
  return {
    ...competition,
    registrationOpen: isRegistrationOpen(competition, now),
  }
}

function parseRegistrationBody(body: unknown): { name: string; email: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请填写有效的报名信息')
  }

  const fields = body as Record<string, unknown>
  if (Object.keys(fields).some((field) => field !== 'name' && field !== 'email')) {
    throw new ApiError(400, 'VALIDATION_ERROR', '报名信息包含不支持的字段')
  }
  if (typeof fields.name !== 'string' || typeof fields.email !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', '姓名和邮箱为必填项')
  }

  const name = fields.name.trim()
  const email = fields.email.trim().toLowerCase()
  if (name.length === 0 || name.length > 80) {
    throw new ApiError(400, 'VALIDATION_ERROR', '姓名不能为空且不能超过 80 个字符')
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请输入有效的邮箱地址')
  }

  return { name, email }
}

function getCompetitionId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(404, 'COMPETITION_NOT_FOUND', '比赛不存在')
  }
  return value
}

export function createPublicCompetitionsRouter(database: DatabaseSync): Router {
  const router = Router()

  router.get('/', (_request, response) => {
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const rows = database
      .prepare(
        `SELECT id, title, summary, rules, registration_deadline, status, created_at, updated_at
         FROM competitions
         WHERE status = 'published'
         ORDER BY
           CASE WHEN registration_deadline > ? THEN 0 ELSE 1 END ASC,
           registration_deadline ASC,
           created_at DESC,
           id ASC`,
      )
      .all(nowIso)

    const items = rows.map((row) =>
      toPublicCompetition(mapCompetition(row), now),
    )
    response.status(200).json({ items })
  })

  router.get('/:id', (request, response) => {
    const competitionId = getCompetitionId(request.params.id)
    const row = database
      .prepare(
        `SELECT id, title, summary, rules, registration_deadline, status, created_at, updated_at
         FROM competitions
         WHERE id = ? AND status = 'published'`,
      )
      .get(competitionId)

    if (!row) {
      throw new ApiError(404, 'COMPETITION_NOT_FOUND', '比赛不存在')
    }

    const item = toPublicCompetition(mapCompetition(row), Date.now())
    response.status(200).json({ item })
  })

  router.post('/:id/registrations', (request: Request, response: Response) => {
    const competitionId = getCompetitionId(request.params.id)
    const { name, email } = parseRegistrationBody(request.body)

    let registration: {
      id: string
      competitionId: string
      status: 'pending'
      createdAt: string
    }

    database.exec('BEGIN IMMEDIATE;')
    try {
      const row = database
        .prepare(
          `SELECT id, title, summary, rules, registration_deadline, status, created_at, updated_at
           FROM competitions
           WHERE id = ?`,
        )
        .get(competitionId)

      if (!row) {
        throw new ApiError(404, 'COMPETITION_NOT_FOUND', '比赛不存在')
      }

      const competition = mapCompetition(row)
      if (competition.status !== 'published') {
        throw new ApiError(404, 'COMPETITION_NOT_FOUND', '比赛不存在')
      }
      if (!isRegistrationOpen(competition, Date.now())) {
        throw new ApiError(409, 'REGISTRATION_CLOSED', '报名已截止')
      }

      const existing = database
        .prepare(
          'SELECT 1 FROM registrations WHERE competition_id = ? AND email = ?',
        )
        .get(competition.id, email)
      if (existing) {
        throw new ApiError(409, 'DUPLICATE_REGISTRATION', '该邮箱已报名此比赛')
      }

      const id = randomUUID()
      const createdAt = new Date().toISOString()
      database
        .prepare(
          `INSERT INTO registrations (id, competition_id, name, email, status, created_at)
           VALUES (?, ?, ?, ?, 'pending', ?)`,
        )
        .run(id, competition.id, name, email, createdAt)
      database.exec('COMMIT;')
      registration = {
        id,
        competitionId: competition.id,
        status: 'pending',
        createdAt,
      }
    } catch (error) {
      database.exec('ROLLBACK;')
      throw error
    }

    response.status(201).json({ item: registration })
  })

  return router
}
