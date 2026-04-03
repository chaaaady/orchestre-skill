# Coding Standards — Security

> In V16, security is enforced at three levels: pre-write hooks, pre-commit hooks, and Wave 4 security-review.

## API Routes

- **Always check auth first**: `const user = await getUser()` → 401 if null
- **Validate all inputs with Zod** before processing (safeParse, not parse)
- **Never expose API keys** in responses or logs → *Hook enforced*
- **Rate limiting** on all public routes (use Upstash Redis pattern from library-templates)
- **Return proper HTTP status codes**: 400 validation, 401 unauth, 403 forbidden, 404 not found, 500 server error

```typescript
// ✅ Correct API route pattern
export async function POST(request: Request) {
  // 1. Auth check
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Input validation
  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // 3. Business logic (delegated to lib/)
  const result = await createResource(parsed.data, user.id)
  if (!result.success) return NextResponse.json({ error: result.error.message }, { status: result.error.status })

  return NextResponse.json(result.data, { status: 201 })
}
```

## Database (Supabase)

- **RLS activated on ALL tables** with user data — NEVER use `service_role` key client-side
- **No raw SQL queries** — use typed Supabase client
- **Always filter by `user_id`** in SELECT/UPDATE/DELETE (or workspace membership)
- **Service role key** = server-side ONLY, never in `NEXT_PUBLIC_*` → *Hook enforced*

```sql
-- Every table with user data:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own {table}"
  ON {table} FOR ALL
  USING (auth.uid() = user_id);
```

## Environment Variables

- **All required vars validated at boot** via `lib/config.ts` (throws if missing)
- **`NEXT_PUBLIC_*`** only for safe client-side vars (URL, anon key, PostHog key)
- **NEVER `NEXT_PUBLIC_*` on secrets**: `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` → *Hook enforced*
- **`.env` files in `.gitignore`** → *pre-commit hook enforced*
- **`.env.example`** with empty values only (no real keys)

## Webhooks

- **Always verify signature** before processing:
  - Stripe: `stripe.webhooks.constructEvent(body, sig, secret)`
  - Postmark: verify `X-Postmark-Signature` header
- **Return 200 immediately**, process async if operation is long
- **Idempotency**: handle duplicate webhook deliveries gracefully

```typescript
// ✅ Correct Stripe webhook pattern
export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Process event...
  return NextResponse.json({ received: true })
}
```

## Auth

- **Use `getUser()`** (not `getSession()`) for security-critical operations
- **OAuth callbacks** only in `app/(auth)/callback/route.ts`
- **Session expiry**: 24h max for sensitive actions
- **PKCE enabled** for all OAuth flows
- **httpOnly cookies** for session storage (not localStorage)
- **Middleware/proxy** refreshes session + protects authenticated routes

## Error Handling

- **`global-error.tsx`** must NOT expose `error.message` or `error.digest` in production → *Hook + Audit enforced*
- Show generic message in prod, details only in `NODE_ENV === 'development'`
- **No `console.log` with user data** (emails, tokens, passwords) → *Hook enforced*
- **Structured logging** via `lib/logger.ts` — no raw console in production

```typescript
// app/global-error.tsx
'use client'
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <h1>Something went wrong</h1>
        {process.env.NODE_ENV === 'development' && <pre>{error.message}</pre>}
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
```

## V16 Security Enforcement Layers

### Layer 1: Pre-Write Hooks (Real-time)
- Block secret patterns in code files
- Block `NEXT_PUBLIC_` on secret var names
- Block sensitive `console.log`
- Block `any` type (potential type safety bypass)

### Layer 2: Pre-Commit Hooks (Before git)
- Scan staged files for: Stripe keys, JWTs, GitHub PATs, AWS keys
- Verify `.env` in `.gitignore`
- Check `global-error.tsx` doesn't expose details
- Block commit if ANY security issue found

### Layer 3: Wave 4 Security Review
- Deep security audit using Claude Code's `security-review`
- Auth flow analysis (login, register, session management)
- Injection vector detection (SQL, XSS, CSRF)
- Permission checks (RLS enforcement, role-based access)
- Only on auth/billing/API tasks in balanced profile; all tasks in premium

## Security Checklist

Before shipping:
- [ ] All tables have RLS enabled
- [ ] Auth uses `getUser()` not `getSession()`
- [ ] Webhook signatures verified
- [ ] No secrets in `NEXT_PUBLIC_*` vars
- [ ] `.env` in `.gitignore`
- [ ] `global-error.tsx` safe in production
- [ ] Rate limiting on public endpoints
- [ ] Input validation with Zod on all routes
- [ ] `lib/config.ts` validates ENV at boot
- [ ] No `console.log` with sensitive data
