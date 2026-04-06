# SvelteKit Authentication — Lucia v3 + Drizzle

> Library template for AI code generation.
> Lucia v3 is a session management library — NOT an auth framework.
> You handle password hashing, OAuth, and token generation yourself.

---

## 1. Setup — Lucia Singleton

**File: `src/lib/server/auth.ts`** (singleton — never instantiate elsewhere)

```typescript
import { Lucia } from 'lucia'
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { dev } from '$app/environment'
import { db } from '$lib/server/db'
import { sessionsTable, usersTable } from '$lib/server/db/schema'

const adapter = new DrizzlePostgreSQLAdapter(db, sessionsTable, usersTable)

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: !dev,
      sameSite: 'lax',
      path: '/',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      name: attributes.name,
      avatarUrl: attributes.avatarUrl,
    }
  },
})

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia
    DatabaseUserAttributes: DatabaseUserAttributes
  }
}

type DatabaseUserAttributes = {
  email: string
  name: string
  avatarUrl: string | null
}
```

**Key points:**
- `secure: !dev` — cookies are secure in production, plain in dev
- `sameSite: 'lax'` — allows OAuth redirects while blocking CSRF
- `getUserAttributes` maps DB columns to `session.user` — add only what you need
- The `declare module` block is required for type inference on `locals.user`

---

## 2. Database Schema

**File: `src/lib/server/db/schema.ts`**

```typescript
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(), // nanoid or cuid2, NOT uuid from DB
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  hashedPassword: text('hashed_password'), // null for OAuth-only users
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
})

export const oauthAccountsTable = pgTable('oauth_accounts', {
  providerId: text('provider_id').notNull(), // 'github' | 'google'
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
})

export const passwordResetTokensTable = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(), // hashed token
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
})
```

**Why `text('id')` not serial/uuid:**
- Lucia generates session IDs itself
- User IDs should be generated in application code (nanoid/cuid2) for portability
- `onDelete: 'cascade'` on sessions/oauth — deleting a user cleans up everything

---

## 3. hooks.server.ts — Session Middleware

**File: `src/hooks.server.ts`**

```typescript
import type { Handle } from '@sveltejs/kit'
import { lucia } from '$lib/server/auth'

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(lucia.sessionCookieName)

  if (!sessionId) {
    event.locals.user = null
    event.locals.session = null
    return resolve(event)
  }

  const { session, user } = await lucia.validateSession(sessionId)

  // Session was refreshed — update the cookie
  if (session?.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id)
    event.cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    })
  }

  // Session expired — clear the cookie
  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie()
    event.cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    })
  }

  event.locals.user = user
  event.locals.session = session

  return resolve(event)
}
```

**File: `src/app.d.ts`** (type augmentation)

```typescript
declare global {
  namespace App {
    interface Locals {
      user: import('lucia').User | null
      session: import('lucia').Session | null
    }
  }
}

export {}
```

**What this does:**
- Runs on EVERY server request
- Validates the session cookie against the DB
- Auto-refreshes sessions that are close to expiry (`session.fresh`)
- Clears stale cookies when sessions are invalid
- Populates `event.locals.user` for all downstream load/action functions

---

## 4. Sign Up — Email/Password

**File: `src/routes/(auth)/signup/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit'
import { hash } from '@node-rs/argon2'
import { generateIdFromEntropySize } from 'lucia'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Actions } from './$types'
import { lucia } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { usersTable } from '$lib/server/db/schema'

const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
})

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = Object.fromEntries(await request.formData())
    const parsed = signupSchema.safeParse(formData)

    if (!parsed.success) {
      return fail(400, {
        message: parsed.error.errors[0].message,
        email: String(formData.email ?? ''),
      })
    }

    const { email, name, password } = parsed.data

    // Check if user exists
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      return fail(400, {
        message: 'An account with this email already exists',
        email,
      })
    }

    const hashedPassword = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    const userId = generateIdFromEntropySize(10) // 16-char ID

    await db.insert(usersTable).values({
      id: userId,
      email: email.toLowerCase(),
      name,
      hashedPassword,
    })

    const session = await lucia.createSession(userId, {})
    const sessionCookie = lucia.createSessionCookie(session.id)

    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    })

    redirect(302, '/dashboard')
  },
} satisfies Actions
```

