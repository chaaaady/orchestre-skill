# Coding Standards — Security (SvelteKit + Drizzle + Lucia)

> Security is enforced at three levels: pre-write hooks, pre-commit hooks, and Wave 4 security-review.

## Authentication (Lucia v3)

- **Session validation in `hooks.server.ts`** — every request checks session cookie
- **`event.locals.user`** is the ONLY source of truth for the current user
- **Never trust client-side data** for auth decisions
- **Session cookie**: httpOnly, secure, sameSite: lax
- **Session expiry**: auto-refresh in hooks, 30-day max lifetime

```typescript
// src/hooks.server.ts
import { lucia } from '$lib/server/auth'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(lucia.sessionCookieName)
  if (!sessionId) {
    event.locals.user = null
    event.locals.session = null
    return resolve(event)
  }

  const { session, user } = await lucia.validateSession(sessionId)
  if (session?.fresh) {
    const cookie = lucia.createSessionCookie(session.id)
    event.cookies.set(cookie.name, cookie.value, { path: '.', ...cookie.attributes })
  }
  if (!session) {
    const cookie = lucia.createBlankSessionCookie()
    event.cookies.set(cookie.name, cookie.value, { path: '.', ...cookie.attributes })
  }

  event.locals.user = user
  event.locals.session = session
  return resolve(event)
}
```

## Database (Drizzle ORM)

- **All queries go through Drizzle** — never raw `sql` with user input
- **Always filter by `userId`** in SELECT/UPDATE/DELETE
- **Use transactions** for multi-step operations
- **Migrations via `drizzle-kit`** — never manual DDL in production
- **Connection pooling**: use `postgres()` driver with pool settings

```typescript
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { DATABASE_URL } from '$env/static/private'
import * as schema from './schema'

const client = postgres(DATABASE_URL)
export const db = drizzle(client, { schema })
```

## Form Actions & API Routes

- **Always check `locals.user`** first in actions and load functions
- **Validate all form inputs with Zod** (safeParse, not parse)
- **CSRF protection is automatic** with SvelteKit form actions (origin check)
- **Rate limiting** on public API endpoints (+server.ts)

```typescript
// Correct pattern for protected action
export const actions: Actions = {
  update: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' })

    const formData = await request.formData()
    const parsed = updateSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return fail(400, { error: 'Invalid input', issues: parsed.error.flatten() })

    const result = await updateResource(parsed.data, locals.user.id)
    if (!result.success) return fail(result.error.status, { error: result.error.message })

    return { success: true }
  }
}
```

## Webhooks

- **Always verify signature** before processing:
  - Stripe: `stripe.webhooks.constructEvent(body, sig, secret)`
- **Return 200 immediately**, process async if operation is long
- **Idempotency**: handle duplicate webhook deliveries gracefully
- **Webhooks go in `+server.ts`** (not form actions)

```typescript
// src/routes/api/webhooks/stripe/+server.ts
import { stripe } from '$lib/server/stripe'
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private'
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, STRIPE_WEBHOOK_SECRET)
  } catch {
    error(400, 'Invalid signature')
  }

  // Process event...
  return json({ received: true })
}
```

## Environment Variables

- **`$env/static/private`** for ALL secrets — imported at build time, tree-shaken
- **`$env/static/public`** only for safe client-side vars
- **Never `PUBLIC_` on secrets**: `STRIPE_SECRET_KEY`, `DATABASE_URL`, `RESEND_API_KEY`
- **Validate at startup** in `hooks.server.ts` or a dedicated `$lib/server/config.ts`

```typescript
// src/lib/server/config.ts
import { DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '$env/static/private'

// These will throw at build time if missing (SvelteKit static analysis)
export const config = {
  databaseUrl: DATABASE_URL,
  stripe: {
    secretKey: STRIPE_SECRET_KEY,
    webhookSecret: STRIPE_WEBHOOK_SECRET,
  },
} as const
```

## Error Handling

- **`handleError` hook** in `hooks.server.ts` — never expose error details in production
- **Custom error pages**: `+error.svelte` with generic message
- **No `console.log` with user data** (emails, tokens, passwords) -> *Hook enforced*

```typescript
// src/hooks.server.ts (add to existing handle)
import type { HandleServerError } from '@sveltejs/kit'

export const handleError: HandleServerError = async ({ error, event }) => {
  // Log internally (structured logging)
  console.error('Unhandled error:', { url: event.url.pathname, error })

  return {
    message: 'Something went wrong',
    // Never expose error.message in production
  }
}
```

## Security Checklist

Before shipping:
- [ ] `hooks.server.ts` validates session on every request
- [ ] All form actions check `locals.user`
- [ ] Webhook signatures verified
- [ ] No secrets in `PUBLIC_*` vars
- [ ] `$env/static/private` for all secret imports
- [ ] Custom `handleError` doesn't expose details
- [ ] Rate limiting on public API endpoints
- [ ] Input validation with Zod in all form actions
- [ ] Database queries always filter by userId
- [ ] No `console.log` with sensitive data
