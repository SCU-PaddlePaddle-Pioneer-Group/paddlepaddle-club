import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, RequestHandler, Response } from 'express'
import { ApiError } from '../errors.js'
import { createRegistrationRateLimit } from './registrationRateLimit.js'

function submit(limiter: RequestHandler, id: string, source = '198.51.100.10') {
  let status = 200
  let retryAfter: number | undefined
  const request: Partial<Request> = { params: { id }, ip: source }
  limiter(
    request as Request,
    {
      setHeader: (name: string, value: string) => {
        if (name === 'Retry-After') retryAfter = Number(value)
      },
    } as Response,
    (error?: unknown) => {
      if (error) {
        assert.ok(error instanceof ApiError)
        status = error.status
      }
    },
  )
  return { status, retryAfter }
}

test('unknown competition attempts retain source-level protection', () => {
  let competitionLookups = 0
  const limiter = createRegistrationRateLimit(
    () => {
      competitionLookups += 1
      return false
    },
    { maxPerSource: 2, maxTrackedCompetitions: 1 },
  )
  assert.equal(submit(limiter, 'missing-1').status, 200)
  assert.equal(submit(limiter, 'missing-2').status, 200)
  const blocked = submit(limiter, 'missing-3')
  assert.equal(blocked.status, 429)
  assert.ok(blocked.retryAfter && blocked.retryAfter >= 1)
  assert.equal(competitionLookups, 2)
})

test('per-source competition capacity cannot reset an active budget', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const limiter = createRegistrationRateLimit(() => true, {
    windowMs: 60_000,
    maxPerSource: 200,
    maxPerSourceCompetition: 1,
    maxTrackedCompetitions: 200,
  })
  for (let index = 0; index < 100; index += 1) {
    assert.equal(submit(limiter, `public-${index}`).status, 200)
  }
  const capacityBlocked = submit(limiter, 'public-100')
  assert.equal(capacityBlocked.status, 429)
  assert.equal(capacityBlocked.retryAfter, 60)
  assert.equal(submit(limiter, 'public-0').status, 429)

  context.mock.timers.tick(60_001)
  assert.equal(submit(limiter, 'public-100').status, 200)
})

test('source capacity waits for all active child budgets to expire', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const limiter = createRegistrationRateLimit((id) => id === 'public', {
    windowMs: 10_000,
    maxTrackedSources: 1,
    maxPerSourceCompetition: 1,
  })
  assert.equal(submit(limiter, 'missing').status, 200)
  context.mock.timers.tick(9_000)
  assert.equal(submit(limiter, 'public').status, 200)
  context.mock.timers.tick(1_000)
  const blocked = submit(limiter, 'public', '198.51.100.11')
  assert.equal(blocked.status, 429)
  assert.equal(blocked.retryAfter, 9)

  // The scheduled sweep is still one second away when the child expires.
  context.mock.timers.tick(9_000)
  assert.equal(submit(limiter, 'public', '198.51.100.11').status, 200)
})
