# SKILL: SvelteKit Routing & Data Loading
> Module ID: `sveltekit-routing` | Domaine: Routing / SSR / Data | Stack: SvelteKit 2+ / Svelte 5

## Core Exports
- `+page.svelte` — Page component (UI)
- `+page.server.ts` — Server-side data loading + form actions
- `+page.ts` — Universal load (runs server + client)
- `+layout.svelte` — Layout wrapping child pages
- `+layout.server.ts` — Shared server-side data for layout tree
- `+server.ts` — API endpoint (GET/POST/PUT/DELETE)
- `+error.svelte` — Error boundary for route segment
- `hooks.server.ts` — Server hooks (handle, handleError, handleFetch)

---

## 1. File-Based Routing

### +page.svelte — Page Component
```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<h1>Dashboard</h1>
<ul>
  {#each data.projects as project}
    <li><a href="/projects/{project.id}">{project.name}</a></li>
  {/each}
</ul>
```

### +page.server.ts — Server Load + Actions
```ts
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad, Actions } from './$types'
import { getProjects } from '$lib/server/queries/projects'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) error(401, 'Unauthorized')

  const result = await getProjects(locals.user.id)
  if (!result.success) error(500, 'Failed to load projects')

  return { projects: result.data }
}
```

### +layout.svelte — Layout Component
```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import type { LayoutData } from './$types'
  import type { Snippet } from 'svelte'

  let { data, children }: { data: LayoutData; children: Snippet } = $props()
</script>

<nav>
  <span>{data.user.name}</span>
</nav>
<main>
  {@render children()}
</main>
```

### +layout.server.ts — Shared Layout Data
```ts
// src/routes/(app)/+layout.server.ts
import type { LayoutServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login')

  return { user: locals.user }
}
```

### +server.ts — API Endpoint
```ts
// src/routes/api/webhooks/stripe/+server.ts
import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { stripe } from '$lib/server/stripe'
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) error(400, 'Missing signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch {
    error(400, 'Invalid signature')
  }

  // Process event...
  return json({ received: true })
}
```

### +error.svelte — Error Boundary
```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores'
</script>

<h1>{$page.status}</h1>
<p>{$page.error?.message ?? 'Something went wrong'}</p>
<a href="/">Go home</a>
```

---

## 2. Route Parameters

### [slug] — Dynamic Segment
```
src/routes/projects/[id]/+page.server.ts
```
```ts
import type { PageServerLoad } from './$types'
import { getProject } from '$lib/server/queries/projects'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Unauthorized')

  const result = await getProject(params.id, locals.user.id)
  if (!result.success) error(404, 'Project not found')

  return { project: result.data }
}
```

### [...rest] — Catch-All
```
src/routes/docs/[...path]/+page.server.ts
```
```ts
// params.path = "getting-started/install" for /docs/getting-started/install
export const load: PageServerLoad = async ({ params }) => {
  const segments = params.path.split('/')
  const doc = await getDoc(segments)
  if (!doc.success) error(404, 'Page not found')
  return { doc: doc.data }
}
```

### [[optional]] — Optional Parameter
```
src/routes/blog/[[page]]/+page.server.ts
```
```ts
// Matches /blog AND /blog/2
export const load: PageServerLoad = async ({ params }) => {
  const page = params.page ? parseInt(params.page) : 1
  const posts = await getPosts({ page, limit: 10 })
  return { posts: posts.data, page }
}
```

### (group) — Route Groups (no URL segment)
```
src/routes/(app)/dashboard/+page.svelte    → /dashboard
src/routes/(app)/settings/+page.svelte     → /settings
src/routes/(auth)/login/+page.svelte       → /login
src/routes/(auth)/register/+page.svelte    → /register
src/routes/(marketing)/+page.svelte        → /
```
Route groups share layouts without affecting the URL. `(app)` can have an auth-required layout, `(auth)` a minimal layout, `(marketing)` a public layout.

---

## 3. Data Loading

### Basic Server Load
```ts
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types'
import { getDashboardStats, getRecentActivity } from '$lib/server/queries/dashboard'

export const load: PageServerLoad = async ({ locals }) => {
  const stats = await getDashboardStats(locals.user.id)
  const activity = await getRecentActivity(locals.user.id)

  return {
    stats: stats.data,
    activity: activity.data,
  }
}
```

### Parallel Loading (Promises)
```ts
// Both queries run in parallel — no waterfall
export const load: PageServerLoad = async ({ locals }) => {
  const [stats, activity] = await Promise.all([
    getDashboardStats(locals.user.id),
    getRecentActivity(locals.user.id),
  ])

  return {
    stats: stats.data,
    activity: activity.data,
  }
}
```

