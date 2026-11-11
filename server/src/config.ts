import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface ServerConfig {
  host: string
  port: number
  databasePath: string
  sessionSecret: string | undefined
  cookieSecure: boolean
  allowedOrigins: string[]
  trustedProxyAddresses: string[]
  registrationRateLimitWindowMs: number
  registrationRateLimitPerSource: number
  registrationRateLimitPerCompetition: number
  registrationRateLimitPerSourceCompetition: number
}

function positiveIntegerEnv(name: string, defaultValue: number): number {
  const value = Number(process.env[name] ?? defaultValue)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} 必须是大于 0 的整数`)
  }
  return value
}

export function loadConfig(): ServerConfig {
  const portValue = process.env.PORT ?? '3001'
  const port = Number(portValue)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT 必须是 1 到 65535 之间的整数')
  }

  const databasePathValue = process.env.DATABASE_PATH ?? 'data/club.sqlite'
  const cookieSecureValue = process.env.COOKIE_SECURE ?? 'false'
  if (cookieSecureValue !== 'true' && cookieSecureValue !== 'false') {
    throw new Error('COOKIE_SECURE 必须为 true 或 false')
  }
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ??
    'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const trustedProxyAddresses = (process.env.TRUSTED_PROXY_ADDRESSES ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
  if (trustedProxyAddresses.some((address) => address === '*')) {
    throw new Error('TRUSTED_PROXY_ADDRESSES 不能使用通配符 *')
  }
  const registrationRateLimitWindowMs = positiveIntegerEnv(
    'REGISTRATION_RATE_LIMIT_WINDOW_MS',
    15 * 60 * 1000,
  )
  const registrationRateLimitPerSource = positiveIntegerEnv(
    'REGISTRATION_RATE_LIMIT_PER_SOURCE',
    60,
  )
  const registrationRateLimitPerCompetition = positiveIntegerEnv(
    'REGISTRATION_RATE_LIMIT_PER_COMPETITION',
    300,
  )
  const registrationRateLimitPerSourceCompetition = positiveIntegerEnv(
    'REGISTRATION_RATE_LIMIT_PER_SOURCE_COMPETITION',
    5,
  )
  if (
    registrationRateLimitPerCompetition <=
    registrationRateLimitPerSourceCompetition
  ) {
    throw new Error(
      '赛事报名限流必须高于单一来源的单赛事限流',
    )
  }

  return {
    host: process.env.HOST ?? '127.0.0.1',
    port,
    databasePath: isAbsolute(databasePathValue)
      ? databasePathValue
      : resolve(serverDirectory, databasePathValue),
    sessionSecret: process.env.SESSION_SECRET,
    cookieSecure: cookieSecureValue === 'true',
    allowedOrigins,
    trustedProxyAddresses,
    registrationRateLimitWindowMs,
    registrationRateLimitPerSource,
    registrationRateLimitPerCompetition,
    registrationRateLimitPerSourceCompetition,
  }
}
