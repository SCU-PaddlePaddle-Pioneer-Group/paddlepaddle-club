import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { ApiError } from '../errors.js'
import { createRequireAdmin } from '../middleware/requireAdmin.js'
import { createAdminManagementRouter } from './adminManagement.js'

const maxFailedAttempts = 5
const loginWindowMs = 15 * 60 * 1000

interface AdminRecord {
  id: string
  username: string
  password_hash: string
}

function getCredentials(body: unknown): { username: string; password: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请填写管理员账号和密码')
  }

  const fields = body as Record<string, unknown>
  if (
    Object.keys(fields).some((field) => field !== 'username' && field !== 'password') ||
    typeof fields.username !== 'string' ||
    typeof fields.password !== 'string'
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请填写有效的管理员账号和密码')
  }

  const username = fields.username.trim().toLowerCase()
  if (username.length === 0 || username.length > 64 || fields.password.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请填写有效的管理员账号和密码')
  }
  return { username, password: fields.password }
}

function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function clearSessionCookie(response: Response, cookieSecure: boolean): void {
  response.clearCookie('club.sid', {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
  })
}

export function createAdminAuthRouter(
  database: DatabaseSync,
  cookieSecure: boolean,
): Router {
  const router = Router()
  const requireAdmin = createRequireAdmin(database, cookieSecure)
  const failedAttempts = new Map<string, { count: number; resetAt: number }>()
  const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'))

  router.use(createAdminManagementRouter(database, requireAdmin))

  router.post('/login', async (request, response) => {
    const now = Date.now()
    const clientKey = request.ip ?? 'unknown'
    for (const [key, attempts] of failedAttempts) {
      if (attempts.resetAt <= now) {
        failedAttempts.delete(key)
      }
    }
    const currentAttempts = failedAttempts.get(clientKey)
    if (currentAttempts && currentAttempts.count >= maxFailedAttempts) {
      throw new ApiError(429, 'RATE_LIMITED', '登录尝试过于频繁，请稍后再试')
    }

    const { username, password } = getCredentials(request.body)
    const admin = database
      .prepare(
        'SELECT id, username, password_hash FROM admins WHERE username = ?',
      )
      .get(username) as AdminRecord | undefined

    const passwordIsValid = verifyPassword(
      password,
      admin?.password_hash ?? dummyPasswordHash,
    )
    if (!admin || !passwordIsValid) {
      const attempts = failedAttempts.get(clientKey)
      if (!attempts && failedAttempts.size >= 5000) {
        const oldestKey = failedAttempts.keys().next().value
        if (oldestKey) {
          failedAttempts.delete(oldestKey)
        }
      }
      failedAttempts.set(
        clientKey,
        attempts && attempts.resetAt > now
          ? { ...attempts, count: attempts.count + 1 }
          : { count: 1, resetAt: now + loginWindowMs },
      )
      throw new ApiError(401, 'INVALID_CREDENTIALS', '账号或密码不正确')
    }

    failedAttempts.delete(clientKey)
    await regenerateSession(request)
    request.session.adminId = admin.id
    await saveSession(request)
    response.status(200).json({
      admin: {
        id: admin.id,
        username: admin.username,
      },
    })
  })

  router.get('/me', requireAdmin, (request, response) => {
    const adminId = request.session.adminId
    if (!adminId) {
      throw new ApiError(401, 'UNAUTHENTICATED', '请先登录')
    }
    const admin = database
      .prepare('SELECT id, username FROM admins WHERE id = ?')
      .get(adminId) as { id: string; username: string } | undefined
    if (!admin) {
      throw new ApiError(401, 'UNAUTHENTICATED', '请先登录')
    }

    response.status(200).json({ admin })
  })

  router.post('/logout', async (request: Request, response: Response) => {
    if (!request.session.adminId) {
      clearSessionCookie(response, cookieSecure)
      throw new ApiError(401, 'UNAUTHENTICATED', '请先登录')
    }

    await destroySession(request)
    clearSessionCookie(response, cookieSecure)
    response.status(200).json({ ok: true })
  })

  return router
}
