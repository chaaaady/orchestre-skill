---
skill: frontend-patterns
version: "1.0"
applies_to: [nextjs, react]
inject_when: [always]
---

# Frontend Patterns — Règles React / Next.js App Router

## 1. Server vs Client Components

### Règle de base
Tout composant est Server Component par défaut. N'ajouter `'use client'` QUE si nécessaire.

### Server Component — quand l'utiliser
- Fetching de données (async/await direct)
- Accès aux variables d'environnement serveur
- Pas d'interactivité (pas de useState, pas d'events)
- Pages et layouts

```tsx
// ✅ Server Component — page.tsx
export default async function InvoicePage({ params }: { params: { id: string } }) {
  const result = await getInvoiceById(params.id)
  if (!result.success) notFound()
  return <InvoiceDetail invoice={result.data} />
}
```

### Client Component — quand l'utiliser
- useState, useEffect, useRef
- Event handlers (onClick, onChange, onSubmit)
- Browser APIs (localStorage, window)
- Hooks tiers (react-hook-form, etc.)

```tsx
// ✅ Client Component — composant interactif uniquement
'use client'
export function InvoiceCard({ invoice, onAction }: Props) {
  const [pending, startTransition] = useTransition()
  // ...
}
```

### Anti-pattern
```tsx
// ❌ Ne jamais mettre 'use client' sur une page qui fait du data fetching
'use client'
export default function Page() {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('/api/data').then(...) }, []) // N+1 pattern
}
```

---

## 2. Server Actions

### Règle
Toutes les Server Actions dans `actions/` uniquement. Jamais dans app/ ou components/.

```ts
// ✅ actions/invoices.ts
'use server'
import { revalidatePath } from 'next/cache'
import { markInvoicePaid } from '@/lib/mutations/invoices'

export async function markPaidAction(invoiceId: string): Promise<Result<true>> {
  const user = await getCurrentUser()
  if (!user.success) return err({ code: 'UNAUTHORIZED' })
  
  const result = await markInvoicePaid(invoiceId, user.data.id)
  if (result.success) revalidatePath('/dashboard')
  return result
}
```

### useActionState pour les formulaires
```tsx
'use client'
import { useActionState } from 'react'

export function LoginForm() {
  const [state, action, isPending] = useActionState(sendMagicLink, null)
  return (
    <form action={action}>
      <input name="email" type="email" disabled={isPending} />
      <button disabled={isPending}>{isPending ? 'Envoi...' : 'Connexion'}</button>
      {state?.error && <p className="text-destructive">{state.error}</p>}
    </form>
  )
}
```

### useTransition pour les actions inline
```tsx
'use client'
export function InvoiceCard({ invoice }: Props) {
  const [isPending, startTransition] = useTransition()
  
  function handleMarkPaid() {
    startTransition(async () => {
      await markPaidAction(invoice.id)
    })
  }
  
  return <button onClick={handleMarkPaid} disabled={isPending}>Marquer payé</button>
}
```

---

## 3. Data Fetching patterns

### Parallel fetching avec Promise.all
```tsx
// ✅ Parallel — page detail
export default async function InvoicePage({ params }) {
  const [invoiceResult, eventsResult, remindersResult] = await Promise.all([
    getInvoiceById(params.id),
    getReminderEvents(params.id),
    getScheduledReminders(params.id),
  ])
  // ...
}
```

### Anti-pattern — waterfall
```tsx
// ❌ Sequential — 3x plus lent
const invoice = await getInvoiceById(params.id)
const events = await getReminderEvents(params.id)
const reminders = await getScheduledReminders(params.id)
```

### Pagination
```tsx
// ✅ Paramètre page dans searchParams
export default async function DashboardPage({ searchParams }) {
  const page = Number(searchParams.page) || 1
  const result = await getInvoicesByUser(userId, { page, limit: 20 })
}
```

---

## 4. Suspense et Loading

### loading.tsx — skeleton global
```tsx
// app/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
```

### Suspense granulaire pour les sections lentes
```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<InvoiceListSkeleton />}>
        <InvoiceList />
      </Suspense>
    </div>
  )
}
```

---

## 5. Error handling UI

### not-found.tsx
```tsx
// app/not-found.tsx
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold text-foreground">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n'existe pas.</p>
      <a href="/dashboard" className="text-primary hover:underline">Retour au dashboard</a>
    </div>
  )
}
```

### global-error.tsx — NE PAS exposer error.digest en prod
```tsx
// app/global-error.tsx
'use client'
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
          {/* ❌ NE PAS : <p>{error.digest}</p> */}
          <button onClick={reset} className="bg-primary text-primary-foreground px-4 py-2 rounded">
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
```

---

## 6. Règles absolues

- Jamais de `fetch()` dans un composant Client — passer les données en props depuis un Server Component
- Jamais de `useEffect` pour fetcher des données — utiliser Server Components
- Jamais de logique métier dans un composant — déléguer à `lib/`
- Toujours `revalidatePath()` après une mutation dans une Server Action
- Toujours `notFound()` si une ressource n'existe pas (pas de return null silencieux)

## Wave 4
Les violations de ces patterns génèrent des issues IMPORTANTES dans l'audit :
- `fetch()` dans Client Component → `client_side_fetch`
- `useEffect` pour data → `useeffect_fetch`
- Logique métier dans composant → vérifiée par R1/R2
