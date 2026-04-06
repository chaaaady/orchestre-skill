# SKILL: Drizzle ORM — Patterns SvelteKit
> Module ID: `drizzle` | Domaine: Backend / BDD | Stack: SvelteKit + Drizzle ORM + PostgreSQL

## Install
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit @types/pg
```
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/mydb  # JAMAIS en PUBLIC_*
```

## Setup — Singleton DB client

```ts
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

> **Un seul fichier instancie le client.** Toujours importer depuis `$lib/server/db`. Jamais instancier `postgres()` ou `drizzle()` ailleurs.

## Drizzle config

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

## Schema Definition

```ts
// src/lib/server/db/schema.ts
import { pgTable, text, timestamp, uuid, integer, boolean, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// --- Tables ---

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'archived', 'draft'] }).default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('projects_user_id_idx').on(table.userId),
  index('projects_status_idx').on(table.status),
])

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  completed: boolean('completed').default(false).notNull(),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('tasks_project_id_idx').on(table.projectId),
])

// --- Many-to-many junction table ---

export const projectTags = pgTable('project_tags', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  index('project_tags_project_idx').on(table.projectId),
  index('project_tags_tag_idx').on(table.tagId),
])

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
})

// --- Relations (for query API) ---

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(tasks),
  projectTags: many(projectTags),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
}))

export const projectTagsRelations = relations(projectTags, ({ one }) => ({
  project: one(projects, { fields: [projectTags.projectId], references: [projects.id] }),
  tag: one(tags, { fields: [projectTags.tagId], references: [tags.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  projectTags: many(projectTags),
}))
```

## Result type

```ts
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

export function ok<T>(data: T): Result<T> {
  return { success: true, data }
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { success: false, error }
}
```

## Queries

### Select with where, orderBy, limit

```ts
// src/lib/server/queries/projects.ts
import { eq, desc, and, like, count, sql } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { projects, tasks } from '$lib/server/db/schema'
import { ok, err, AppError } from '$lib/server/errors'
import type { Result } from '$lib/server/errors'

export async function getProjectsByUser(userId: string): Promise<Result<typeof projects.$inferSelect[]>> {
  try {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt))

    return ok(rows)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to fetch projects'))
  }
}

export async function getProjectById(
  projectId: string,
  userId: string
): Promise<Result<typeof projects.$inferSelect | null>> {
  try {
    const [row] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1)

    return ok(row ?? null)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to fetch project'))
  }
}
```

### Joins

```ts
export async function getProjectWithTasks(
  projectId: string,
  userId: string
): Promise<Result<{ project: typeof projects.$inferSelect; tasks: (typeof tasks.$inferSelect)[] } | null>> {
  try {
    // Using the relational query API (requires relations defined in schema)
    const result = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      with: {
        tasks: {
          orderBy: [tasks.position],
        },
      },
    })

    if (!result) return ok(null)
    return ok({ project: result, tasks: result.tasks })
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to fetch project with tasks'))
  }
}
```

### Manual join (when you need fine control)

```ts
export async function getProjectsWithTaskCount(userId: string): Promise<Result<{ id: string; name: string; taskCount: number }[]>> {
  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        taskCount: count(tasks.id),
      })
      .from(projects)
      .leftJoin(tasks, eq(projects.id, tasks.projectId))
      .where(eq(projects.userId, userId))
      .groupBy(projects.id, projects.name)
      .orderBy(desc(projects.createdAt))

    return ok(rows)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to fetch projects with count'))
  }
}
```

### Search / partial match

```ts
export async function searchProjects(userId: string, query: string): Promise<Result<typeof projects.$inferSelect[]>> {
  try {
    const rows = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.userId, userId),
        like(projects.name, `%${query}%`)
      ))
      .orderBy(desc(projects.createdAt))
      .limit(20)

    return ok(rows)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to search projects'))
  }
}
```

## Mutations

### Insert with returning()

```ts
// src/lib/server/mutations/projects.ts
import { eq, and } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { projects } from '$lib/server/db/schema'
import { ok, err, AppError } from '$lib/server/errors'
import type { Result } from '$lib/server/errors'

type NewProject = typeof projects.$inferInsert

