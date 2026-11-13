import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { openDatabase } from './database.js'
import { applyMigrations } from './migrate.js'

const initialMigrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations/001_initial.sql',
)

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

test('rerunning migrations preserves existing records', () => {
  const database = openDatabase(':memory:')

  try {
    applyMigrations(database)
    database
      .prepare(
        `INSERT INTO competitions
          (id, title, summary, rules, registration_deadline, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'competition-1',
        'Test competition',
        'Summary',
        'Rules',
        '2030-01-01T00:00:00.000Z',
        'draft',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      )

    applyMigrations(database)

    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM competitions').get()?.count,
      1,
    )
    assert.equal(
      database
        .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
        .get()?.count,
      2,
    )
  } finally {
    database.close()
  }
})

test('migration checksum ignores line ending differences but rejects SQL changes', () => {
  const database = openDatabase(':memory:')

  try {
    applyMigrations(database)

    const migrationSql = readFileSync(initialMigrationPath, 'utf8')
    const windowsLineEndingChecksum = sha256(
      migrationSql.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'),
    )
    database
      .prepare('UPDATE schema_migrations SET checksum = ? WHERE name = ?')
      .run(windowsLineEndingChecksum, '001_initial.sql')

    assert.doesNotThrow(() => applyMigrations(database))

    const changedMigrationChecksum = sha256(
      migrationSql.replace('CREATE TABLE admins', 'CREATE TABLE changed_admins'),
    )
    database
      .prepare('UPDATE schema_migrations SET checksum = ? WHERE name = ?')
      .run(changedMigrationChecksum, '001_initial.sql')

    assert.throws(
      () => applyMigrations(database),
      /已应用的数据库迁移文件被修改：001_initial\.sql/,
    )
  } finally {
    database.close()
  }
})

test('competition and registration constraints reject invalid data', () => {
  const database = openDatabase(':memory:')

  try {
    applyMigrations(database)

    assert.throws(() => {
      database
        .prepare(
          `INSERT INTO competitions
            (id, title, summary, rules, registration_deadline, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          'invalid-status',
          'Title',
          'Summary',
          'Rules',
          '2030-01-01T00:00:00.000Z',
          'invalid',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
        )
    })

    assert.throws(() => {
      database
        .prepare(
          `INSERT INTO registrations
            (id, competition_id, name, email, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          'orphan-registration',
          'missing-competition',
          'Test user',
          'test@example.edu',
          '2026-01-01T00:00:00.000Z',
        )
    })
  } finally {
    database.close()
  }
})

test('SQLite data survives closing and reopening the database file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'paddle-club-db-'))
  const databasePath = join(directory, 'club.sqlite')
  const competitionId = randomUUID()

  try {
    const firstConnection = openDatabase(databasePath)
    applyMigrations(firstConnection)
    firstConnection
      .prepare(
        `INSERT INTO competitions
          (id, title, summary, rules, registration_deadline, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        competitionId,
        'Persistent competition',
        'Summary',
        'Rules',
        '2030-01-01T00:00:00.000Z',
        'published',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      )
    firstConnection.close()

    const reopenedConnection = openDatabase(databasePath)
    try {
      applyMigrations(reopenedConnection)
      const competition = reopenedConnection
        .prepare('SELECT title, status FROM competitions WHERE id = ?')
        .get(competitionId)

      assert.equal(competition?.title, 'Persistent competition')
      assert.equal(competition?.status, 'published')
    } finally {
      reopenedConnection.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
