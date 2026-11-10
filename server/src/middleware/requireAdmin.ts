import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors.js'

export function requireAdmin(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (!request.session.adminId) {
    next(new ApiError(401, 'UNAUTHENTICATED', '请先登录'))
    return
  }
  next()
}
