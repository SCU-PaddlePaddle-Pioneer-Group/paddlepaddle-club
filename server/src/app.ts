import express from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { ApiError } from './errors.js'
import { createPublicCompetitionsRouter } from './routes/publicCompetitions.js'

export function createApp(database: DatabaseSync) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))

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
