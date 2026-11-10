import express from 'express'
import type { DatabaseSync } from 'node:sqlite'

export function createApp(database: DatabaseSync) {
  const app = express()

  app.disable('x-powered-by')

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

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: '请求的接口不存在',
      },
    })
  })

  return app
}