**Argon2 config explained:**
- `memoryCost: 19456` — 19 MB RAM per hash (OWASP minimum recommendation)
- `timeCost: 2` — 2 iterations
- `outputLen: 32` — 32-byte hash
- `parallelism: 1` — single-threaded (safe for serverless)
- Use `@node-rs/argon2` (native binding), NOT `argon2` (WASM — slower)

---

## 5. Sign In — Email/Password

**File: `src/routes/(auth)/login/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit'
import { verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Actions, PageServerLoad } from './$types'
import { lucia } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { usersTable } from '$lib/server/db/schema'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
})

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) redirect(302, '/dashboard')
}

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = Object.fromEntries(await request.formData())
    const parsed = loginSchema.safeParse(formData)

    if (!parsed.success) {
      return fail(400, { message: 'Invalid email or password' })
    }

    const { email, password } = parsed.data

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1)

    // Generic error — never reveal if email exists
    if (!user?.hashedPassword) {
      return fail(400, { message: 'Invalid email or password' })
    }

    const validPassword = await verify(user.hashedPassword, password)
    if (!validPassword) {
      return fail(400, { message: 'Invalid email or password' })
    }

    const session = await lucia.createSession(user.id, {})
    const sessionCookie = lucia.createSessionCookie(session.id)

    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    })

    redirect(302, '/dashboard')
  },
} satisfies Actions
```

**Security notes:**
- Same error message for "email not found" and "wrong password" — prevents user enumeration
- `user?.hashedPassword` check handles OAuth-only users (no password set)
- Always lowercase email before lookup

---

## 6. Sign Out

**File: `src/routes/(auth)/logout/+page.server.ts`**

```typescript
import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { lucia } from '$lib/server/auth'

export const load: PageServerLoad = async () => {
  redirect(302, '/')
}

export const actions = {
  default: async ({ locals, cookies }) => {
    if (!locals.session) {
      redirect(302, '/login')
    }

    await lucia.invalidateSession(locals.session.id)

    const sessionCookie = lucia.createBlankSessionCookie()
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    })

    redirect(302, '/login')
  },
} satisfies Actions
```

**Usage in Svelte component:**

```svelte
<form method="POST" action="/logout">
  <button type="submit">Sign out</button>
</form>
```

**Why POST not GET:** Sign-out mutates state (deletes session). GET requests can be prefetched by browsers, triggered by link previews, or replayed. Always use a form POST for sign-out.

---

## 7. OAuth — GitHub & Google (Arctic)

### Provider Setup

**File: `src/lib/server/oauth.ts`**

```typescript
import { GitHub, Google } from 'arctic'
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '$env/static/private'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private'
import { dev } from '$app/environment'

const baseUrl = dev ? 'http://localhost:5173' : 'https://yourdomain.com'

export const github = new GitHub(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, {
  redirectURI: `${baseUrl}/auth/github/callback`,
})

export const google = new Google(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  `${baseUrl}/auth/google/callback`
)
```

### GitHub — Redirect

**File: `src/routes/auth/github/+server.ts`**

```typescript
import { redirect } from '@sveltejs/kit'
import { generateState } from 'arctic'
import { dev } from '$app/environment'
import type { RequestHandler } from './$types'
import { github } from '$lib/server/oauth'

export const GET: RequestHandler = async ({ cookies }) => {
  const state = generateState()

  const url = github.createAuthorizationURL(state, ['user:email'])

  cookies.set('github_oauth_state', state, {
    path: '/',
    secure: !dev,
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  })

  redirect(302, url)
}
```

### GitHub — Callback

**File: `src/routes/auth/github/callback/+server.ts`**

