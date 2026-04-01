# SKILL: Error Handling
> Module ID: `error-handling` | Domaine: Backend / Resilience | Stack: Next.js App Router

## Install
```bash
# Pas de dépendance — patterns natifs TypeScript + Next.js
# Optionnel: npm install @sentry/nextjs (voir sentry.md)
```

## Exports clés
- `AppError` — classe d'erreur custom avec code + statusCode
- `Result<T>` — type union success/failure (pas de throw)
- `error.tsx` — error boundary par route segment
- `global-error.tsx` — error boundary root (layout errors)
- `notFound()` — déclenche la page 404

## Pattern principal — AppError + Result type
```ts
// lib/errors.ts
export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DB_ERROR"
  | "EXTERNAL_SERVICE"
  | "UNKNOWN"

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = "AppError"
  }

  static unauthorized(msg = "Non autorisé") {
    return new AppError("UNAUTHORIZED", msg, 401)
  }
  static forbidden(msg = "Accès refusé") {
    return new AppError("FORBIDDEN", msg, 403)
  }
  static notFound(resource: string) {
    return new AppError("NOT_FOUND", `${resource} introuvable`, 404)
  }
  static validation(msg: string) {
    return new AppError("VALIDATION_ERROR", msg, 422)
  }
  static db(cause: unknown) {
    console.error("[DB]", cause)
    return new AppError("DB_ERROR", "Erreur base de données", 500, cause)
  }
}

// lib/types.ts
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E }

export function ok<T>(data: T): Result<T> {
  return { success: true, data }
}
export function err<E extends AppError = AppError>(error: E): Result<never, E> {
  return { success: false, error }
}
```

## Patterns secondaires

**Fonction async avec Result (pas de throw) :**
```ts
import { ok, err, AppError } from "@/lib"

async function getProject(id: string): Promise<Result<Project>> {
  const { data, error } = await supabase.from("projects").select().eq("id", id).single()
  if (error) return err(AppError.notFound("Projet"))
  return ok(data)
}

// Usage
const result = await getProject(id)
if (!result.success) {
  if (result.error.code === "NOT_FOUND") notFound()
  return { error: result.error.message }
}
const project = result.data  // typé correctement
```

**error.tsx — boundary par segment de route :**
```tsx
// app/dashboard/error.tsx
'use client'
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    // Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  )
}
```

**global-error.tsx — erreur root layout :**
```tsx
// app/global-error.tsx
'use client'
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html><body>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1>Erreur critique</h1>
        <Button onClick={reset}>Recharger</Button>
      </div>
    </body></html>
  )
}
```

**Logging conditionnel :**
```ts
// lib/logger.ts
export const logger = {
  error: (msg: string, cause?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${msg}`, cause)
    } else {
      // Sentry.captureException(cause, { extra: { msg } })
    }
  },
}
```

## Gotchas
- **`error.tsx` doit être `'use client'`** — les error boundaries Next.js sont des Client Components.
- **`global-error.tsx` replace le layout** — doit inclure `<html>` et `<body>`.
- **Ne jamais exposer les stack traces au client** — logger côté serveur, message générique au client.
- **`throw` vs `return err()`** : throw seulement pour déclencher un error boundary. Dans les Server Actions, retourner un Result.

## À NE PAS FAIRE
- Ne pas throw depuis une Server Action (non-catchable par le client)
- Ne pas afficher `error.stack` ou `error.cause` à l'utilisateur
- Ne pas créer 15 classes d'erreur différentes — les codes enum suffisent
- Ne pas ignorer les erreurs DB sans logger (`console.error` minimum en dev)
- Ne pas oublier `error.tsx` dans les segments de route critiques
