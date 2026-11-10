import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { hashPassword } from '../auth/password.js'
import { createApp } from '../app.js'
import { openDatabase } from '../db/database.js'
import { applyMigrations } from '../db/migrate.js'

const sessionSecret = 'test-only-session-secret-that-is-long-enough'
const allowedOrigin = 'http://localhost:3000'

async function createTestApi() {
  const database = openDatabase(':memory:')
  applyMigrations(database)
  database
    .prepare(
      'INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(
      'admin-1',
      'test-admin',
      hashPassword('test-password-123'),
      new Date().toISOString(),
    )

  const server = createApp(database, { sessionSecret }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo

  return {
    database,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
      database.close()
    },
  }
}

function sessionCookie(response: Response): string {
  const header = response.headers.get('set-cookie')
  assert.ok(header)
  const cookie = header.split(';', 1)[0]
  assert.ok(cookie.startsWith('club.sid='))
  return cookie
}

function apiResponseUsername(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('admin' in body)) {
    return undefined
  }
  const admin = body.admin
  if (typeof admin !== 'object' || admin === null || !('username' in admin)) {
    return undefined
  }
  return typeof admin.username === 'string' ? admin.username : undefined
}

test('admin session login, current-user lookup, and logout work', async () => {
  const api = await createTestApi()
  try {
    const unauthenticated = await fetch(`${api.baseUrl}/api/admin/me`)
    assert.equal(unauthenticated.status, 401)

    const login = await fetch(`${api.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: allowedOrigin,
      },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'test-password-123',
      }),
    })
    assert.equal(login.status, 200)
    const cookie = sessionCookie(login)
    const loginBody = (await login.json()) as {
      admin: { id: string; username: string }
    }
    assert.deepEqual(loginBody.admin, { id: 'admin-1', username: 'test-admin' })
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM sessions').get()?.count,
      1,
    )

    const me = await fetch(`${api.baseUrl}/api/admin/me`, {
      headers: { cookie },
    })
    assert.equal(me.status, 200)

    const logout = await fetch(`${api.baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { cookie, origin: allowedOrigin },
    })
    assert.equal(logout.status, 200)
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM sessions').get()?.count,
      0,
    )

    const afterLogout = await fetch(`${api.baseUrl}/api/admin/me`, {
      headers: { cookie },
    })
    assert.equal(afterLogout.status, 401)
  } finally {
    await api.close()
  }
})

test('authenticated session survives closing and reopening the SQLite database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paddle-club-session-'))
  const databasePath = join(directory, 'club.sqlite')
  let database = openDatabase(databasePath)
  applyMigrations(database)
  database
    .prepare(
      'INSERT INTO admins (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(
      'persistent-admin',
      'persistent-admin',
      hashPassword('test-password-123'),
      new Date().toISOString(),
    )

  let server = createApp(database, { sessionSecret }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const firstAddress = server.address() as AddressInfo
  const firstBaseUrl = `http://127.0.0.1:${firstAddress.port}`
  let cookie = ''

  try {
    const login = await fetch(`${firstBaseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: allowedOrigin,
      },
      body: JSON.stringify({
        username: 'persistent-admin',
        password: 'test-password-123',
      }),
    })
    assert.equal(login.status, 200)
    cookie = sessionCookie(login)

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    database.close()

    database = openDatabase(databasePath)
    applyMigrations(database)
    server = createApp(database, { sessionSecret }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const secondAddress = server.address() as AddressInfo
    const secondBaseUrl = `http://127.0.0.1:${secondAddress.port}`

    const me = await fetch(`${secondBaseUrl}/api/admin/me`, {
      headers: { cookie },
    })
    assert.equal(me.status, 200)
    assert.equal(
      apiResponseUsername(await me.json()),
      'persistent-admin',
    )
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
    database.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('admin write endpoints reject missing or untrusted origins', async () => {
  const api = await createTestApi()
  try {
    const missingOrigin = await fetch(`${api.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'test-password-123',
      }),
    })

    assert.equal(missingOrigin.status, 403)

    const untrustedOrigin = await fetch(`${api.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
      },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'test-password-123',
      }),
    })
    assert.equal(untrustedOrigin.status, 403)
  } finally {
    await api.close()
  }
})

test('login failures are rate limited and credential errors are generic', async () => {
  const api = await createTestApi()
  try {
    let response: Response | undefined
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await fetch(`${api.baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: allowedOrigin,
        },
        body: JSON.stringify({
          username: 'not-an-admin',
          password: 'wrong-password',
        }),
      })
    }

    assert.equal(response?.status, 429)
    const result = (await response?.json()) as { error: { code: string } }
    assert.equal(result.error.code, 'RATE_LIMITED')
  } finally {
    await api.close()
  }
})

test('authenticated admin can create, publish, and inspect registrations', async () => {
  const api = await createTestApi()
  try {
    const anonymousList = await fetch(
      `${api.baseUrl}/api/admin/competitions`,
    )
    assert.equal(anonymousList.status, 401)

    const login = await fetch(`${api.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: allowedOrigin,
      },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'test-password-123',
      }),
    })
    const cookie = sessionCookie(login)

    const create = await fetch(`${api.baseUrl}/api/admin/competitions`, {
      method: 'POST',
      headers: {
        cookie,
        origin: allowedOrigin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Admin-created competition',
        summary: 'Test summary',
        rules: 'Test rules',
        registrationDeadline: new Date(Date.now() + 60_000).toISOString(),
      }),
    })
    assert.equal(create.status, 201)
    const created = (await create.json()) as {
      item: { id: string; status: string }
    }
    assert.equal(created.item.status, 'draft')

    const unpublished = await fetch(
      `${api.baseUrl}/api/competitions/${created.item.id}`,
    )
    assert.equal(unpublished.status, 404)

    const publish = await fetch(
      `${api.baseUrl}/api/admin/competitions/${created.item.id}`,
      {
        method: 'PATCH',
        headers: {
          cookie,
          origin: allowedOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'published' }),
      },
    )
    assert.equal(publish.status, 200)

    const publicDetail = await fetch(
      `${api.baseUrl}/api/competitions/${created.item.id}`,
    )
    assert.equal(publicDetail.status, 200)

    const registration = await fetch(
      `${api.baseUrl}/api/competitions/${created.item.id}/registrations`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Test participant',
          email: 'participant@example.edu',
        }),
      },
    )
    assert.equal(registration.status, 201)
    const registrationBody = (await registration.json()) as {
      item: { id: string }
    }

    const adminRegistrations = await fetch(
      `${api.baseUrl}/api/admin/competitions/${created.item.id}/registrations`,
      { headers: { cookie } },
    )
    assert.equal(adminRegistrations.status, 200)
    const registrationList = (await adminRegistrations.json()) as {
      items: Array<{ id: string; email: string; status: string }>
    }
    assert.equal(registrationList.items.length, 1)
    assert.equal(registrationList.items[0].id, registrationBody.item.id)
    assert.equal(registrationList.items[0].email, 'participant@example.edu')

    const updateStatus = await fetch(
      `${api.baseUrl}/api/admin/registrations/${registrationBody.item.id}`,
      {
        method: 'PATCH',
        headers: {
          cookie,
          origin: allowedOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      },
    )
    assert.equal(updateStatus.status, 200)
    const updated = (await updateStatus.json()) as {
      item: { status: string }
    }
    assert.equal(updated.item.status, 'confirmed')
  } finally {
    await api.close()
  }
})
