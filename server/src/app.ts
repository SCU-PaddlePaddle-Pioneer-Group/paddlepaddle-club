import express from 'express'
import type { DatabaseSync } from 'node:sqlite'
import session from 'express-session'
import { SQLiteSessionStore } from './auth/sqliteSessionStore.js'
import { ApiError } from './errors.js'
import { createAdminOriginMiddleware } from './middleware/verifyAdminOrigin.js'
import { createAdminAuthRouter } from './routes/adminAuth.js'
import { createPublicCompetitionsRouter } from './routes/publicCompetitions.js'

export interface AppOptions {
  sessionSecret: string
  cookieSecure?: boolean
  allowedOrigins?: string[]
}

export function createApp(database: DatabaseSync, options: AppOptions) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.use(
    session({
      name: 'club.sid',
      secret: options.sessionSecret,
      store: new SQLiteSessionStore(database),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.cookieSecure ?? false,
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  )

  app.get('/api/health', (_request, response) => {
    try {
      database.prepare('SELECT 1').get()
      response.status(200).json({ status: 'ok' })
    } catch (error) {
      console.error('Health check database query failed:', error)
      response.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: '服务暂不可用',
        },
      })
    }
  })

  app.use(
    '/api/admin',
    createAdminOriginMiddleware(
      options.allowedOrigins ?? [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ],
    ),
    createAdminAuthRouter(database, options.cookieSecure ?? false),
  )

  app.use('/api/competitions', createPublicCompetitionsRouter(database))

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: '请求的接口不存在',
      },
    })
  })

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ApiError) {
        response.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
          },
        })
        return
      }

      if (
        error instanceof SyntaxError &&
        'status' in error &&
        error.status === 400
      ) {
        response.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求内容不是有效的 JSON',
          },
        })
        return
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 413
      ) {
        response.status(413).json({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: '请求内容过大',
          },
        })
        return
      }

      console.error('Unhandled API error:', error)
      response.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务暂时出现问题',
        },
      })
    },
  )

  return app
}
