# SKILL: TanStack Query (React Query)
> Module ID: `data-tanstack` | Domaine: Data Fetching / Cache | Stack: Next.js App Router

## Install
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

## Exports clés
- `QueryClientProvider` — provider root (layout.tsx)
- `useQuery` — lecture avec cache auto
- `useMutation` — écriture + invalidation
- `useQueryClient` — accès au client pour invalidation manuelle
- `getQueryClient()` — singleton server-side pour prefetch
- `HydrationBoundary` + `dehydrate` — SSR hydration

## Pattern principal — Setup App Router
```tsx
// lib/query-client.ts
import { QueryClient } from "@tanstack/react-query"
import { cache } from "react"

export const getQueryClient = cache(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,       // 1 min
      gcTime: 5 * 60 * 1000,      // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
}))

// providers.tsx  ('use client')
"use client"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { getQueryClient } from "@/lib/query-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

// layout.tsx (Server Component)
export default function RootLayout({ children }) {
  return <html><body><Providers>{children}</Providers></body></html>
}
```

## Patterns secondaires

**useQuery — lecture standard :**
```tsx
'use client'
const { data, isLoading, isError, error } = useQuery({
  queryKey: ["projects", userId],
  queryFn: () => fetch(`/api/projects?userId=${userId}`).then(r => r.json()),
  enabled: !!userId,
})
if (isLoading) return <Skeleton />
if (isError) return <ErrorMessage error={error} />
```

**useMutation + invalidation :**
```tsx
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: (data: CreateProjectInput) =>
    fetch("/api/projects", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] })
    toast.success("Projet créé")
  },
  onError: (error) => toast.error(error.message),
})
mutation.mutate({ name: "Mon projet" })
```

**Prefetch SSR (Server Component → hydrate client) :**
```tsx
// page.tsx (Server Component)
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"

export default async function Page() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,  // fetch direct depuis le serveur
  })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectsList />  {/* Client Component avec useQuery */}
    </HydrationBoundary>
  )
}
```

## Gotchas
- **`cache()`** de React sur `getQueryClient()` — obligatoire pour avoir un singleton par requête serveur. Sans ça, chaque appel crée un nouveau client.
- **`staleTime`** : par défaut 0 (refetch immédiat). Mettre au moins 60s pour éviter les requêtes en cascade.
- **`queryKey` = tableau** : `["projects"]` invalide `["projects", id]`. Penser à la hiérarchie des clés.
- **`enabled: !!param`** : éviter les requêtes avec paramètres undefined.
- **Server Actions avec mutations** : utiliser `revalidatePath` côté serveur ET `invalidateQueries` côté client si on veut les deux (Server Action ne trigge pas l'invalidation React Query automatiquement).

## À NE PAS FAIRE
- Ne pas créer `new QueryClient()` dans un composant — singleton uniquement via `getQueryClient()`
- Ne pas mettre des objets complexes dans `queryKey` sans les memoïser (référence instable = refetch loop)
- Ne pas utiliser `useQuery` pour des mutations (write operations) — c'est `useMutation`
- Ne pas ignorer `isError` — toujours gérer les états d'erreur
