# Coding Standards — TypeScript / Next.js 16

> These rules are enforced by pre-write hooks in V16. Violations are blocked before reaching disk.

## Typing

- **Always type explicitly**: props, return types, function parameters
- **Ban `any`**: use `unknown` + type narrowing instead → *Hook enforced*
- **Prefer `type` over `interface`** (except extensible object contracts)
- **Infer from Zod**: `type X = z.infer<typeof xSchema>` — never duplicate manually
- **Explicit return types on lib/ functions**: required for LSP analysis in Wave 4

```typescript
// ✅ Correct
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
})
type User = z.infer<typeof userSchema>

export async function getUser(id: string): Promise<Result<User, AppError>> { ... }

// ❌ Blocked by hook
const data: any = await fetch(url)
```

## Imports

- **No circular imports**: A imports B, B must not import A
- **Barrel exports only in `components/ui/`**: elsewhere, import directly
- **Alias `@/` for all imports**: no relative paths like `../../lib/utils` → *Hook enforced*
- **No cross-feature imports**: `components/featureA/` must not import from `components/featureB/`

```typescript
// ✅ Correct
import { Button } from '@/components/ui/button'
import { getDonations } from '@/lib/queries/donations'

// ❌ Blocked by hook
import { getDonations } from '../../lib/queries/donations'
```

## Async / Error Handling

- **All async in `app/api/`**: must have try/catch with `{ error: string }` normalized response
- **No unhandled `throw` in `lib/`**: return `Result<T, AppError>` or `null` → *Hook enforced*
- **Use `zod.safeParse()`**: never `zod.parse()` for user input (API, forms)
- **Result pattern everywhere in lib/**:

```typescript
// lib/errors.ts
export class AppError {
  constructor(
    public code: string,
    public message: string,
    public status: number = 500
  ) {}
}

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E }
```

## Next.js 16 Specifics

- **Use `proxy.ts`** (not `middleware.ts`) for Next.js 16+
- **Route handlers**: `export async function GET/POST/PUT/DELETE` only
- **Server Actions**: separate files (`actions/*.ts` or `_actions.ts`), always `'use server'` at top of file
- **Client components**: `'use client'` only when necessary (hooks, events, browser APIs)
- **Server Components by default**: everything without `'use client'` is a Server Component

## Design System

- **NEVER use Tailwind color literals**: `bg-blue-500`, `text-red-600` → BLOCKED by hook
- **Only semantic tokens**: `bg-primary`, `text-destructive`, `text-muted-foreground`, `border-border`
- **Exceptions**: `transparent`, `white`, `black` for utilities
- **Colors via CSS variables**: `hsl(var(--primary))` in custom styles

## Singletons

External clients must be instantiated ONCE in a dedicated file:

| Client | File | Pattern |
|--------|------|---------|
| Supabase (server) | `lib/supabase/server.ts` | `createServerClient()` |
| Supabase (client) | `lib/supabase/client.ts` | `createBrowserClient()` |
| Stripe | `lib/stripe.ts` | `new Stripe(process.env.STRIPE_SECRET_KEY)` |
| Resend | `lib/email/client.ts` | `new Resend(process.env.RESEND_API_KEY)` |
| AI (Anthropic/OpenAI) | `lib/ai/client.ts` | `new Anthropic()` |

**Never instantiate in components or pages.** Import from the singleton file.

## ENV Validation

- **`lib/config.ts`**: validates all required ENV vars at boot time
- Throws immediately if required var is missing or empty
- Hook enforced: Wave 4 checks for `lib/config.ts` existence

```typescript
// lib/config.ts
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const config = {
  supabase: {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  // ... per module
} as const
```

## Hook Reminder

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
