# Coding Standards — TypeScript / SvelteKit 2

> These rules are enforced by pre-write hooks. Violations are blocked before reaching disk.

## Typing

- **Always type explicitly**: props, return types, function parameters
- **Ban `any`**: use `unknown` + type narrowing instead -> *Hook enforced*
- **Prefer `type` over `interface`** (except extensible object contracts)
- **Infer from Zod**: `type X = z.infer<typeof xSchema>` — never duplicate manually
- **Explicit return types on `src/lib/server/` functions**: required for LSP analysis

```typescript
// src/lib/schemas/user.ts
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
})
type User = z.infer<typeof userSchema>

// src/lib/server/queries/users.ts
export async function getUser(id: string): Promise<Result<User, AppError>> { ... }
```

## Imports

- **No circular imports**: A imports B, B must not import A
- **Alias `$lib/` for all imports**: no relative paths like `../../../` -> *Hook enforced*
- **No cross-feature imports**: `components/featureA/` must not import from `components/featureB/`
- **Server-only imports**: `$lib/server/` must NEVER be imported from client-side code

```typescript
// Correct
import { Button } from '$lib/components/ui/button.svelte'
import { getUsers } from '$lib/server/queries/users'
import { userSchema } from '$lib/schemas/user'

// Blocked by hook
import { getUsers } from '../../../lib/server/queries/users'
```

## SvelteKit Specifics

- **Svelte 5 runes**: `$state()`, `$derived()`, `$effect()` are preferred
- **`+page.server.ts`**: `load()` for data, `actions` for mutations
- **`+server.ts`**: only for webhooks, external API endpoints, SSE
- **`+layout.server.ts`**: shared data loading (auth state, user profile)
- **`hooks.server.ts`**: auth middleware, session refresh, error handling
- **`$env/static/private`**: server-only env vars (secrets)
- **`$env/static/public`**: client-safe env vars only

```typescript
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad, Actions } from './$types'
import { getProjects } from '$lib/server/queries/projects'
import { projectSchema } from '$lib/schemas/project'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login')
  const result = await getProjects(locals.user.id)
  if (!result.success) error(500, result.error.message)
  return { projects: result.data }
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' })
    const formData = await request.formData()
    const parsed = projectSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return fail(400, { error: 'Invalid input' })
    // ...
  }
}
```

## Async / Error Handling

- **No unhandled `throw` in `src/lib/server/`**: return `Result<T, AppError>` -> *Hook enforced*
- **Use `zod.safeParse()`**: never `zod.parse()` for user input (forms, API)
- **Result pattern everywhere in server lib**:

```typescript
// src/lib/server/errors.ts
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

## Design System

- **NEVER use Tailwind color literals**: `bg-blue-500`, `text-red-600` -> BLOCKED by hook
- **Only semantic tokens**: `bg-primary`, `text-destructive`, `text-muted-foreground`, `border-border`
- **Colors via CSS variables**: `hsl(var(--primary))` in custom styles
- **Component library**: shadcn-svelte (Svelte port of shadcn/ui)

## Singletons

External clients must be instantiated ONCE in a dedicated file under `src/lib/server/`:

| Client | File | Pattern |
|--------|------|---------|
| Drizzle DB | `src/lib/server/db/index.ts` | `drizzle(postgres(env.DATABASE_URL))` |
| Lucia Auth | `src/lib/server/auth.ts` | `new Lucia(adapter)` |
| Stripe | `src/lib/server/stripe.ts` | `new Stripe(env.STRIPE_SECRET_KEY)` |
| Resend | `src/lib/server/email.ts` | `new Resend(env.RESEND_API_KEY)` |

**Never instantiate in components or +page.svelte.** Import from the singleton file.

## Hook Reminder

Your code is validated by pre-write hooks before writing to disk. The following will be **blocked**:
1. `any` type usage
2. Hardcoded Tailwind colors (`bg-blue-500`)
3. `throw new` in `src/lib/server/` files
4. `db.` or `fetch()` calls in `src/lib/components/`
5. Non-`$lib/` import paths (`../../../`)
6. Secret patterns (API keys, tokens)
7. `PUBLIC_` prefix on secret vars
8. Sensitive data in `console.log`

Fix violations before retrying the write.
