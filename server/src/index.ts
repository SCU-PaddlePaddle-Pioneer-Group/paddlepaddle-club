import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { openDatabase } from './db/database.js'
import { applyMigrations } from './db/migrate.js'

const config = loadConfig()
if (!config.sessionSecret || Buffer.byteLength(config.sessionSecret, 'utf8') < 32) {
  console.error('SESSION_SECRET 必须设置为至少 32 字节的随机值')
  process.exit(1)
}
const database = openDatabase(config.databasePath)

try {
  applyMigrations(database)
} catch (error) {
  console.error('API server failed to initialize the database:', error)
  database.close()
  process.exit(1)
}

const server = createApp(database, {
  sessionSecret: config.sessionSecret,
  cookieSecure: config.cookieSecure,
  allowedOrigins: config.allowedOrigins,
}).listen(config.port, config.host, () => {
  console.log(`API server listening on http://${config.host}:${config.port}`)
  console.log(`SQLite database: ${config.databasePath}`)
})

server.on('error', (error) => {
  console.error('API server failed to start:', error)
  database.close()
  process.exitCode = 1
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      database.close()
      process.exit(0)
    })
  })
}
