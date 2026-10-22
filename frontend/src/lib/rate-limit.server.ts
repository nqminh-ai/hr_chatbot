import type { NextRequest } from 'next/server';
import type { RequestIdentity } from './auth.server';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let requestsSinceCleanup = 0;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function clientAddress(request: NextRequest) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function rateLimitKey(request: NextRequest, identity: RequestIdentity) {
  return identity.userId ? `user:${identity.userId}` : `demo:${clientAddress(request)}`;
}

export function consumeRateLimit(key: string, now = Date.now()) {
  const limit = boundedInteger(process.env.APPOTA_RATE_LIMIT_MAX, 20, 1, 1000);
  const windowSeconds = boundedInteger(process.env.APPOTA_RATE_LIMIT_WINDOW_SECONDS, 60, 1, 3600);
  const windowMs = windowSeconds * 1000;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  requestsSinceCleanup += 1;
  if (requestsSinceCleanup >= 100) {
    requestsSinceCleanup = 0;
    for (const [storedKey, stored] of buckets) if (stored.resetAt <= now) buckets.delete(storedKey);
  }

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    resetAt: Math.ceil(bucket.resetAt / 1000),
  };
}

export function rateLimitHeaders(result: ReturnType<typeof consumeRateLimit>) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfter) }),
  };
}
