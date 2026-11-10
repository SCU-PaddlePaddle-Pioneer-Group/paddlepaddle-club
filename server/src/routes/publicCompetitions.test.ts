import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createApp } from '../app.js'
import { openDatabase } from '../db/database.js'
import { applyMigrations } from '../db/migrate.js'

async function createTestApi() {
  const database = openDatabase(':memory:')
  applyMigrations(database)

  const server = createApp(database, {
    sessionSecret: 'test-only-session-secret-that-is-long-enough',
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

function insertCompetition(
  database: ReturnType<typeof openDatabase>,
  options: {
    id?: string
    status?: 'draft' | 'published' | 'offline'
    deadline?: string
  } = {},
): string {
  const id = options.id ?? randomUUID()
  const now = new Date().toISOString()
  database
    .prepare(
      `INSERT INTO competitions
        (id, title, summary, rules, registration_deadline, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      'Test competition',
      'Competition summary',
      'Competition rules',
      options.deadline ?? new Date(Date.now() + 60_000).toISOString(),
      options.status ?? 'published',
      now,
      now,
    )
  return id
}

test('public competition endpoints only expose published competitions', async () => {
  const api = await createTestApi()
  try {
    const publishedId = insertCompetition(api.database)
    const draftId = insertCompetition(api.database, { status: 'draft' })
    const offlineId = insertCompetition(api.database, { status: 'offline' })

    api.database
      .prepare(
        `INSERT INTO registrations (id, competition_id, name, email, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        publishedId,
        'Private attendee',
        'private@example.edu',
        new Date().toISOString(),
      )

    const listResponse = await fetch(`${api.baseUrl}/api/competitions`)
    assert.equal(listResponse.status, 200)
    const list = (await listResponse.json()) as {
      items: Array<{ id: string; registrationOpen: boolean }>
    }
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].id, publishedId)
    assert.equal(list.items[0].registrationOpen, true)
    assert.equal(JSON.stringify(list).includes('private@example.edu'), false)

    const detailResponse = await fetch(
      `${api.baseUrl}/api/competitions/${publishedId}`,
    )
    assert.equal(detailResponse.status, 200)

    const draftResponse = await fetch(
      `${api.baseUrl}/api/competitions/${draftId}`,
    )
    assert.equal(draftResponse.status, 404)

    const offlineResponse = await fetch(
      `${api.baseUrl}/api/competitions/${offlineId}`,
    )
    assert.equal(offlineResponse.status, 404)
  } finally {
    await api.close()
  }
})

test('public competition list puts open registrations before expired ones', async () => {
  const api = await createTestApi()
  try {
    const futureSoonId = insertCompetition(api.database, {
      deadline: new Date(Date.now() + 60_000).toISOString(),
    })
    const futureLaterId = insertCompetition(api.database, {
      deadline: new Date(Date.now() + 120_000).toISOString(),
    })
    const expiredOlderId = insertCompetition(api.database, {
      deadline: new Date(Date.now() - 120_000).toISOString(),
    })
    const expiredRecentId = insertCompetition(api.database, {
      deadline: new Date(Date.now() - 60_000).toISOString(),
    })

    const response = await fetch(`${api.baseUrl}/api/competitions`)
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      items: Array<{ id: string; registrationOpen: boolean }>
    }

    assert.deepEqual(
      body.items.map((item) => item.id),
      [futureSoonId, futureLaterId, expiredOlderId, expiredRecentId],
    )
    assert.deepEqual(
      body.items.map((item) => item.registrationOpen),
      [true, true, false, false],
    )
  } finally {
    await api.close()
  }
})

test('registration normalizes email and rejects duplicate submissions', async () => {
  const api = await createTestApi()
  try {
    const competitionId = insertCompetition(api.database)
    const firstResponse = await fetch(
      `${api.baseUrl}/api/competitions/${competitionId}/registrations`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: '  Test attendee  ',
          email: '  STUDENT@EXAMPLE.EDU ',
        }),
      },
    )

    assert.equal(firstResponse.status, 201)
    const first = (await firstResponse.json()) as {
      item: { id: string; status: string; email?: string }
    }
    assert.ok(first.item.id)
    assert.equal(first.item.status, 'pending')
    assert.equal('email' in first.item, false)

    const duplicateResponse = await fetch(
      `${api.baseUrl}/api/competitions/${competitionId}/registrations`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Another attendee',
          email: 'student@example.edu',
        }),
      },
    )

    assert.equal(duplicateResponse.status, 409)
    assert.equal(
      ((await duplicateResponse.json()) as { error: { code: string } }).error
        .code,
      'DUPLICATE_REGISTRATION',
    )
    assert.equal(
      api.database
        .prepare('SELECT COUNT(*) AS count FROM registrations')
        .get()?.count,
      1,
    )
    assert.equal(
      api.database
        .prepare('SELECT name, email FROM registrations')
        .get()?.email,
      'student@example.edu',
    )
    assert.equal(
      api.database
        .prepare('SELECT name FROM registrations')
        .get()?.name,
      'Test attendee',
    )
  } finally {
    await api.close()
  }
})

test('registration rejects closed and unpublished competitions', async () => {
  const api = await createTestApi()
  try {
    const expiredId = insertCompetition(api.database, {
      deadline: new Date(Date.now() - 1_000).toISOString(),
    })
    const draftId = insertCompetition(api.database, { status: 'draft' })
    const payload = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test attendee', email: 'test@example.edu' }),
    }

    const expiredResponse = await fetch(
      `${api.baseUrl}/api/competitions/${expiredId}/registrations`,
      payload,
    )
    assert.equal(expiredResponse.status, 409)
    assert.equal(
      ((await expiredResponse.json()) as { error: { code: string } }).error
        .code,
      'REGISTRATION_CLOSED',
    )

    const draftResponse = await fetch(
      `${api.baseUrl}/api/competitions/${draftId}/registrations`,
      payload,
    )
    assert.equal(draftResponse.status, 404)
    assert.equal(
      api.database
        .prepare('SELECT COUNT(*) AS count FROM registrations')
        .get()?.count,
      0,
    )
  } finally {
    await api.close()
  }
})

test('invalid registration input returns a JSON validation error', async () => {
  const api = await createTestApi()
  try {
    const competitionId = insertCompetition(api.database)
    const response = await fetch(
      `${api.baseUrl}/api/competitions/${competitionId}/registrations`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', email: 'not-an-email' }),
      },
    )

    assert.equal(response.status, 400)
    assert.equal(
      response.headers.get('content-type')?.includes('application/json'),
      true,
    )
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      'VALIDATION_ERROR',
    )

    const extraFieldResponse = await fetch(
      `${api.baseUrl}/api/competitions/${competitionId}/registrations`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Test attendee',
          email: 'test@example.edu',
          status: 'confirmed',
        }),
      },
    )
    assert.equal(extraFieldResponse.status, 400)
  } finally {
    await api.close()
  }
})
