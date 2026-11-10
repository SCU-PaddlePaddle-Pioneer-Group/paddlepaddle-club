import session from 'express-session'
import type { DatabaseSync } from 'node:sqlite'
import type { SessionData } from 'express-session'

function getExpiry(sessionData: SessionData): number {
  const expires = sessionData.cookie.expires
  const expiry = expires
    ? new Date(expires).getTime()
    : Date.now() + 8 * 60 * 60 * 1000

  if (!Number.isFinite(expiry)) {
    throw new Error('Session has an invalid expiration time')
  }
  return expiry
}

export class SQLiteSessionStore extends session.Store {
  constructor(private readonly database: DatabaseSync) {
    super()
  }

  get(
    sessionId: string,
    callback: (error: unknown, sessionData?: SessionData | null) => void,
  ): void {
    try {
      const now = Date.now()
      this.database
        .prepare('DELETE FROM sessions WHERE expires_at <= ?')
        .run(now)
      const row = this.database
        .prepare('SELECT sess FROM sessions WHERE sid = ? AND expires_at > ?')
        .get(sessionId, now)

      if (!row || typeof row.sess !== 'string') {
        callback(null, null)
        return
      }

      const parsed: unknown = JSON.parse(row.sess)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Stored session data has an invalid format')
      }
      callback(null, parsed as SessionData)
    } catch (error) {
      callback(error)
    }
  }

  set(
    sessionId: string,
    sessionData: SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    try {
      const serialized = JSON.stringify(sessionData)
      this.database
        .prepare(
          `INSERT INTO sessions (sid, sess, expires_at)
           VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET
             sess = excluded.sess,
             expires_at = excluded.expires_at`,
        )
        .run(sessionId, serialized, getExpiry(sessionData))
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  touch(
    sessionId: string,
    sessionData: SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    try {
      this.database
        .prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?')
        .run(getExpiry(sessionData), sessionId)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  destroy(sessionId: string, callback?: (error?: unknown) => void): void {
    try {
      this.database.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }
}
