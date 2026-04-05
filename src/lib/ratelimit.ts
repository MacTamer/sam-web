/**
 * Simple in-memory rate limiter for Vercel serverless functions.
 * Resets on cold start — good enough for single-user brute-force protection.
 *
 * For the login endpoint: max 5 attempts per IP per 15 minutes.
 */

interface Bucket {
  count:     number
  resetAt:   number
}

const store = new Map<string, Bucket>()

export function rateLimit(
  key:       string,
  limit:     number,
  windowMs:  number,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now    = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }

  bucket.count++
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 }
}
