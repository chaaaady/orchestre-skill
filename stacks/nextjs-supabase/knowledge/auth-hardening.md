# SKILL: Auth Hardening — Supabase SSR
> Module ID: `security-auth` | Domaine: Sécurité / Auth | Stack: Next.js App Router + Supabase

## Install
```bash
npm install @supabase/ssr @supabase/supabase-js
```

## Exports clés
- `createServerClient` — Server Components, Server Actions, Route Handlers
- `createBrowserClient` — Client Components uniquement
- `getUser()` — vérifie le JWT côté serveur (network call)
- `getSession()` — NE PAS utiliser côté serveur (pas de vérification JWT)

## Pattern principal — 3 clients selon le contexte
```ts
// lib/supabase/server.ts  (Server Components, Actions)
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // Server Component — les cookies sont read-only dans certains contextes
        },
      },
    }
  )
}

// lib/supabase/client.ts  (Client Components)
import { createBrowserClient } from "@supabase/ssr"
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

## Pattern middleware — refresh token + redirect
```ts
// middleware.ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: refresh token automatique
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect si route protégée et non-auth
  if (!user && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Redirect si auth et route publique (login, register)
  if (user && ["/login", "/register"].includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
}
```

## Patterns secondaires

**Vérification auth dans Server Action :**
```ts
'use server'
import { createClient } from "@/lib/supabase/server"

export async function protectedAction() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Non autorisé")  // ou return { error }
  // ... logique
}
```

**Logout :**
```ts
'use server'
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
```

## Checklist sécurité auth
- [ ] Cookies httpOnly via `@supabase/ssr` ✓ (jamais localStorage)
- [ ] PKCE flow activé par défaut (ne PAS désactiver dans Supabase Dashboard)
- [ ] Email confirmation activée en production (Supabase Dashboard → Auth → Email)
- [ ] Password policy : min 8 chars, 1 uppercase, 1 number (Dashboard → Auth → Password)
- [ ] `getUser()` côté serveur (pas `getSession()`)
- [ ] Middleware avec session refresh sur toutes les routes protégées

## Gotchas
- **`getUser()` fait un appel réseau** côté serveur — mettre en cache si appelé plusieurs fois (`cache()` de React).
- **`getSession()`** ne vérifie pas la signature JWT côté serveur — peut retourner une session expirée ou falsifiée.
- **Cookies en Server Component** : les cookies sont read-only dans certains contextes (le `try/catch` dans `setAll` est intentionnel).
- **Middleware obligatoire** pour le refresh automatique — sans lui, les tokens expirés ne sont pas renouvelés.

## À NE PAS FAIRE
- Ne pas stocker le token dans localStorage
- Ne pas utiliser `getSession()` pour vérifier l'auth côté serveur
- Ne pas exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- Ne pas désactiver le PKCE flow
- Ne pas skip le middleware — il est responsable du refresh token