```typescript
import { error, redirect } from '@sveltejs/kit'
import { eq, and } from 'drizzle-orm'
import { generateIdFromEntropySize } from 'lucia'
import { dev } from '$app/environment'
import type { RequestHandler } from './$types'
import { github } from '$lib/server/oauth'
import { lucia } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { usersTable, oauthAccountsTable } from '$lib/server/db/schema'

type GitHubUser = {
  id: number
  login: string
  email: string | null
  avatar_url: string
  name: string | null
}

type GitHubEmail = {
  email: string
  primary: boolean
  verified: boolean
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = cookies.get('github_oauth_state')

  if (!code || !state || !storedState || state !== storedState) {
    error(400, 'Invalid OAuth state')
  }

  const tokens = await github.validateAuthorizationCode(code)
  const accessToken = tokens.accessToken()

  // Fetch GitHub user
  const githubUserRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const githubUser: GitHubUser = await githubUserRes.json()

  // Fetch primary email if not public
  let email = githubUser.email
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const emails: GitHubEmail[] = await emailsRes.json()
    const primary = emails.find((e) => e.primary && e.verified)
    email = primary?.email ?? null
  }

  if (!email) {
    error(400, 'GitHub account has no verified email')
  }

  // Check if OAuth account already linked
  const [existingOAuth] = await db
    .select()
    .from(oauthAccountsTable)
    .where(
      and(
        eq(oauthAccountsTable.providerId, 'github'),
        eq(oauthAccountsTable.providerUserId, String(githubUser.id))
      )
    )
    .limit(1)

  let userId: string

  if (existingOAuth) {
    // Returning user — just create session
    userId = existingOAuth.userId
  } else {
    // Check if email already registered (link accounts)
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1)

    if (existingUser) {
      userId = existingUser.id
    } else {
      // New user
      userId = generateIdFromEntropySize(10)
      await db.insert(usersTable).values({
        id: userId,
        email: email.toLowerCase(),
        name: githubUser.name ?? githubUser.login,
        avatarUrl: githubUser.avatar_url,
        emailVerified: true,
      })
    }

    // Link OAuth account
    await db.insert(oauthAccountsTable).values({
      providerId: 'github',
      providerUserId: String(githubUser.id),
      userId,
    })
  }

  const session = await lucia.createSession(userId, {})
  const sessionCookie = lucia.createSessionCookie(session.id)

  cookies.set(sessionCookie.name, sessionCookie.value, {
    path: '.',
    ...sessionCookie.attributes,
  })

  // Clean up OAuth state cookie
  cookies.delete('github_oauth_state', { path: '/' })

  redirect(302, '/dashboard')
}
```

### Google — Same Pattern with PKCE

Google follows the identical pattern but uses PKCE (`codeVerifier`):

```typescript
// src/routes/auth/google/+server.ts
import { generateState, generateCodeVerifier } from 'arctic'
import { dev } from '$app/environment'
import { google } from '$lib/server/oauth'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ cookies }) => {
  const state = generateState()
  const codeVerifier = generateCodeVerifier()

  const url = google.createAuthorizationURL(state, codeVerifier, [
    'openid',
    'email',
    'profile',
  ])

  cookies.set('google_oauth_state', state, {
    path: '/',
    secure: !dev,
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: 'lax',
  })

  cookies.set('google_code_verifier', codeVerifier, {
    path: '/',
    secure: !dev,
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: 'lax',
  })

  redirect(302, url)
}
```

