# SKILL: Rate Limiting
> Module ID: `security-ratelimit` | Domaine: Sécurité / API | Stack: Next.js + Upstash Redis

## Install
```bash
npm install @upstash/ratelimit @upstash/redis
```
```bash
# Env vars
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Exports clés
- `Ratelimit` — instance configurée avec algorithme + store
- `Ratelimit.slidingWindow(n, interval)` — algorithme recommandé
- `ratelimit.limit(identifier)` — retourne `{ success, limit, remaining, reset }`
- `Redis.fromEnv()` — client Redis depuis les env vars

## Pattern principal — Middleware Next.js
```ts
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),  // 10 req / 10s
  analytics: true,
  prefix: "rl:api",
})

export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),  // 5 req / min (login, register)
  analytics: true,
  prefix: "rl:auth",
})

// middleware.ts
import { NextResponse, type NextRequest } from "next/server"
import { apiRatelimit } from "@/lib/rate-limit"

export async function middleware(req: NextRequest) {
  const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "anonymous"

  if (req.nextUrl.pathname.startsWith("/api/")) {
    const { success, limit, remaining, reset } = await apiRatelimit.limit(ip)

    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
```

## Patterns secondaires

**Rate limit dans une Server Action (auth) :**
```ts
'use server'
import { authRatelimit } from "@/lib/rate-limit"
import { headers } from "next/headers"

export async function loginAction(data: LoginInput) {
  const ip = (await headers()).get("x-forwarded-for") ?? "anonymous"
  const { success } = await authRatelimit.limit(`login:${ip}`)
  if (!success) return { error: "Trop de tentatives. Réessayez dans 1 minute." }
  // ... logique login
}
```

**Rate limit par user (auth) :**
```ts
// Identifier = user ID pour les actions authentifiées (plus précis que IP)
const { success } = await apiRatelimit.limit(`user:${userId}`)
```

**Fallback in-memory (dev sans Upstash) :**
```ts
// lib/rate-limit.ts (dev fallback)
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// In dev without Upstash, return null and skip rate limiting.
// Passing a Map() to Ratelimit crashes — the constructor expects a Redis instance.
export const apiRatelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, "10 s") })
  : null  // No rate limiting in dev without Upstash

// Usage: check for null before calling .limit()
// if (apiRatelimit) { const { success } = await apiRatelimit.limit(ip) }
```

## Gotchas
- **Vercel Edge = pas de mémoire partagée** entre les instances. `in-memory Map` ne fonctionne qu'en dev local — Upstash obligatoire en prod.
- **`req.ip`** peut être `undefined` sur certaines configs — toujours fallback sur `x-forwarded-for`.
- **Identifier** : IP pour les routes publiques, userId pour les routes auth (meilleure précision).
- **`analytics: true`** : active le dashboard Upstash — utile pour monitorer les abus.
- **Middleware vs Server Action** : le middleware est plus efficace (avant le runtime Next.js). Server Action pour les cas où tu as besoin du contexte user.

## À NE PAS FAIRE
- Ne pas utiliser une `Map` en mémoire en production multi-instances
- Ne pas rate-limiter uniquement côté client (contournable)
- Ne pas oublier les headers `Retry-After` dans la 429 response (bonne pratique API)
- Ne pas utiliser le même `prefix` pour des rate limiters différents (collision de clés Redis)
- Ne pas rate-limiter les routes Next.js internes (`/_next/`, `/favicon.ico`)
