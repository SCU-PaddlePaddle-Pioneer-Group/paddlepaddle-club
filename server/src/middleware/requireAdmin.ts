import type { Request, RequestHandler, Response } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { ApiError } from '../errors.js'

export function createRequireAdmin(
  database: DatabaseSync,
  cookieSecure: boolean,
): RequestHandler {
  return (request: Request, response: Response, next) => {
    const adminId = request.session.adminId
    if (!adminId) {
      next(new ApiError(401, 'UNAUTHENTICATED', '请先登录'))
      return
    }

    const admin = database
      .prepare('SELECT 1 FROM admins WHERE id = ?')
      .get(adminId)
    if (admin) {
      next()
      return
    }

    request.session.destroy((error) => {
      if (error) {
        next(error)
        return
      }
      response.clearCookie('club.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
      })
      next(new ApiError(401, 'UNAUTHENTICATED', '请先登录'))
    })
  }
}
