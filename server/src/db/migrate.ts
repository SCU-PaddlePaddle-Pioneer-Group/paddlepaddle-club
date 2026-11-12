import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'

const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
)

function rawChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

function checksum(sql: string): string {
  return rawChecksum(sql.replace(/\r\n?/g, '\n'))
}

function migrationChecksums(sql: string): Set<string> {
  const normalizedSql = sql.replace(/\r\n?/g, '\n')
  return new Set([
    rawChecksum(sql),
    checksum(normalizedSql),
    rawChecksum(normalizedSql.replace(/\n/g, '\r\n')),
  ])
}

export function applyMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedMigrations = new Map(
    database
      .prepare('SELECT name, checksum FROM schema_migrations')
      .all()
      .map((row) => [String(row.name), String(row.checksum)]),
  )

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort()

  for (const name of migrationFiles) {
    const sql = readFileSync(resolve(migrationsDirectory, name), 'utf8')
    const checksums = migrationChecksums(sql)
    const canonicalChecksum = checksum(sql)
    const previousChecksum = appliedMigrations.get(name)

    if (previousChecksum !== undefined) {
      if (!checksums.has(previousChecksum)) {
        throw new Error(`已应用的数据库迁移文件被修改：${name}`)
      }
      continue
    }

    database.exec('BEGIN IMMEDIATE;')
    try {
      database.exec(sql)
      database
        .prepare(
          'INSERT INTO schema_migrations (name, checksum, applied_at) VALUES (?, ?, ?)',
        )
        .run(name, canonicalChecksum, new Date().toISOString())
      database.exec('COMMIT;')
      console.log(`Applied database migration: ${name}`)
    } catch (error) {
      database.exec('ROLLBACK;')
      throw error
    }
  }
}
