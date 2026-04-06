# Orchestre — Stack: Next.js + Supabase + Stripe

> Stack-specific rules, standards, and patterns for Next.js App Router projects.
> These rules EXTEND the universal rules in CLAUDE.base.md.

---

## Stack-Specific Architecture Rules

### R6 — Server Components by default
`'use client'` only when useState/useEffect/onClick are necessary.

### R7 — Mutations = Server Actions only
Never `fetch('/api/...', { method: 'POST' })`. Always `actions/*.ts` with `'use server'`.

---

## Coding Standards (Next.js)

- **Use `proxy.ts`** (not `middleware.ts`) for Next.js 16+
- **Route handlers**: `export async function GET/POST/PUT/DELETE` only
- **Server Actions**: separate files (`actions/*.ts` or `_actions.ts`), always `'use server'` at top of file
- **Client components**: `'use client'` only when necessary (hooks, events, browser APIs)
- **Import alias**: `@/` for all imports

### Singletons
| Client | File | Pattern |
|--------|------|---------|
| Supabase (server) | `lib/supabase/server.ts` | `createServerClient()` |
| Supabase (client) | `lib/supabase/client.ts` | `createBrowserClient()` |
| Stripe | `lib/stripe.ts` | `new Stripe(process.env.STRIPE_SECRET_KEY)` |
| Resend | `lib/email/client.ts` | `new Resend(process.env.RESEND_API_KEY)` |
| AI (Anthropic/OpenAI) | `lib/ai/client.ts` | `new Anthropic()` |

**Never instantiate in components or pages.** Import from the singleton file.

### Design System
- **NEVER** hardcoded Tailwind colors: ~~`bg-blue-500`~~ ~~`text-red-600`~~
- **ALWAYS** semantic tokens: `bg-primary`, `text-destructive`, `border-border`
- Icons: lucide-react only. No emoji as icons.
- Colors via CSS variables: `hsl(var(--primary))` in custom styles

### Project Structure
```
app/          <- Routing ONLY (pages, layouts, route handlers)
components/   <- UI ONLY (props, no fetch)
lib/          <- BUSINESS LOGIC (queries, mutations, schemas, errors)
actions/      <- Server Actions ('use server')
```

---

## Security (Supabase + Stripe)

- **RLS enabled** on all user tables
- **`getUser()`** not `getSession()` for sensitive ops
- **Zod validation** server-side on all inputs
- **Webhook signatures** verified (Stripe: `constructEvent`)
- **`lib/config.ts`** validates ENV vars at boot
- **Never `NEXT_PUBLIC_`** on secrets
- **`global-error.tsx`**: generic message in prod
- **Never `console.log`** with sensitive data

### ENV Variables
| Variable | Source | Public? |
|----------|--------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase Dashboard -> Settings -> API | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Dashboard -> Settings -> API | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard -> Settings -> API | **No** |
| STRIPE_SECRET_KEY | Stripe Dashboard -> Developers -> API Keys | **No** |
| STRIPE_WEBHOOK_SECRET | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | **No** |
| RESEND_API_KEY | Resend Dashboard -> API Keys | **No** |

---

## Knowledge (read BEFORE coding)
| Topic | File |
|-------|------|
| Stripe | `stacks/nextjs-supabase/knowledge/stripe-billing.md` |
| Supabase | `stacks/nextjs-supabase/knowledge/supabase-patterns.md` |
| Auth | `stacks/nextjs-supabase/knowledge/auth-hardening.md` |
| Errors | `core/knowledge/error-handling.md` |
| RLS | `stacks/nextjs-supabase/knowledge/rls-patterns.md` |
| Forms | `stacks/nextjs-supabase/knowledge/rhf-zod.md` |
| Server Actions | `stacks/nextjs-supabase/knowledge/nextjs-server-actions.md` |
| Rate limiting | `stacks/nextjs-supabase/knowledge/rate-limiting.md` |
| Design | `core/knowledge/design-quality.md` |
| Frontend | `stacks/nextjs-supabase/knowledge/frontend-patterns.md` |
| Charts | `stacks/nextjs-supabase/knowledge/recharts.md` |
| shadcn | `stacks/nextjs-supabase/knowledge/shadcn-advanced.md` |
| Email | `stacks/nextjs-supabase/knowledge/resend.md` |
| Sentry | `stacks/nextjs-supabase/knowledge/sentry.md` |
| TanStack | `stacks/nextjs-supabase/knowledge/tanstack-query.md` |
| Zod | `core/knowledge/zod-server.md` |

---

## Hook Enforcement

Your code is validated by pre-write hooks before writing to disk. The following will be **blocked**:
1. `any` type usage
2. Hardcoded Tailwind colors (`bg-blue-500`)
3. `throw new` in `lib/` files
4. `supabase.from()` in `app/` or `components/`
5. Relative import paths (`../../`)
6. Secret patterns (API keys, tokens)
7. `NEXT_PUBLIC_` prefix on secret vars
8. Sensitive data in `console.log`

Fix violations before retrying the write.