```typescript
// src/routes/auth/google/callback/+server.ts
import { error, redirect } from '@sveltejs/kit'
import { eq, and } from 'drizzle-orm'
import { generateIdFromEntropySize } from 'lucia'
import type { RequestHandler } from './$types'
import { google } from '$lib/server/oauth'
import { lucia } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { usersTable, oauthAccountsTable } from '$lib/server/db/schema'

type GoogleUser = {
  id: string
  email: string
  verified_email: boolean
  name: string
  picture: string
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = cookies.get('google_oauth_state')
  const codeVerifier = cookies.get('google_code_verifier')

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    error(400, 'Invalid OAuth state')
  }

  const tokens = await google.validateAuthorizationCode(code, codeVerifier)
  const accessToken = tokens.accessToken()

  const googleUserRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const googleUser: GoogleUser = await googleUserRes.json()

  if (!googleUser.verified_email) {
    error(400, 'Google account email is not verified')
  }

  // Check if OAuth account already linked
  const [existingOAuth] = await db
    .select()
    .from(oauthAccountsTable)
    .where(
      and(
        eq(oauthAccountsTable.providerId, 'google'),
        eq(oauthAccountsTable.providerUserId, googleUser.id)
      )
    )
    .limit(1)

  let userId: string

  if (existingOAuth) {
    userId = existingOAuth.userId
  } else {
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, googleUser.email.toLowerCase()))
      .limit(1)

    if (existingUser) {
      userId = existingUser.id
    } else {
      userId = generateIdFromEntropySize(10)
      await db.insert(usersTable).values({
        id: userId,
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        emailVerified: true,
      })
    }

    await db.insert(oauthAccountsTable).values({
      providerId: 'google',
      providerUserId: googleUser.id,
      userId,
    })
  }

  const session = await lucia.createSession(userId, {})
  const sessionCookie = lucia.createSessionCookie(session.id)

  cookies.set(sessionCookie.name, sessionCookie.value, {
    path: '.',
    ...sessionCookie.attributes,
  })

  cookies.delete('google_oauth_state', { path: '/' })
  cookies.delete('google_code_verifier', { path: '/' })

  redirect(302, '/dashboard')
}
```

---

## 8. Protected Routes

### In load() functions

```typescript
// src/routes/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login')

  // locals.user is now typed and non-null
  return {
    user: locals.user,
  }
}
```

### In form actions

```typescript
export const actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.user) redirect(302, '/login')

    const formData = Object.fromEntries(await request.formData())
    // ... process with locals.user.id
  },
} satisfies Actions
```

### Layout-level protection (protect entire route group)

```typescript
// src/routes/(app)/+layout.server.ts
import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login')

  return {
    user: locals.user,
  }
}
```

Every route under `(app)/` now requires auth. No need to check in each `+page.server.ts`.

### Accessing user in components

```svelte
<!-- src/routes/(app)/dashboard/+page.svelte -->
<script lang="ts">
  let { data } = $props()
</script>

<h1>Welcome, {data.user.name}</h1>
```

**Never check `locals.user` or cookies in `.svelte` files.** Data flows from `load()` via props only.

---

## 9. Password Reset

### Step 1 — Token utilities

**File: `src/lib/server/tokens.ts`**

```typescript
import { sha256 } from '@oslojs/crypto/sha2'
import { encodeHexLowerCase } from '@oslojs/encoding'
import { generateIdFromEntropySize } from 'lucia'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { passwordResetTokensTable } from '$lib/server/db/schema'

const TOKEN_EXPIRY_HOURS = 2

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Delete existing tokens for this user
  await db
    .delete(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.userId, userId))

  const tokenRaw = generateIdFromEntropySize(25) // 40-char random token
  const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(tokenRaw)))

  await db.insert(passwordResetTokensTable).values({
    id: tokenHash,
    userId,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
  })

  return tokenRaw // Send THIS to user via email, store the HASH in DB
}

export async function validatePasswordResetToken(
  tokenRaw: string
): Promise<{ userId: string } | null> {
  const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(tokenRaw)))

  const [token] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.id, tokenHash))
    .limit(1)

  if (!token) return null
  if (token.expiresAt < new Date()) {
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, tokenHash))
    return null
  }

  // Delete token after validation (single use)
  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, tokenHash))

  return { userId: token.userId }
}
```

### Step 2 — Request reset (send email)

**File: `src/routes/(auth)/forgot-password/+page.server.ts`**

```typescript
import { fail } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Actions } from './$types'
import { db } from '$lib/server/db'
import { usersTable } from '$lib/server/db/schema'
import { createPasswordResetToken } from '$lib/server/tokens'
import { sendPasswordResetEmail } from '$lib/server/email'

const forgotSchema = z.object({
  email: z.string().email(),
})

export const actions = {
  default: async ({ request }) => {
    const formData = Object.fromEntries(await request.formData())
    const parsed = forgotSchema.safeParse(formData)

    if (!parsed.success) {
      return fail(400, { message: 'Invalid email' })
    }

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
      .limit(1)

    // Always return success — never reveal if email exists
    if (user) {
      const token = await createPasswordResetToken(user.id)
      await sendPasswordResetEmail(parsed.data.email, token)
    }

    return { success: true }
  },
} satisfies Actions
```

