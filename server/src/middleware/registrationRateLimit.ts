import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ApiError } from '../errors.js'

export interface RegistrationRateLimitOptions {
  windowMs: number
  maxPerSource: number
  maxPerCompetition: number
  maxPerSourceCompetition: number
  maxTrackedSources: number
  maxTrackedCompetitions: number
}

interface RateBucket {
  count: number
  resetAt: number
  reported: boolean
}

interface SourceBuckets {
  total: RateBucket
  competitions: Map<string, RateBucket>
}

function earliestBucket(buckets: Iterable<RateBucket>): RateBucket {
  let earliest: RateBucket | undefined
  for (const bucket of buckets) {
    if (!earliest || bucket.resetAt < earliest.resetAt) earliest = bucket
  }
  if (!earliest) throw new Error('Missing rate limit capacity state')
  return earliest
}

function sourceCapacityExpiry(sources: Iterable<SourceBuckets>): number {
  let earliest = Infinity
  for (const source of sources) {
    let expiry = source.total.resetAt
    for (const bucket of source.competitions.values()) {
      expiry = Math.max(expiry, bucket.resetAt)
    }
    earliest = Math.min(earliest, expiry)
  }
  return earliest
}

const defaultOptions: RegistrationRateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  maxPerSource: 60,
  maxPerCompetition: 300,
  maxPerSourceCompetition: 5,
  maxTrackedSources: 10_000,
  maxTrackedCompetitions: 10_000,
}

function createBucket(now: number, windowMs: number): RateBucket {
  return { count: 0, resetAt: now + windowMs, reported: false }
}

function getActiveBucket(
  bucket: RateBucket,
  now: number,
  windowMs: number,
): RateBucket {
  if (bucket.resetAt <= now) {
    return createBucket(now, windowMs)
  }
  return bucket
}

function retryAfterSeconds(bucket: RateBucket, now: number): number {
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
}

function reportRateLimit(scope: string, retryAfter: number): void {
  console.warn(
    JSON.stringify({
      event: 'public_registration_rate_limited',
      scope,
      retryAfterSeconds: retryAfter,
    }),
  )
}

