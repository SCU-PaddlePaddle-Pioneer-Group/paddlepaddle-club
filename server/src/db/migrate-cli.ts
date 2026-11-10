import { loadConfig } from '../config.js'
import { openDatabase } from './database.js'
import { applyMigrations } from './migrate.js'

const config = loadConfig()
const database = openDatabase(config.databasePath)

try {
  applyMigrations(database)
  console.log(`Database migrations are up to date: ${config.databasePath}`)
} catch (error) {
  console.error('Database migration failed:', error)
  process.exitCode = 1
} finally {
  database.close()
}