### Step 3 — Reset password with token

**File: `src/routes/(auth)/reset-password/[token]/+page.server.ts`**

```typescript
import { fail, redirect } from '@sveltejs/kit'
import { hash } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Actions } from './$types'
import { lucia } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { usersTable } from '$lib/server/db/schema'
import { validatePasswordResetToken } from '$lib/server/tokens'

const resetSchema = z.object({
  password: z.string().min(8).max(128),
})

export const actions = {
  default: async ({ request, params, cookies }) => {
    const formData = Object.fromEntries(await request.formData())
    const parsed = resetSchema.safeParse(formData)

    if (!parsed.success) {
      return fail(400, { message: parsed.error.errors[0].message })
    }

    const result = await validatePasswordResetToken(params.token)
    if (!result) {
      return fail(400, { message: 'Invalid or expired reset link' })
    }

    // Invalidate all existing sessions for this user
    await lucia.invalidateUserSessions(result.userId)

    const hashedPassword = await hash(parsed.data.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    })

    await db
      .update(usersTable)
      .set({ hashedPassword })
      .where(eq(usersTable.id, result.userId))

    // Create fresh session
    const session = await lucia.createSession(result.userId, {})
    const sessionCookie = lucia.createSessionCookie(session.id)

    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes,
    })

    redirect(302, '/dashboard')
  },
} satisfies Actions
```

**Token security model:**
- Raw token sent to user via email
- SHA-256 hash stored in DB — if DB is compromised, attacker cannot forge reset links
- Single-use: token is deleted after validation
- 2-hour expiry
- All existing sessions invalidated on password reset

---

## 10. Session Management

### Session Expiry

Lucia v3 uses a **dual-expiry model**:
- **Active period**: 15 days (session is valid)
- **Idle period**: 15 days after active period (session can be refreshed)
- Total max lifetime: 30 days

The `session.fresh` flag in hooks.server.ts handles auto-refresh transparently.

### Invalidate All Sessions (security action)

```typescript
// After password change, account compromise, etc.
await lucia.invalidateUserSessions(userId)
```

### Invalidate Single Session

```typescript
await lucia.invalidateSession(sessionId)
```

### Custom Session Attributes

If you need to store extra data per session (IP, device, etc.):

```typescript
// In schema — add columns to sessionsTable
export const sessionsTable = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
})

// When creating session — pass attributes as second arg
const session = await lucia.createSession(userId, {
  ipAddress: event.getClientAddress(),
  userAgent: event.request.headers.get('user-agent'),
})
```

### List Active Sessions (for "manage sessions" UI)

```typescript
// src/lib/server/queries/sessions.ts
import { eq, gt } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { sessionsTable } from '$lib/server/db/schema'

export async function getUserActiveSessions(userId: string) {
  return db
    .select({
      id: sessionsTable.id,
      expiresAt: sessionsTable.expiresAt,
      ipAddress: sessionsTable.ipAddress,
      userAgent: sessionsTable.userAgent,
    })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, userId),
        gt(sessionsTable.expiresAt, new Date())
      )
    )
}
```

---

## 11. Anti-Patterns — What NOT to Do

### Never import auth modules in client code

```typescript
// WRONG — this file is in src/lib/server/ for a reason
// +page.svelte
import { lucia } from '$lib/server/auth' // BLOCKED by SvelteKit — server module in client

// CORRECT — access user via load() data
let { data } = $props() // data.user comes from +page.server.ts
```

### Never store sessions/tokens in localStorage

```typescript
// WRONG — XSS can steal tokens from localStorage
localStorage.setItem('session', token)

// CORRECT — Lucia uses httpOnly cookies automatically
// You never touch the session token directly in client code
```

### Never trust client-provided user data

