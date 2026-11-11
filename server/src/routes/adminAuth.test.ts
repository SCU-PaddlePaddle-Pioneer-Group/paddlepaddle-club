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

async function createTestApi(options: {
  cookieSecure?: boolean
  trustedProxyAddresses?: string[]
} = {}) {
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

  const server = createApp(database, {
    sessionSecret,
    cookieSecure: options.cookieSecure,
    trustedProxyAddresses: options.trustedProxyAddresses,
  }).listen(0, '127.0.0.1')
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

    const staleLogout = await fetch(`${api.baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { cookie, origin: allowedOrigin },
    })
    assert.equal(staleLogout.status, 401)
    assert.equal(
      ((await staleLogout.json()) as { error: { code: string } }).error.code,
      'UNAUTHENTICATED',
    )
    const clearedCookie = staleLogout.headers.get('set-cookie')
    assert.ok(clearedCookie?.startsWith('club.sid=;'))
    assert.ok(clearedCookie?.includes('Expires='))

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

test('trusted HTTPS proxy sets a secure session cookie and isolates login limits', async () => {
  const api = await createTestApi({
    cookieSecure: true,
    trustedProxyAddresses: ['127.0.0.1'],
  })
  try {
    const login = (clientAddress: string, password: string) =>
      fetch(`${api.baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: allowedOrigin,
          'x-forwarded-for': clientAddress,
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({ username: 'test-admin', password }),
      })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedLogin = await login('198.51.100.10', 'wrong-password')
      assert.equal(failedLogin.status, 401)
    }

    const loginFromOtherClient = await login(
      '198.51.100.11',
      'test-password-123',
    )
    assert.equal(loginFromOtherClient.status, 200)
    const setCookie = loginFromOtherClient.headers.get('set-cookie')
    assert.ok(setCookie?.startsWith('club.sid='))
    assert.ok(setCookie?.includes('Secure'))
    assert.ok(setCookie?.includes('HttpOnly'))

    const cookie = sessionCookie(loginFromOtherClient)
    const me = await fetch(`${api.baseUrl}/api/admin/me`, {
      headers: {
        cookie,
        'x-forwarded-for': '198.51.100.11',
        'x-forwarded-proto': 'https',
      },
    })
    assert.equal(me.status, 200)
    assert.equal(apiResponseUsername(await me.json()), 'test-admin')
  } finally {
    await api.close()
  }
})

test('untrusted forwarding headers cannot spoof client IP or HTTPS', async () => {
  const api = await createTestApi({ cookieSecure: true })
  try {
    const forgedHttpsLogin = await fetch(`${api.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: allowedOrigin,
        'x-forwarded-for': '203.0.113.99',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'test-password-123',
      }),
    })
    assert.equal(forgedHttpsLogin.status, 200)
    assert.equal(forgedHttpsLogin.headers.get('set-cookie'), null)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedLogin = await fetch(`${api.baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: allowedOrigin,
          'x-forwarded-for': `198.51.100.${attempt + 10}`,
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({
          username: 'test-admin',
          password: 'wrong-password',
        }),
      })
      assert.equal(failedLogin.status, 401)
      assert.equal(failedLogin.headers.get('set-cookie'), null)
    }

    const forgedClientLogin = await fetch(`${api.baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: allowedOrigin,
        'x-forwarded-for': '203.0.113.99',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'test-password-123',
      }),
    })
    assert.equal(forgedClientLogin.status, 429)
    assert.equal(forgedClientLogin.headers.get('set-cookie'), null)
  } finally {
    await api.close()
  }
})

test('revoked admins lose existing sessions on all management routes', async () => {
  const api = await createTestApi()
  try {
    api.database
      .prepare(
        `INSERT INTO competitions
          (id, title, summary, rules, registration_deadline, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'published', ?, ?)`,
      )
      .run(
        'revocation-competition',
        'Revocation test',
        'Test summary',
        'Test rules',
        new Date(Date.now() + 60_000).toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      )
    api.database
      .prepare(
        `INSERT INTO registrations (id, competition_id, name, email, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        'revocation-registration',
        'revocation-competition',
        'Test attendee',
        'revocation@example.edu',
        new Date().toISOString(),
      )

    const login = async () => {
      const response = await fetch(`${api.baseUrl}/api/admin/login`, {
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
      assert.equal(response.status, 200)
      return sessionCookie(response)
    }

    const cookies = await Promise.all(
      Array.from({ length: 5 }, () => login()),
    )
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM sessions').get()?.count,
      5,
    )
    api.database.prepare('DELETE FROM admins WHERE id = ?').run('admin-1')

    const requests: Array<{
      path: string
      cookie: string
      method?: string
      headers?: Record<string, string>
      body?: string
    }> = [
      { path: '/api/admin/me', cookie: cookies[0] },
      { path: '/api/admin/competitions', cookie: cookies[1] },
      {
        path: '/api/admin/competitions',
        cookie: cookies[2],
        method: 'POST',
        headers: {
          origin: allowedOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Must not be created',
          summary: 'Test summary',
          rules: 'Test rules',
          registrationDeadline: new Date(Date.now() + 60_000).toISOString(),
        }),
      },
      {
        path: '/api/admin/competitions/revocation-competition/registrations',
        cookie: cookies[3],
      },
      {
        path: '/api/admin/registrations/revocation-registration',
        cookie: cookies[4],
        method: 'PATCH',
        headers: {
          origin: allowedOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'confirmed' }),
      },
    ]

    for (const request of requests) {
      const response = await fetch(`${api.baseUrl}${request.path}`, {
        method: request.method,
        headers: { cookie: request.cookie, ...request.headers },
        body: request.body,
      })
      assert.equal(response.status, 401, request.path)
      assert.equal(
        ((await response.json()) as { error: { code: string } }).error.code,
        'UNAUTHENTICATED',
      )
      assert.ok(response.headers.get('set-cookie')?.startsWith('club.sid=;'))
    }

    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM sessions').get()?.count,
      0,
    )
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM competitions').get()?.count,
      1,
    )
    assert.equal(
      api.database
        .prepare('SELECT status FROM registrations WHERE id = ?')
        .get('revocation-registration')?.status,
      'pending',
    )
    const staleSessionReuse = await fetch(
      `${api.baseUrl}/api/admin/me`,
      { headers: { cookie: cookies[0] } },
    )
    assert.equal(staleSessionReuse.status, 401)
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

test('competition rules accept 10,000 Chinese characters and reject 10,001', async () => {
  const api = await createTestApi()
  try {
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
    const competition = {
      title: 'Chinese rules boundary test',
      summary: 'Test summary',
      rules: '规'.repeat(10_000),
      registrationDeadline: new Date(Date.now() + 60_000).toISOString(),
    }

    const accepted = await fetch(`${api.baseUrl}/api/admin/competitions`, {
      method: 'POST',
      headers: {
        cookie,
        origin: allowedOrigin,
        'content-type': 'application/json',
      },
      body: JSON.stringify(competition),
    })
    assert.equal(accepted.status, 201)
    const acceptedBody = (await accepted.json()) as {
      item: { rules: string }
    }
    assert.equal(acceptedBody.item.rules.length, 10_000)

    const rejected = await fetch(`${api.baseUrl}/api/admin/competitions`, {
      method: 'POST',
      headers: {
        cookie,
        origin: allowedOrigin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...competition, rules: '规'.repeat(10_001) }),
    })
    assert.equal(rejected.status, 400)
    const rejectedBody = (await rejected.json()) as {
      error: { code: string }
    }
    assert.equal(rejectedBody.error.code, 'VALIDATION_ERROR')
  } finally {
    await api.close()
  }
})