export function createRegistrationRateLimit(
  isPublicCompetition: (competitionId: string) => boolean,
  options: Partial<RegistrationRateLimitOptions> = {},
): RequestHandler {
  const limits = { ...defaultOptions, ...options }
  if (
    Object.values(limits).some(
      (limit) => !Number.isSafeInteger(limit) || limit < 1,
    ) ||
    limits.maxPerCompetition <= limits.maxPerSourceCompetition
  ) {
    throw new Error('报名限流参数无效')
  }
  const sources = new Map<string, SourceBuckets>()
  const competitions = new Map<string, RateBucket>()
  const capacityBuckets = new Map<string, RateBucket>()
  let nextCleanupAt = 0

  const cleanupSourceCompetitions = (buckets: SourceBuckets, now: number) => {
    for (const [competitionId, bucket] of buckets.competitions) {
      if (bucket.resetAt <= now) {
        buckets.competitions.delete(competitionId)
      }
    }
  }

  const cleanup = (now: number) => {
    for (const [source, buckets] of sources) {
      cleanupSourceCompetitions(buckets, now)
      if (buckets.total.resetAt <= now && buckets.competitions.size === 0) {
        sources.delete(source)
      }
    }
    for (const [competitionId, bucket] of competitions) {
      if (bucket.resetAt <= now) {
        competitions.delete(competitionId)
      }
    }
  }

  const reject = (
    response: Response,
    next: NextFunction,
    bucket: RateBucket,
    now: number,
    scope: string,
  ) => {
    const retryAfter = retryAfterSeconds(bucket, now)
    response.setHeader('Retry-After', String(retryAfter))
    if (!bucket.reported) {
      bucket.reported = true
      reportRateLimit(scope, retryAfter)
    }
    next(
      new ApiError(
        429,
        'RATE_LIMITED',
        '报名请求过于频繁，请稍后重试',
      ),
    )
  }

  const rejectCapacity = (
    response: Response,
    next: NextFunction,
    now: number,
    scope: string,
    getResetAt: () => number,
  ) => {
    let bucket = capacityBuckets.get(scope)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: getResetAt(), reported: false }
      capacityBuckets.set(scope, bucket)
    }
    reject(response, next, bucket, now, scope)
  }

  const middleware = (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    const now = Date.now()
    if (now >= nextCleanupAt) {
      cleanup(now)
      nextCleanupAt = now + Math.min(limits.windowMs, 60_000)
    }

    const competitionId = request.params.id
    if (typeof competitionId !== 'string' || competitionId.length === 0) {
      next(new ApiError(404, 'COMPETITION_NOT_FOUND', '比赛不存在'))
      return
    }

    const source = request.ip || request.socket.remoteAddress || 'unknown'
    let sourceBuckets = sources.get(source)
    if (!sourceBuckets) {
      if (
        sources.size >= limits.maxTrackedSources &&
        (capacityBuckets.get('source_capacity')?.resetAt ?? 0) <= now
      ) {
        cleanup(now)
      }
      if (sources.size >= limits.maxTrackedSources) {
        rejectCapacity(response, next, now, 'source_capacity', () =>
          sourceCapacityExpiry(sources.values()),
        )
        return
      }
      sourceBuckets = {
        total: createBucket(now, limits.windowMs),
        competitions: new Map(),
      }
      sources.set(source, sourceBuckets)
    }

    sourceBuckets.total = getActiveBucket(
      sourceBuckets.total,
      now,
      limits.windowMs,
    )
    if (sourceBuckets.total.count >= limits.maxPerSource) {
      reject(response, next, sourceBuckets.total, now, 'source')
      return
    }
    sourceBuckets.total.count += 1

    // Unknown/private IDs still consume the source budget, but never create
    // competition state. The route retains its normal validation/404 response.
    if (!isPublicCompetition(competitionId)) {
      next()
      return
    }

    cleanupSourceCompetitions(sourceBuckets, now)
    let sourceCompetition = sourceBuckets.competitions.get(competitionId)
    if (!sourceCompetition) {
      if (sourceBuckets.competitions.size >= 100) {
        reject(
          response,
          next,
          earliestBucket(sourceBuckets.competitions.values()),
          now,
          'source_competition_capacity',
        )
        return
      }
      sourceCompetition = createBucket(now, limits.windowMs)
    }
    sourceCompetition = getActiveBucket(
      sourceCompetition,
      now,
      limits.windowMs,
    )
    sourceBuckets.competitions.set(competitionId, sourceCompetition)
    if (sourceCompetition.count >= limits.maxPerSourceCompetition) {
      reject(response, next, sourceCompetition, now, 'source_competition')
      return
    }
    sourceCompetition.count += 1

    let competitionBucket = competitions.get(competitionId)
    if (!competitionBucket) {
      if (
        competitions.size >= limits.maxTrackedCompetitions &&
        (capacityBuckets.get('competition_capacity')?.resetAt ?? 0) <= now
      ) {
        cleanup(now)
      }
      if (competitions.size >= limits.maxTrackedCompetitions) {
        rejectCapacity(response, next, now, 'competition_capacity', () =>
          earliestBucket(competitions.values()).resetAt,
        )
        return
      }
      competitionBucket = createBucket(now, limits.windowMs)
    }
    competitionBucket = getActiveBucket(
      competitionBucket,
      now,
      limits.windowMs,
    )
    competitions.set(competitionId, competitionBucket)
    if (competitionBucket.count >= limits.maxPerCompetition) {
      reject(response, next, competitionBucket, now, 'competition')
      return
    }
    competitionBucket.count += 1

    next()
  }

  const cleanupTimer = setInterval(
    () => cleanup(Date.now()),
    Math.min(limits.windowMs, 60_000),
  )
  cleanupTimer.unref()

  return middleware
}