```typescript
// WRONG — client can send any userId
export const actions = {
  update: async ({ request }) => {
    const formData = await request.formData()
    const userId = formData.get('userId') // ATTACKER CONTROLLED
    await db.update(usersTable).set({ name }).where(eq(usersTable.id, userId))
  },
}

// CORRECT — always use locals.user from the validated session
export const actions = {
  update: async ({ request, locals }) => {
    if (!locals.user) redirect(302, '/login')
    await db.update(usersTable).set({ name }).where(eq(usersTable.id, locals.user.id))
  },
}
```

### Never check cookies directly in load/actions

```typescript
// WRONG — raw cookie is just a session ID, not user data
export const load = async ({ cookies }) => {
  const session = cookies.get('auth_session')
  if (session) return { authenticated: true } // NOT validated against DB!
}

// CORRECT — use locals which is populated and validated by hooks.server.ts
export const load = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login')
  return { user: locals.user }
}
```

### Never expose password hashes or internal fields in responses

```typescript
// WRONG — returns hashedPassword, createdAt, etc.
return { user: await db.select().from(usersTable).where(eq(usersTable.id, userId)) }

// CORRECT — select only needed columns
return {
  user: await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId)),
}
```

### Never use GET for auth mutations

```typescript
// WRONG — logout via GET can be triggered by prefetch, img tags, link previews
// src/routes/logout/+server.ts
export const GET = async () => { /* invalidate session */ }

// CORRECT — always POST via form action
// src/routes/(auth)/logout/+page.server.ts
export const actions = { default: async ({ locals, cookies }) => { /* invalidate */ } }
```

### Never skip Zod validation on auth inputs

```typescript
// WRONG — trusting raw form data
const email = formData.get('email') as string
const password = formData.get('password') as string

// CORRECT — validate shape, type, and constraints
const parsed = loginSchema.safeParse(Object.fromEntries(formData))
if (!parsed.success) return fail(400, { message: 'Invalid input' })
```

### Never hardcode secrets

```typescript
// WRONG
const github = new GitHub('abc123', 'secret456')

// CORRECT — use $env/static/private (build-time validated by SvelteKit)
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '$env/static/private'
const github = new GitHub(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
```

### Never use `$env/static/public` for secrets

```typescript
// WRONG — exposed to client bundle
import { PUBLIC_STRIPE_SECRET } from '$env/static/public'

// CORRECT — private env, server-only
import { STRIPE_SECRET_KEY } from '$env/static/private'
```

---

## Dependencies

```bash
# Core auth
npm i lucia @lucia-auth/adapter-drizzle

# Password hashing (native Argon2 — fast)
npm i @node-rs/argon2

# OAuth providers
npm i arctic

# Crypto utilities (for token hashing)
npm i @oslojs/crypto @oslojs/encoding
```

---

## File Map

```
src/
  lib/
    server/
      auth.ts           <- Lucia singleton + type augmentation
      oauth.ts          <- GitHub/Google Arctic instances
      tokens.ts         <- Password reset token create/validate
      email.ts          <- Resend client (send reset emails)
      db/
        index.ts        <- Drizzle client singleton
        schema.ts       <- users, sessions, oauth_accounts, password_reset_tokens
  routes/
    (auth)/
      login/
        +page.server.ts <- Sign in action
        +page.svelte    <- Login form
      signup/
        +page.server.ts <- Sign up action
        +page.svelte    <- Registration form
      logout/
        +page.server.ts <- Sign out action
      forgot-password/
        +page.server.ts <- Request reset email
        +page.svelte
      reset-password/
        [token]/
          +page.server.ts <- Reset with token
          +page.svelte
    auth/
      github/
        +server.ts      <- GitHub OAuth redirect
        callback/
          +server.ts    <- GitHub OAuth callback
      google/
        +server.ts      <- Google OAuth redirect
        callback/
          +server.ts    <- Google OAuth callback
    (app)/
      +layout.server.ts <- Auth guard for all app routes
      dashboard/
        +page.server.ts
        +page.svelte
  hooks.server.ts       <- Session validation middleware
  app.d.ts              <- App.Locals type augmentation
```
