# Rate Limiting — SvelteKit + Upstash

> Library template for AI code generation. Sliding window algorithm via Upstash.

---

## 1. Setup

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

```env
# .env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

---

## 2. Singleton — `src/lib/server/rate-limit.ts`

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/static/private';
import { dev } from '$app/environment';

function createRedisClient(): Redis | null {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    if (dev) return null; // dev fallback
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  }
  return new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
}

const redis = createRedisClient();

/** API endpoints: 10 req / 10s */
export const apiLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '10 s'), prefix: 'rl:api' })
  : null;

/** Auth actions: 5 attempts / 60s */
export const authLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:auth' })
  : null;

/** Sensitive actions: 3 / hour */
export const sensitiveLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:sensitive' })
  : null;

/** Extract real client IP from request */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

/** Check rate limit — returns null if allowed, Response if blocked */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ limited: true; headers: Record<string, string> } | { limited: false; headers: Record<string, string> }> {
  // Dev fallback: always allow
  if (!limiter) return { limited: false, headers: {} };

  const result = await limiter.limit(identifier);
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString()
  };

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    headers['Retry-After'] = retryAfter.toString();
    return { limited: true, headers };
  }

  return { limited: false, headers };
}
```

---

## 3. API Endpoints — `+server.ts`

```typescript
// src/routes/api/donations/+server.ts
import { json } from '@sveltejs/kit';
import { apiLimiter, getClientIp, checkRateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  const ip = getClientIp(request);
  const { limited, headers } = await checkRateLimit(apiLimiter, ip);

  if (limited) {
    return json({ error: 'Too many requests' }, { status: 429, headers });
  }

  // ... business logic
  return json({ data: [] }, { headers });
};
```

---

## 4. Form Actions — Login / Signup

```typescript
// src/routes/login/+page.server.ts
import { fail } from '@sveltejs/kit';
import { authLimiter, getClientIp, checkRateLimit } from '$lib/server/rate-limit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request }) => {
    const ip = getClientIp(request);
    const { limited } = await checkRateLimit(authLimiter, `login:${ip}`);

    if (limited) {
      return fail(429, { error: 'Too many attempts. Try again later.' });
    }

    const formData = await request.formData();
    // ... validate with Zod, authenticate
  }
};
```

---

## 5. Hooks Integration — `hooks.server.ts`

```typescript
// src/hooks.server.ts
import { json, type Handle } from '@sveltejs/kit';
import { apiLimiter, getClientIp, checkRateLimit } from '$lib/server/rate-limit';

export const handle: Handle = async ({ event, resolve }) => {
  // Rate limit API routes globally
  if (event.url.pathname.startsWith('/api/')) {
    const ip = getClientIp(event.request);
    const { limited, headers } = await checkRateLimit(apiLimiter, `global:${ip}`);

    if (limited) {
      return json({ error: 'Too many requests' }, { status: 429, headers });
    }
  }

  const response = await resolve(event);
  return response;
};
```

---

## 6. Headers

Every rate-limited response includes:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-RateLimit-Limit` | `10` | Max requests in window |
| `X-RateLimit-Remaining` | `7` | Requests left |
| `Retry-After` | `8` | Seconds until reset (only on 429) |

Handled automatically by `checkRateLimit()` above.

---

## 7. Dev Fallback

When `UPSTASH_REDIS_REST_URL` is empty in dev, all limiters resolve to `null`.
`checkRateLimit(null, id)` returns `{ limited: false, headers: {} }` — no blocking, no crash.

In production, missing Redis credentials throw at import time.

---

## 8. Anti-patterns

```typescript
// BAD: client-side rate limiting (bypassable)
let count = 0;
function onClick() { if (count++ > 5) return; }

// BAD: no IP extraction (everyone shares one bucket)
await limiter.limit('global');

// BAD: using request.url as identifier (different per route)
await limiter.limit(request.url);

// BAD: hardcoded env vars
const redis = new Redis({ url: 'https://xxx.upstash.io', token: 'AXxx' });

// BAD: try/catch swallowing rate limit errors silently
try { await limiter.limit(ip); } catch { /* yolo */ }

// GOOD: always use real IP + purpose prefix
await limiter.limit(`login:${getClientIp(request)}`);
```