### Universal Load (+page.ts)
```ts
// src/routes/search/+page.ts
// Runs on server (SSR) AND client (navigation)
// Use ONLY when you need client-side re-fetching on navigation
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch }) => {
  const q = url.searchParams.get('q') ?? ''
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  return { results: await res.json(), query: q }
}
```
Prefer `+page.server.ts` over `+page.ts` — server load never ships code to the client.

---

## 4. Layout Data

### Shared Data via +layout.server.ts
```ts
// src/routes/(app)/+layout.server.ts
import type { LayoutServerLoad } from './$types'
import { getUserProfile } from '$lib/server/queries/users'
import { redirect } from '@sveltejs/kit'

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login')

  const profile = await getUserProfile(locals.user.id)
  return {
    user: locals.user,
    profile: profile.data,
  }
}
```

### Accessing Parent Data in Child Load
```ts
// src/routes/(app)/settings/+page.server.ts
import type { PageServerLoad } from './$types'
import { getSettings } from '$lib/server/queries/settings'

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent()  // data from layout.server.ts
  const settings = await getSettings(user.id)
  return { settings: settings.data }
}
```

### Accessing Layout Data in Components
```svelte
<!-- Any component inside (app) layout -->
<script lang="ts">
  import { page } from '$app/stores'
  // $page.data contains merged layout + page data
  // Or receive via props from +page.svelte
</script>
```

---

## 5. Form Actions

### Default Action
```ts
// src/routes/projects/new/+page.server.ts
import type { Actions, PageServerLoad } from './$types'
import { fail, redirect } from '@sveltejs/kit'
import { createProject } from '$lib/server/mutations/projects'
import { projectSchema } from '$lib/schemas/project'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login')
  return {}
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' })

    const formData = await request.formData()
    const raw = Object.fromEntries(formData.entries())

    const parsed = projectSchema.safeParse(raw)
    if (!parsed.success) {
      return fail(400, {
        error: 'Invalid input',
        fields: parsed.error.flatten().fieldErrors,
        values: raw,
      })
    }

    const result = await createProject(parsed.data, locals.user.id)
    if (!result.success) return fail(500, { error: 'Failed to create project' })

    redirect(303, `/projects/${result.data.id}`)
  },
}
```

### Named Actions
```ts
// src/routes/projects/[id]/+page.server.ts
import type { Actions } from './$types'
import { fail } from '@sveltejs/kit'
import { updateProject, deleteProject } from '$lib/server/mutations/projects'

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' })

    const formData = await request.formData()
    const name = formData.get('name') as string

    const result = await updateProject(params.id, { name }, locals.user.id)
    if (!result.success) return fail(400, { error: result.error.message })

    return { success: true }
  },

  delete: async ({ params, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' })

    const result = await deleteProject(params.id, locals.user.id)
    if (!result.success) return fail(400, { error: result.error.message })

    redirect(303, '/projects')
  },
}
```

### Form Component with Progressive Enhancement
```svelte
<!-- src/routes/projects/new/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let loading = $state(false)
</script>

<form
  method="POST"
  use:enhance={() => {
    loading = true
    return async ({ update }) => {
      loading = false
      await update()
    }
  }}
>
  <label>
    Name
    <input name="name" value={form?.values?.name ?? ''} required />
    {#if form?.fields?.name}
      <span class="text-destructive text-sm">{form.fields.name[0]}</span>
    {/if}
  </label>

  {#if form?.error}
    <p class="text-destructive">{form.error}</p>
  {/if}

  <button type="submit" disabled={loading}>
    {loading ? 'Creating...' : 'Create Project'}
  </button>
</form>
```

### Invoking Named Actions
```svelte
<!-- action="?/update" targets the named action -->
<form method="POST" action="?/update" use:enhance>
  <input name="name" value={data.project.name} />
  <button type="submit">Save</button>
</form>

<!-- Separate form for delete -->
<form method="POST" action="?/delete" use:enhance>
  <button type="submit" class="text-destructive">Delete</button>
</form>
```

---

## 6. API Endpoints (+server.ts)

Use **only** for webhooks and external integrations. Internal mutations use form actions.

### GET Endpoint
```ts
// src/routes/api/health/+server.ts
import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'

export const GET: RequestHandler = async () => {
  return json({ status: 'ok', timestamp: Date.now() })
}
```

### POST Endpoint (External Integration)
```ts
// src/routes/api/webhooks/stripe/+server.ts
import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { stripe } from '$lib/server/stripe'
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private'
import { handleStripeEvent } from '$lib/server/mutations/billing'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) error(400, 'Missing stripe-signature header')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch {
    error(400, 'Invalid webhook signature')
  }

  await handleStripeEvent(event)
  return json({ received: true })
}
```

