import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { hashPassword } from '../auth/password.js'
import { loadConfig } from '../config.js'
import { openDatabase } from '../db/database.js'
import { applyMigrations } from '../db/migrate.js'

async function askHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('管理员密码必须在交互式终端中输入')
  }

  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
    }
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('已取消管理员创建'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
        } else {
          value += character
        }
      }
    }

    stdin.on('data', onData)
  })
}

async function main(): Promise<void> {
  const config = loadConfig()
  const database = openDatabase(config.databasePath)

  try {
    applyMigrations(database)
    const existing = database
      .prepare('SELECT COUNT(*) AS count FROM admins')
      .get()
    if (Number(existing?.count ?? 0) > 0) {
      throw new Error('管理员已存在；为避免重复创建，此命令只初始化首个管理员')
    }

    const terminal = createInterface({ input: stdin, output: stdout })
    const username = (await terminal.question('管理员用户名：')).trim().toLowerCase()
    terminal.close()

    if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
      throw new Error('用户名须为 3 到 64 位，仅允许字母、数字、点、下划线和连字符')
    }

    const password = await askHidden('管理员密码（至少 12 个字符，不会显示）：')
    const confirmation = await askHidden('再次输入管理员密码：')
    if (password.length < 12) {
      throw new Error('管理员密码至少需要 12 个字符')
    }
    if (password !== confirmation) {
      throw new Error('两次输入的密码不一致')
    }

    database
      .prepare(
        'INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(randomUUID(), username, hashPassword(password), new Date().toISOString())
    console.log(`管理员 ${username} 已创建。请妥善保管密码，不要将其写入代码仓库。`)
  } finally {
    database.close()
  }
}

main().catch((error: unknown) => {
  console.error('管理员初始化失败:', error)
  process.exitCode = 1
})
