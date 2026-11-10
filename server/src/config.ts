import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface ServerConfig {
  host: string
  port: number
  databasePath: string
}

export function loadConfig(): ServerConfig {
  const portValue = process.env.PORT ?? '3001'
  const port = Number(portValue)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT 必须是 1 到 65535 之间的整数')
  }

  const databasePathValue = process.env.DATABASE_PATH ?? 'data/club.sqlite'

  return {
    host: process.env.HOST ?? '127.0.0.1',
    port,
    databasePath: isAbsolute(databasePathValue)
      ? databasePathValue
      : resolve(serverDirectory, databasePathValue),
  }
}
