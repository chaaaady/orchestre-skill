# SKILL: Supabase — Patterns App Router
> Module ID: `supabase` | Domaine: Backend / BDD | Stack: Next.js App Router + Supabase

## Install
```bash
npm install @supabase/ssr @supabase/supabase-js
```
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # JAMAIS côté client
```

## Les 3 clients — quand utiliser lequel
| Client | Contexte | RLS |
|--------|----------|-----|
| `createServerClient` (anon) | Server Components, Server Actions, Route Handlers | Respectée |
| `createBrowserClient` (anon) | Client Components | Respectée |
| `createServiceRoleClient` | Server uniquement, admin ops | Bypass RLS ⚠️ |

```ts
// lib/supabase/admin.ts  — À utiliser avec extrême parcimonie
import { createClient } from "@supabase/ssr"
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

## Pattern principal — Server Component avec cache
```tsx
// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { unstable_cache } from "next/cache"

// Cache avec tag pour revalidation ciblée
const getProjects = unstable_cache(
  async (userId: string) => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data
  },
  ["projects"],
  { tags: ["projects"], revalidate: 60 }
)

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const projects = await getProjects(user.id)
  return <ProjectsList projects={projects} />
}
```

## Patterns secondaires

**Server Action avec revalidation :**
```ts
'use server'
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function createProject(data: CreateProjectInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const { error } = await supabase
    .from("projects")
    .insert({ ...data, user_id: user.id })

  if (error) return { error: error.message }

  revalidateTag("projects")  // invalide le cache Server Component
  return { success: true }
}
```

**Select avec jointure (relations) :**
```ts
// Supabase supporte les jointures via la syntaxe select
const { data } = await supabase
  .from("projects")
  .select(`
    id, name, status,
    owner:profiles!user_id(full_name, avatar_url),
    tasks(id, title, completed)
  `)
  .eq("id", projectId)
  .single()
```

**Transaction manuelle (pas de vraie transaction en JS) :**
```ts
// Supabase JS ne supporte pas les transactions — utiliser une Edge Function ou RPC
const { error: e1 } = await supabase.from("orders").insert(order)
if (e1) return { error: e1.message }
const { error: e2 } = await supabase.from("inventory").update({ qty: qty - 1 }).eq("id", productId)
if (e2) {
  // Rollback manuel
  await supabase.from("orders").delete().eq("id", order.id)
  return { error: e2.message }
}
// Pour des vraies transactions : supabase.rpc('my_transaction_function')
```

**Edge Function pour webhooks :**
```ts
// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
serve(async (req) => {
  const body = await req.text()
  // Traiter le webhook...
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
```

## Gotchas
- **`supabase.auth.getUser()`** fait un appel réseau côté serveur. Si appelé plusieurs fois dans la même requête, utiliser `cache()` de React.
- **`unstable_cache`** nécessite des paramètres sérialisables. Pas d'objets complexes dans la clé.
- **Pas de vraies transactions en Supabase JS** — utiliser `supabase.rpc()` pour appeler une fonction PostgreSQL transactionnelle.
- **`.single()`** throw si 0 ou 2+ rows — utiliser `.maybeSingle()` si le résultat peut être null.

## À NE PAS FAIRE
- Ne jamais exposer `service_role` côté client ou dans des variables `NEXT_PUBLIC_*`
- Ne pas appeler `createClient()` en dehors des fonctions (côté module) — les cookies ne sont pas disponibles
- Ne pas ignorer les erreurs Supabase — toujours destructurer `{ data, error }` et gérer `error`
- Ne pas utiliser `.single()` sans être sûr que la row existe
