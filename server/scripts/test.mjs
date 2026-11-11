import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const serverDirectory = fileURLToPath(new URL('../', import.meta.url))
const sourceDirectory = resolve(serverDirectory, 'src')
const tests = readdirSync(sourceDirectory, { recursive: true })
  .filter((path) => path.endsWith('.test.ts'))
  .sort()
  .map((path) => resolve(sourceDirectory, path))

if (tests.length === 0) throw new Error('No server tests found')

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], {
  cwd: serverDirectory,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