### PUT / DELETE Endpoints
```ts
// src/routes/api/tokens/[id]/+server.ts
import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { revokeToken } from '$lib/server/mutations/tokens'

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401, 'Unauthorized')

  const result = await revokeToken(params.id, locals.user.id)
  if (!result.success) error(404, 'Token not found')

  return json({ deleted: true })
}
```

---

## 7. Error Handling

### +error.svelte — Route-Level Error Boundary
```svelte
<!-- src/routes/+error.svelte (root-level fallback) -->
<script lang="ts">
  import { page } from '$app/stores'
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="text-center">
    <h1 class="text-4xl font-bold">{$page.status}</h1>
    <p class="text-muted-foreground mt-2">{$page.error?.message}</p>
    <a href="/" class="text-primary mt-4 inline-block underline">Go home</a>
  </div>
</div>
```

### Expected Errors (error() helper)
```ts
// In load functions or actions — user-facing, safe to display
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
  const project = await getProject(params.id)
  if (!project.success) {
    error(404, 'Project not found')  // Sets $page.status = 404, $page.error.message = 'Project not found'
  }
  return { project: project.data }
}
```

### handleError Hook (Unexpected Errors)
```ts
// src/hooks.server.ts
import type { HandleServerError } from '@sveltejs/kit'

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const id = crypto.randomUUID()

  // Log full error server-side
  console.error(`[${id}]`, error)

  // Return safe message to client
  return {
    message: 'An unexpected error occurred',
    id,
  }
}
```
Never expose `error.message` or stack traces to the client in production. The `handleError` hook transforms unexpected errors into safe responses.

---

## 8. Redirects

### In Load Functions
```ts
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login')
  if (locals.user.role === 'admin') redirect(303, '/admin')
  // ...
}
```

### In Form Actions
```ts
export const actions: Actions = {
  default: async ({ request, locals }) => {
    // ... process form
    redirect(303, '/dashboard')  // Always 303 after POST
  },
}
```

### Client-Side (goto)
```svelte
<script lang="ts">
  import { goto } from '$app/navigation'

  function handleClick() {
    goto('/settings')
  }

  // With options
  function handleReplace() {
    goto('/dashboard', { replaceState: true })
  }
</script>
```

### Status Codes
| Code | When |
|------|------|
| `303` | After form action (POST -> GET) — **always use this for actions** |
| `307` | Temporary redirect preserving method |
| `308` | Permanent redirect preserving method |
| `301` | Permanent redirect (SEO, URL change) |
| `302` | Temporary redirect (legacy, prefer 303/307) |

---

## 9. Hooks

### hooks.server.ts — Complete Example
```ts
// src/hooks.server.ts
import type { Handle, HandleServerError, HandleFetch } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { validateSession } from '$lib/server/auth'

// Auth hook — populates event.locals.user
const authHook: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session')

  if (sessionId) {
    const result = await validateSession(sessionId)
    if (result.success) {
      event.locals.user = result.data.user
      event.locals.session = result.data.session
    } else {
      event.cookies.delete('session', { path: '/' })
    }
  }

  return resolve(event)
}

// Security headers hook
const securityHook: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

// Compose hooks in order
export const handle = sequence(authHook, securityHook)

// Unexpected error handler — never expose internals
export const handleError: HandleServerError = async ({ error, event }) => {
  const id = crypto.randomUUID()
  console.error(`[${id}]`, error)

  return {
    message: 'An unexpected error occurred',
    id,
  }
}

// Intercept server-side fetch calls
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // Forward cookies to same-origin API calls
  if (request.url.startsWith(event.url.origin)) {
    request.headers.set('cookie', event.request.headers.get('cookie') ?? '')
  }
  return fetch(request)
}
```

### Type-Safe Locals
```ts
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string; name: string } | null
      session: { id: string; expiresAt: Date } | null
    }
    interface Error {
      message: string
      id?: string
    }
    interface PageData {
      // Shared across all pages
    }
  }
}
export {}
```

---

## 10. Streaming

### Deferred Data with Promises
```ts
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  // Critical data — awaited before render
  const user = await getUser(locals.user.id)

  // Non-critical data — streamed after initial render
  const analytics = getAnalytics(locals.user.id)     // NOT awaited
  const notifications = getNotifications(locals.user.id)  // NOT awaited

  return {
    user: user.data,
    analytics,        // Promise<AnalyticsData>
    notifications,    // Promise<Notification[]>
  }
}
```

