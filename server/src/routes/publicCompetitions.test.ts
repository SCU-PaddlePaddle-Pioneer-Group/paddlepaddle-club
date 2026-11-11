import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createApp } from '../app.js'
import { openDatabase } from '../db/database.js'
import { applyMigrations } from '../db/migrate.js'
import type { RegistrationRateLimitOptions } from '../middleware/registrationRateLimit.js'

async function createTestApi(options: {
  registrationLimits?: Partial<RegistrationRateLimitOptions>
  trustProxy?: boolean
} = {}) {
  const database = openDatabase(':memory:')
  applyMigrations(database)
  const app = createApp(database, {
    sessionSecret: 'test-only-session-secret-that-is-long-enough',
    registrationLimits: options.registrationLimits,
  })
  if (options.trustProxy) {
    app.set('trust proxy', 1)
  }
  const server = app.listen(0, '127.0.0.1')
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
    createdAt?: string
  } = {},
): string {
  const id = options.id ?? randomUUID()
  const now = options.createdAt ?? new Date().toISOString()
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

test('public competition list sorts by creation time descending then ID ascending', async () => {
  const api = await createTestApi()
  try {
    const sameTimeZuluId = insertCompetition(api.database, {
      id: 'zulu',
      createdAt: '2026-01-03T00:00:00.000Z',
    })
    const newestId = insertCompetition(api.database, {
      id: 'newest',
      createdAt: '2026-01-04T00:00:00.000Z',
      deadline: new Date(Date.now() - 120_000).toISOString(),
    })
    const sameTimeAlphaId = insertCompetition(api.database, {
      id: 'alpha',
      createdAt: '2026-01-03T00:00:00.000Z',
      deadline: new Date(Date.now() + 120_000).toISOString(),
    })
    const oldestId = insertCompetition(api.database, {
      id: 'oldest',
      createdAt: '2026-01-02T00:00:00.000Z',
      deadline: new Date(Date.now() + 60_000).toISOString(),
    })

    const response = await fetch(`${api.baseUrl}/api/competitions`)
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      items: Array<{ id: string; registrationOpen: boolean }>
    }

    assert.deepEqual(
      body.items.map((item) => item.id),
      [newestId, sameTimeAlphaId, sameTimeZuluId, oldestId],
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
      item: {
        id: string
        competitionId: string
        status: string
        createdAt: string
        email?: string
      }
    }
    assert.ok(first.item.id)
    assert.equal(first.item.competitionId, competitionId)
    assert.equal(first.item.status, 'pending')
    assert.ok(first.item.createdAt)
    assert.equal('email' in first.item, false)
    const storedRegistration = api.database
      .prepare('SELECT id, competition_id FROM registrations')
      .get()
    assert.equal(storedRegistration?.id, first.item.id)
    assert.equal(storedRegistration?.competition_id, first.item.competitionId)

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

test('registration limits isolate source and competition budgets', async () => {
  const api = await createTestApi({
    trustProxy: true,
    registrationLimits: {
      windowMs: 60_000,
      maxPerSource: 3,
      maxPerCompetition: 2,
      maxPerSourceCompetition: 1,
    },
  })
  try {
    const competitionA = insertCompetition(api.database)
    const competitionB = insertCompetition(api.database)
    const competitionC = insertCompetition(api.database)
    const submit = (
      competitionId: string,
      email: string,
      source: string,
    ) =>
      fetch(
        `${api.baseUrl}/api/competitions/${competitionId}/registrations`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': source,
          },
          body: JSON.stringify({ name: 'Test attendee', email }),
        },
      )

    assert.equal(
      (await submit(competitionA, 'a1@example.edu', '198.51.100.10')).status,
      201,
    )
    const sameSourceCompetition = await submit(
      competitionA,
      'a2@example.edu',
      '198.51.100.10',
    )
    assert.equal(sameSourceCompetition.status, 429)
    assert.ok(Number(sameSourceCompetition.headers.get('retry-after')) >= 1)

    assert.equal(
      (await submit(competitionB, 'b1@example.edu', '198.51.100.10')).status,
      201,
    )
    assert.equal(
      (await submit(competitionA, 'a3@example.edu', '198.51.100.11')).status,
      201,
    )
    const competitionLimit = await submit(
      competitionA,
      'a4@example.edu',
      '198.51.100.12',
    )
    assert.equal(competitionLimit.status, 429)
    assert.ok(Number(competitionLimit.headers.get('retry-after')) >= 1)

    assert.equal(
      (await submit(competitionB, 'b2@example.edu', '198.51.100.12')).status,
      201,
    )
    const sourceLimit = await submit(
      competitionC,
      'c1@example.edu',
      '198.51.100.10',
    )
    assert.equal(sourceLimit.status, 429)

    assert.equal(
      api.database
        .prepare('SELECT COUNT(*) AS count FROM registrations')
        .get()?.count,
      4,
    )
  } finally {
    await api.close()
  }
})

test('expired registration limits recover and allow new registrations', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const api = await createTestApi({
    registrationLimits: {
      windowMs: 60_000,
      maxPerSource: 1,
      maxPerCompetition: 2,
      maxPerSourceCompetition: 1,
    },
  })
  try {
    const competitionId = insertCompetition(api.database, {
      deadline: new Date(Date.now() + 120_000).toISOString(),
    })
    const submit = (email: string) =>
      fetch(
        `${api.baseUrl}/api/competitions/${competitionId}/registrations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test attendee', email }),
        },
      )

    assert.equal((await submit('first@example.edu')).status, 201)
    assert.equal((await submit('blocked@example.edu')).status, 429)
    context.mock.timers.tick(60_001)
    assert.equal((await submit('after-expiry@example.edu')).status, 201)
    assert.equal(
      api.database
        .prepare('SELECT COUNT(*) AS count FROM registrations')
        .get()?.count,
      2,
    )
  } finally {
    await api.close()
  }
})

async function submitRegistration(
  baseUrl: string,
  competitionId: string,
  source: string,
) {
  const response = await fetch(
    `${baseUrl}/api/competitions/${competitionId}/registrations`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': source,
      },
      body: JSON.stringify({
        name: 'Synthetic attendee',
        email: `${randomUUID()}@example.edu`,
      }),
    },
  )
  await response.arrayBuffer()
  return response
}

test('source expiry preserves an unexpired single-competition budget', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const api = await createTestApi({ trustProxy: true })
  try {
    const competitionId = insertCompetition(api.database, {
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    const submit = (id = competitionId) =>
      submitRegistration(api.baseUrl, id, '198.51.100.10')

    assert.equal((await submit('missing-event')).status, 404)
    context.mock.timers.tick(14 * 60 * 1000)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await submit()).status, 201)
    }
    assert.equal((await submit()).status, 429)

    context.mock.timers.tick(60 * 1000)
    const stillBlocked = await submit()
    assert.equal(stillBlocked.status, 429)
    assert.equal(Number(stillBlocked.headers.get('retry-after')), 14 * 60)
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM registrations').get()?.count,
      5,
    )

    context.mock.timers.tick(14 * 60 * 1000)
    assert.equal((await submit()).status, 201)
  } finally {
    await api.close()
  }
})

test('unknown competitions cannot displace a full competition budget', async () => {
  const api = await createTestApi({
    trustProxy: true,
    registrationLimits: {
      maxTrackedCompetitions: 1,
      maxPerCompetition: 2,
      maxPerSourceCompetition: 1,
    },
  })
  try {
    const competitionId = insertCompetition(api.database)
    const draftId = insertCompetition(api.database, { status: 'draft' })
    const offlineId = insertCompetition(api.database, { status: 'offline' })
    const submit = (id: string, source: string) =>
      submitRegistration(api.baseUrl, id, source)

    assert.equal((await submit(competitionId, '198.51.100.10')).status, 201)
    assert.equal((await submit(competitionId, '198.51.100.11')).status, 201)
    for (const id of ['missing-1', 'missing-2', draftId, offlineId]) {
      assert.equal((await submit(id, '198.51.100.12')).status, 404)
    }
    const blocked = await submit(competitionId, '198.51.100.13')
    assert.equal(blocked.status, 429)
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1)
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM registrations').get()?.count,
      2,
    )
  } finally {
    await api.close()
  }
})

test('source capacity preserves existing budgets and recovers after expiry', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const api = await createTestApi({
    trustProxy: true,
    registrationLimits: {
      windowMs: 60_000,
      maxTrackedSources: 2,
      maxPerCompetition: 10,
      maxPerSourceCompetition: 1,
    },
  })
  try {
    const competitionId = insertCompetition(api.database, {
      deadline: new Date(Date.now() + 120_000).toISOString(),
    })
    const submit = (source: string) =>
      submitRegistration(api.baseUrl, competitionId, source)

    assert.equal((await submit('198.51.100.10')).status, 201)
    assert.equal((await submit('198.51.100.11')).status, 201)
    const capacityBlocked = await submit('198.51.100.12')
    assert.equal(capacityBlocked.status, 429)
    assert.ok(Number(capacityBlocked.headers.get('retry-after')) >= 1)
    assert.equal((await submit('198.51.100.10')).status, 429)
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM registrations').get()?.count,
      2,
    )

    context.mock.timers.tick(60_001)
    assert.equal((await submit('198.51.100.12')).status, 201)
  } finally {
    await api.close()
  }
})

test('competition capacity preserves active budgets and recovers after expiry', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const api = await createTestApi({
    trustProxy: true,
    registrationLimits: {
      windowMs: 60_000,
      maxTrackedCompetitions: 2,
      maxPerCompetition: 2,
      maxPerSourceCompetition: 1,
    },
  })
  try {
    const deadline = new Date(Date.now() + 120_000).toISOString()
    const competitionA = insertCompetition(api.database, { deadline })
    const competitionB = insertCompetition(api.database, { deadline })
    const competitionC = insertCompetition(api.database, { deadline })
    const submit = (id: string, source: string) =>
      submitRegistration(api.baseUrl, id, source)

    assert.equal((await submit(competitionA, '198.51.100.10')).status, 201)
    assert.equal((await submit(competitionA, '198.51.100.11')).status, 201)
    assert.equal((await submit(competitionB, '198.51.100.12')).status, 201)
    const capacityBlocked = await submit(competitionC, '198.51.100.13')
    assert.equal(capacityBlocked.status, 429)
    assert.ok(Number(capacityBlocked.headers.get('retry-after')) >= 1)
    assert.equal((await submit(competitionA, '198.51.100.14')).status, 429)
    assert.equal(
      api.database.prepare('SELECT COUNT(*) AS count FROM registrations').get()?.count,
      3,
    )

    context.mock.timers.tick(60_001)
    assert.equal((await submit(competitionC, '198.51.100.13')).status, 201)
  } finally {
    await api.close()
  }
})