export async function createProject(data: NewProject): Promise<Result<typeof projects.$inferSelect>> {
  try {
    const [row] = await db
      .insert(projects)
      .values(data)
      .returning()

    return ok(row)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to create project'))
  }
}
```

### Update with returning()

```ts
export async function updateProject(
  projectId: string,
  userId: string,
  data: Partial<Pick<typeof projects.$inferInsert, 'name' | 'description' | 'status'>>
): Promise<Result<typeof projects.$inferSelect>> {
  try {
    const [row] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning()

    if (!row) return err(new AppError('NOT_FOUND', 'Project not found', 404))
    return ok(row)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to update project'))
  }
}
```

### Delete

```ts
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<Result<{ id: string }>> {
  try {
    const [row] = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning({ id: projects.id })

    if (!row) return err(new AppError('NOT_FOUND', 'Project not found', 404))
    return ok(row)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to delete project'))
  }
}
```

## Transactions

```ts
import { db } from '$lib/server/db'
import { projects, tasks } from '$lib/server/db/schema'
import { ok, err, AppError } from '$lib/server/errors'
import type { Result } from '$lib/server/errors'

export async function createProjectWithTasks(
  userId: string,
  projectData: { name: string; description?: string },
  taskTitles: string[]
): Promise<Result<{ projectId: string }>> {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Create project
      const [project] = await tx
        .insert(projects)
        .values({ ...projectData, userId })
        .returning({ id: projects.id })

      // 2. Create tasks in the same transaction
      if (taskTitles.length > 0) {
        await tx.insert(tasks).values(
          taskTitles.map((title, i) => ({
            projectId: project.id,
            title,
            position: i,
          }))
        )
      }

      return project
    })

    return ok({ projectId: result.id })
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to create project with tasks'))
  }
}
```

> **`db.transaction()`** est une vraie transaction PostgreSQL. Si une query echoue, tout est rollback automatiquement. Pas de rollback manuel comme avec Supabase JS.

## Relations — Relational Query API

Drizzle fournit une API relationnelle type-safe quand les `relations()` sont definies dans le schema.

### One-to-many

```ts
// Fetch user with all their projects
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    projects: {
      orderBy: [desc(projects.createdAt)],
      limit: 10,
    },
  },
})
// user.projects -> Project[]
```

### Nested relations

```ts
// Fetch project with tasks and user info
const project = await db.query.projects.findFirst({
  where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  with: {
    user: true,                 // one-to-one
    tasks: {                    // one-to-many
      orderBy: [tasks.position],
      where: eq(tasks.completed, false),
    },
  },
})
```

### Many-to-many (via junction table)

```ts
// Fetch project with its tags via junction table
const project = await db.query.projects.findFirst({
  where: eq(projects.id, projectId),
  with: {
    projectTags: {
      with: {
        tag: true,
      },
    },
  },
})

// Flatten tags: project.projectTags.map(pt => pt.tag)
```

### Column selection

```ts
// Only select specific columns
const projectNames = await db.query.projects.findMany({
  where: eq(projects.userId, userId),
  columns: {
    id: true,
    name: true,
    // other columns excluded from result
  },
})
```

## Migrations

### Generate migration from schema changes
```bash
npx drizzle-kit generate
```

### Apply migrations (production)
```ts
// src/lib/server/db/migrate.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from '$lib/server/db'

await migrate(db, { migrationsFolder: './drizzle' })
```

### Push schema directly (development only)
```bash
npx drizzle-kit push
```

### Inspect current DB
```bash
npx drizzle-kit studio
```

### Migration workflow
1. Modifier `schema.ts`
2. `npx drizzle-kit generate` — genere le SQL dans `./drizzle/`
3. Review le fichier SQL genere
4. `npx drizzle-kit push` (dev) ou `migrate()` au boot (prod)

> **Toujours review les migrations generees.** Drizzle-kit peut generer des `DROP COLUMN` si tu renommes un champ. Verifier avant d'appliquer.

## SvelteKit Integration

### Load function (+page.server.ts)

```ts
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types'
import { getProjectsByUser } from '$lib/server/queries/projects'
import { error, redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(303, '/login')

  const result = await getProjectsByUser(user.id)
  if (!result.success) {
    error(500, result.error.message)
  }

  return { projects: result.data }
}
```

### Form action (+page.server.ts)

```ts
// src/routes/dashboard/+page.server.ts
import type { Actions } from './$types'
import { createProject } from '$lib/server/mutations/projects'
import { fail, redirect } from '@sveltejs/kit'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const user = locals.user
    if (!user) return fail(401, { error: 'Unauthorized' })

    const formData = await request.formData()
    const parsed = createProjectSchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description'),
    })

    if (!parsed.success) {
      return fail(400, { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors })
    }

    const result = await createProject({ ...parsed.data, userId: user.id })
    if (!result.success) {
      return fail(500, { error: result.error.message })
    }

    redirect(303, `/projects/${result.data.id}`)
  },

  delete: async ({ request, locals }) => {
    const user = locals.user
    if (!user) return fail(401, { error: 'Unauthorized' })

    const formData = await request.formData()
    const projectId = formData.get('projectId')
    if (typeof projectId !== 'string') return fail(400, { error: 'Missing projectId' })

    const result = await deleteProject(projectId, user.id)
    if (!result.success) {
      return fail(result.error.status, { error: result.error.message })
    }

    return { deleted: true }
  },
}
```

### API route (+server.ts)

```ts
// src/routes/api/projects/+server.ts
import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { getProjectsByUser } from '$lib/server/queries/projects'

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user
  if (!user) error(401, 'Unauthorized')

  const result = await getProjectsByUser(user.id)
  if (!result.success) error(500, result.error.message)

  return json(result.data)
}
```

### Hooks (auth middleware)

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit'
import { getSession } from '$lib/server/auth'

export const handle: Handle = async ({ event, resolve }) => {
  const session = await getSession(event.cookies)
  event.locals.user = session?.user ?? null

  return resolve(event)
}
```

