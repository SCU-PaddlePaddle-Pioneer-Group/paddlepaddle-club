import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function openDatabase(databasePath: string): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true })

  const database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON;')
  database.exec('PRAGMA busy_timeout = 5000;')
  database.exec('PRAGMA journal_mode = WAL;')

  return database
}
