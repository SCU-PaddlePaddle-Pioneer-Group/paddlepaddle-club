import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors.js'

export function createAdminOriginMiddleware(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins)

  return (request: Request, _response: Response, next: NextFunction) => {
    if (
      request.method === 'GET' ||
      request.method === 'HEAD' ||
      request.method === 'OPTIONS'
    ) {
      next()
      return
    }

    const origin = request.get('origin')
    if (!origin || !allowed.has(origin)) {
      next(new ApiError(403, 'ORIGIN_NOT_ALLOWED', '请求来源不被允许'))
      return
    }
    next()
  }
}