## Anti-patterns

### Never: raw SQL with user input
```ts
// ❌ SQL injection
const rows = await db.execute(sql`SELECT * FROM projects WHERE name = '${userInput}'`)

// ✅ Use parameterized queries
const rows = await db.execute(sql`SELECT * FROM projects WHERE name = ${userInput}`)
// Or better — use the query builder
const rows = await db.select().from(projects).where(eq(projects.name, userInput))
```

### Never: queries without userId filter
```ts
// ❌ Any user can access any project
export async function getProject(projectId: string) {
  return db.select().from(projects).where(eq(projects.id, projectId))
}

// ✅ Always scope to the authenticated user
export async function getProject(projectId: string, userId: string) {
  return db.select().from(projects).where(
    and(eq(projects.id, projectId), eq(projects.userId, userId))
  )
}
```

### Never: db client in routes or components
```ts
// ❌ Direct DB access in +page.server.ts
import { db } from '$lib/server/db'
import { projects } from '$lib/server/db/schema'

export const load = async () => {
  const rows = await db.select().from(projects) // business logic leaked into route
}

// ✅ Delegate to lib/ query functions
import { getProjectsByUser } from '$lib/server/queries/projects'

export const load = async ({ locals }) => {
  const result = await getProjectsByUser(locals.user.id)
}
```

### Never: throw in lib/ functions
```ts
// ❌ Throws bubble up unpredictably
export async function getProject(id: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id))
  if (!row) throw new Error('Not found') // ← never throw in lib/
  return row
}

// ✅ Return Result<T>
export async function getProject(id: string, userId: string): Promise<Result<typeof projects.$inferSelect | null>> {
  try {
    const [row] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1)
    return ok(row ?? null)
  } catch (e) {
    return err(new AppError('DB_ERROR', 'Failed to fetch project'))
  }
}
```

### Never: forget returning() on mutations
```ts
// ❌ No confirmation the row was actually created/updated
await db.insert(projects).values(data)

// ✅ Always use returning() to confirm and get the inserted row
const [row] = await db.insert(projects).values(data).returning()
```

### Never: instantiate db outside the singleton
```ts
// ❌ Multiple connections, no schema, no type safety
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)

// ✅ Import the singleton
import { db } from '$lib/server/db'
```

### Never: skip Zod validation on form/API inputs
```ts
// ❌ Trust user input directly
const name = formData.get('name') as string
await createProject({ name, userId: user.id })

// ✅ Validate with safeParse first
const parsed = schema.safeParse({ name: formData.get('name') })
if (!parsed.success) return fail(400, { error: 'Invalid input' })
await createProject({ ...parsed.data, userId: user.id })
```

## Gotchas
- **`returning()` returns an array** — toujours destructurer `const [row] = await db.insert(...).returning()`.
- **`findFirst()` vs `.limit(1)`** — `findFirst` est pour l'API relationnelle (`db.query`), `.limit(1)` pour le query builder (`db.select`).
- **Relations are NOT foreign keys** — `relations()` dans le schema sont pour l'API relationnelle de Drizzle, pas pour la DB. Les foreign keys se declarent avec `.references()` dans la definition de colonne.
- **`drizzle-kit generate` peut generer des DROP** — si tu renommes un champ, il voit "delete old + create new". Toujours review les fichiers SQL generes.
- **`postgres.js` est different de `pg`** — Ce sont deux drivers differents. `drizzle-orm/postgres-js` utilise `postgres` (le package), pas `pg`.
- **Les imports `$lib/server/`** ne sont accessibles que cote serveur dans SvelteKit. Jamais dans un fichier `+page.svelte` ou `+layout.svelte`.
