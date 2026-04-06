# SKILL: Sentry — Monitoring & Error Tracking
> Module ID: `monitoring-sentry` | Domaine: Monitoring | Stack: Next.js App Router

## Install
```bash
npx @sentry/wizard@latest -i nextjs
# Le wizard crée automatiquement :
# sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
# Modifie next.config.ts avec withSentryConfig()
```
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=mon-org
SENTRY_PROJECT=mon-projet
SENTRY_AUTH_TOKEN=sntrys_...  # Pour les source maps
```

## Exports clés
- `Sentry.captureException(error)` — capturer une exception manuellement
- `Sentry.captureMessage(msg, level)` — capturer un message (warning, info...)
- `Sentry.setUser({ id, email })` — associer les erreurs à un utilisateur
- `Sentry.addBreadcrumb()` — ajouter du contexte avant une erreur
- `withSentryConfig()` — wrapper next.config (auto-généré par wizard)

## Pattern principal — Setup après wizard
```ts
// sentry.client.config.ts (auto-généré, à ajuster)
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay (optionnel, privacy-sensitive)
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 0.5,

  // Filtrer les erreurs non-actionnables
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    /^Network Error/,
  ],

  beforeSend(event) {
    // Ne jamais envoyer en dev
    if (process.env.NODE_ENV === "development") return null
    return event
  },
})

// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs"
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
})
```

## Patterns secondaires

**Capture manuelle dans les catch critiques :**
```ts
// app/actions/billing.ts
import * as Sentry from "@sentry/nextjs"

export async function createCheckoutSession(priceId: string) {
  try {
    // ... logique Stripe
  } catch (error) {
    Sentry.captureException(error, {
      tags: { action: "createCheckoutSession" },
      extra: { priceId },
    })
    return { error: "Erreur lors de la création du paiement" }
  }
}
```

**Associer un utilisateur (après login) :**
```ts
// Dans le layout ou un composant auth
'use client'
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export function SentryUserProvider({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (userId) {
      Sentry.setUser({ id: userId })  // Pas d'email — respect vie privée
    } else {
      Sentry.setUser(null)
    }
  }, [userId])
  return null
}
```

**Breadcrumbs pour contextualiser :**
```ts
Sentry.addBreadcrumb({
  message: "Utilisateur a cliqué sur Checkout",
  category: "ui.click",
  level: "info",
  data: { priceId },
})
// ... action qui peut échouer ensuite
```

**Source maps (next.config.ts) :**
```ts
// withSentryConfig auto-généré par le wizard — laisser les options par défaut
const sentryWebpackOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,                    // Pas de logs Sentry pendant le build
  hideSourceMaps: true,            // Source maps non exposés publiquement
  disableLogger: true,
}
```

## Ce qui est capturé automatiquement
- Erreurs non-catchées (client + serveur)
- Erreurs dans les error boundaries (`error.tsx`)
- Performance : LCP, FID, CLS, TTFB
- Web Vitals
- Erreurs de Route Handlers et Server Actions (si non-catchées)

## Gotchas
- **Ne pas logger de PII** (Personally Identifiable Information) — pas d'emails, noms, mots de passe dans les events Sentry.
- **`tracesSampleRate: 1.0` en dev seulement** — en prod, 0.05-0.1 max pour limiter les coûts.
- **Source maps** : activer `hideSourceMaps: true` pour ne pas exposer le source code aux clients.
- **`beforeSend` filter** : bloquer les erreurs de dev pour garder Sentry propre.
- **Session Replay** : requiert un consentement RGPD — désactiver si pas de banner cookie.

## À NE PAS FAIRE
- Ne pas logger `user.email` dans Sentry — utiliser uniquement `user.id`
- Ne pas mettre `tracesSampleRate: 1.0` en production (coûts élevés)
- Ne pas exposer le SENTRY_AUTH_TOKEN côté client (variables non-publiques)
- Ne pas installer Sentry manuellement (sans wizard) — la config Next.js est complexe
- Ne pas ignorer les alertes Sentry — traiter les erreurs récurrentes dans la semaine
