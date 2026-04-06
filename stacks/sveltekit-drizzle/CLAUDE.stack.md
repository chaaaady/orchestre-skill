# Orchestre — Stack: SvelteKit + Drizzle + Stripe

> Stack-specific rules, standards, and patterns for SvelteKit projects.
> These rules EXTEND the universal rules in CLAUDE.base.md.

---

## Stack-Specific Architecture Rules

### R6 — Data loading in +page.server.ts only
All data fetching happens in `load()` functions inside `+page.server.ts` or `+layout.server.ts`.
Never fetch data directly in `.svelte` components. Components receive data via `export let data` (Svelte 4) or `let { data } = $props()` (Svelte 5).

### R7 — Mutations via form actions only
Use SvelteKit form actions (`export const actions = { ... }`) in `+page.server.ts`.
Never `fetch('/api/...', { method: 'POST' })` from components. Use `<form method="POST" use:enhance>`.
API endpoints (`+server.ts`) are for webhooks and external integrations only.

---

## Coding Standards (SvelteKit)

- **Svelte 5 runes preferred**: `$state()`, `$derived()`, `$effect()` over legacy `$:` reactive declarations
- **`+page.server.ts`** for data loading — never `fetch()` in `+page.svelte`
- **Form actions** for mutations — `use:enhance` for progressive enhancement
- **`hooks.server.ts`** for auth middleware — check `event.locals.user`
- **Import alias**: `$lib/` for all imports — never `../../../`

### Singletons
| Client | File | Pattern |
|--------|------|---------|
| Drizzle DB | `src/lib/server/db/index.ts` | `drizzle(postgres(env.DATABASE_URL))` |
| Lucia Auth | `src/lib/server/auth.ts` | `new Lucia(adapter)` |
| Stripe | `src/lib/server/stripe.ts` | `new Stripe(env.STRIPE_SECRET_KEY)` |
| Resend | `src/lib/server/email.ts` | `new Resend(env.RESEND_API_KEY)` |

**Never instantiate in components or +page.svelte.** Import from the singleton file in `src/lib/server/`.

### Design System
- **NEVER** hardcoded Tailwind colors: ~~`bg-blue-500`~~ ~~`text-red-600`~~
- **ALWAYS** semantic tokens: `bg-primary`, `text-destructive`, `border-border`
- Icons: lucide-svelte only. No emoji as icons.
- Component library: shadcn-svelte

### Project Structure
```
src/
  routes/        <- Routing + data loading + form actions
  lib/
    components/  <- UI ONLY (props, no fetch)
    server/      <- BUSINESS LOGIC (queries, mutations, db, auth)
      db/        <- Drizzle schema + client
    schemas/     <- Zod schemas (shared client/server)
  hooks.server.ts <- Auth middleware, session validation
```

---

## Security (Drizzle + Lucia)

- **Auth in `hooks.server.ts`** — validate session, populate `event.locals.user`
- **Check `event.locals.user`** in every `+page.server.ts` load/action that needs auth
- **Zod validation** in all form actions before processing
- **Webhook signatures** verified in `+server.ts` (Stripe: `constructEvent`)
- **`$env/static/private`** for secrets — never `$env/static/public` for secret keys
- **CSRF protection** is built-in with SvelteKit form actions (automatic origin check)
- **Never expose `error.message`** in production — use `handleError` hook

### ENV Variables
| Variable | Source | Public? |
|----------|--------|---------|
| DATABASE_URL | PostgreSQL connection string | **No** |
| STRIPE_SECRET_KEY | Stripe Dashboard -> Developers -> API Keys | **No** |
| PUBLIC_STRIPE_KEY | Stripe Dashboard -> Developers -> API Keys | Yes |
| STRIPE_WEBHOOK_SECRET | `stripe listen --forward-to localhost:5173/api/webhooks/stripe` | **No** |
| RESEND_API_KEY | Resend Dashboard -> API Keys | **No** |

### Drizzle Security
- **Always filter by `userId`** in queries — no global selects without auth context
- **Use `db.transaction()`** for multi-step operations
- **Parameterized queries only** — Drizzle does this by default, never use `sql.raw()` with user input
- **Migrations via `drizzle-kit`** — never manual SQL in production

---

## Knowledge (read BEFORE coding)
| Topic | File |
|-------|------|
| Drizzle ORM | `stacks/sveltekit-drizzle/knowledge/drizzle-patterns.md` |
| Auth (Lucia) | `stacks/sveltekit-drizzle/knowledge/sveltekit-auth.md` |
| Forms | `stacks/sveltekit-drizzle/knowledge/sveltekit-forms.md` |
| Routing | `stacks/sveltekit-drizzle/knowledge/sveltekit-routing.md` |
| Stripe | `stacks/sveltekit-drizzle/knowledge/stripe-sveltekit.md` |
| Rate limiting | `stacks/sveltekit-drizzle/knowledge/rate-limiting.md` |
| Errors | `core/knowledge/error-handling.md` |
| Design | `core/knowledge/design-quality.md` |
| Zod | `core/knowledge/zod-server.md` |

---

## Hook Enforcement

Your code is validated by pre-write hooks before writing to disk. The following will be **blocked**:
1. `any` type usage
2. Hardcoded Tailwind colors (`bg-blue-500`)
3. `throw new` in `src/lib/server/` files
4. Direct DB/fetch calls in `src/lib/components/` or `+page.svelte`
5. Non-`$lib/` import paths (deep relative `../../../`)
6. Secret patterns (API keys, tokens)
7. `PUBLIC_` prefix on secret vars
8. Sensitive data in `console.log`

Fix violations before retrying the write.