### Consuming Streamed Data
```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<!-- Renders immediately -->
<h1>Welcome, {data.user.name}</h1>

<!-- Streams in when ready -->
{#await data.analytics}
  <div class="animate-pulse h-32 bg-muted rounded" />
{:then analytics}
  <AnalyticsCard {analytics} />
{:catch}
  <p class="text-destructive">Failed to load analytics</p>
{/await}

{#await data.notifications}
  <p class="text-muted-foreground">Loading notifications...</p>
{:then notifications}
  <NotificationList {notifications} />
{:catch}
  <p class="text-destructive">Failed to load notifications</p>
{/await}
```

---

## 11. Anti-Patterns

### Fetching data in +page.svelte
```svelte
<!-- WRONG: data fetching in component -->
<script lang="ts">
  import { onMount } from 'svelte'
  let projects = $state([])

  onMount(async () => {
    const res = await fetch('/api/projects')  // NEVER do this
    projects = await res.json()
  })
</script>
```
**Fix:** Move to `+page.server.ts` `load()` function. Component receives data via props.

### Mutations via fetch() instead of form actions
```svelte
<!-- WRONG: API call for mutation -->
<script lang="ts">
  async function handleDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })  // NEVER for internal mutations
  }
</script>
```
**Fix:** Use form actions with `use:enhance`. API endpoints are for webhooks and external integrations only.

### Missing type on load function
```ts
// WRONG: untyped load
export async function load({ params }) {  // No type = no safety
  // ...
}
```
**Fix:** Always type with `PageServerLoad`, `LayoutServerLoad`, or `PageLoad`.
```ts
import type { PageServerLoad } from './$types'
export const load: PageServerLoad = async ({ params }) => { ... }
```

### Importing server modules in client code
```ts
// WRONG: importing $lib/server/ in +page.svelte or +page.ts
import { db } from '$lib/server/db'  // BREAKS — server module in client context
```
**Fix:** Server imports (`$lib/server/*`, `$env/static/private`) only in `+page.server.ts`, `+layout.server.ts`, `+server.ts`, and `hooks.server.ts`.

### Direct DB access in load functions
```ts
// WRONG: raw DB query in route file
export const load: PageServerLoad = async ({ locals }) => {
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.userId, locals.user.id))
  return { projects }
}
```
**Fix:** Delegate to `$lib/server/queries/`. Route files call business logic functions, never touch the DB directly.
```ts
export const load: PageServerLoad = async ({ locals }) => {
  const result = await getProjects(locals.user.id)  // $lib/server/queries/projects.ts
  if (!result.success) error(500, 'Failed to load')
  return { projects: result.data }
}
```

### Waterfall loading
```ts
// WRONG: sequential queries when parallel is possible
export const load: PageServerLoad = async ({ locals }) => {
  const stats = await getDashboardStats(locals.user.id)    // waits...
  const activity = await getRecentActivity(locals.user.id)  // then waits again
  return { stats, activity }
}
```
**Fix:** Use `Promise.all()` for independent queries.
```ts
const [stats, activity] = await Promise.all([
  getDashboardStats(locals.user.id),
  getRecentActivity(locals.user.id),
])
```

### Forgetting use:enhance on forms
```svelte
<!-- WRONG: full page reload on submit -->
<form method="POST" action="?/update">
  <button type="submit">Save</button>
</form>
```
**Fix:** Add `use:enhance` for SPA-like behavior (no full reload, preserves client state).
```svelte
<form method="POST" action="?/update" use:enhance>
```

### Using redirect() inside try/catch
```ts
// WRONG: redirect throws and gets caught
export const actions: Actions = {
  default: async ({ request }) => {
    try {
      // ... process
      redirect(303, '/dashboard')  // This THROWS — caught by catch block
    } catch (e) {
      return fail(500, { error: 'Something went wrong' })  // Swallows the redirect
    }
  },
}
```
**Fix:** Call `redirect()` outside of try/catch blocks, or re-throw redirect errors.
```ts
export const actions: Actions = {
  default: async ({ request }) => {
    let projectId: string
    try {
      const result = await createProject(data)
      if (!result.success) return fail(400, { error: result.error.message })
      projectId = result.data.id
    } catch {
      return fail(500, { error: 'Something went wrong' })
    }
    redirect(303, `/projects/${projectId}`)
  },
}
```

## Gotchas
- **`redirect()` and `error()` throw internally** — do not wrap them in try/catch
- **Form actions return `ActionData`** — access via `form` prop in Svelte 5 (`let { form } = $props()`)
- **Layout data is inherited** — child pages automatically get parent layout data merged into `data`
- **`+page.ts` runs on client too** — never import `$lib/server/*` or `$env/static/private` there
- **Cookies in `handle` hook** — set/delete cookies before `resolve(event)`, read anytime
- **`invalidateAll()`** re-runs all load functions on current page — use after client-side state changes that affect server data
- **Route groups `(name)` don't nest** — `(app)/(admin)/` is flat, both are at root level
