# SKILL: Stripe Billing
> Module ID: `billing-stripe` | Domaine: Paiements | Stack: Next.js App Router + Stripe
> version: 1.0 | last_updated: 2026-03-14 | compatible_with: stripe@17.x

## ⚡ SINGLETON OBLIGATOIRE
Le singleton `lib/stripe.ts` doit être créé dans l'INIT et importé partout :

```ts
// lib/stripe.ts  ← créer CE fichier dans l'INIT
import Stripe from "stripe"
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20",
  typescript: true,
})
```

Dans chaque fichier utilisant Stripe :
```ts
import { stripe } from "@/lib/stripe"  // ← importer le singleton
// PAS: const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {...})
```

## Install
```bash
npm install stripe @stripe/stripe-js
```
```bash
STRIPE_SECRET_KEY=sk_live_...        # Jamais exposé côté client
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Exports clés
- `stripe` (server) — instance Stripe initialisée avec secret key
- `loadStripe` (client) — pour Stripe Elements uniquement
- `stripe.checkout.sessions.create()` — créer une session de paiement
- `stripe.webhooks.constructEvent()` — vérifier la signature du webhook
- `stripe.billingPortal.sessions.create()` — portail client

## Pattern principal — Checkout Session
```ts
// lib/stripe.ts  (server only)
import Stripe from "stripe"
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20",
  typescript: true,
})

// app/actions/billing.ts
'use server'
import { stripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function createCheckoutSession(priceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  const session = await stripe.checkout.sessions.create({
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: !profile?.stripe_customer_id ? user.email : undefined,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId: user.id },
    allow_promotion_codes: true,
  })

  redirect(session.url!)
}
```

## Patterns secondaires

**Webhook handler — Route Handler :**
```ts
// app/api/webhooks/stripe/route.ts
import { stripe } from "@/lib/stripe"
import { headers } from "next/headers"

export async function POST(req: Request) {
  const body = await req.text()  // raw body obligatoire
  const signature = (await headers()).get("stripe-signature")!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return new Response(`Webhook signature invalide`, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      // Activer l'abonnement en DB
      await handleCheckoutCompleted(session)
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionCanceled(sub)
      break
    }
    case "invoice.payment_failed": {
      // Notifier l'utilisateur
      break
    }
  }

  return new Response("ok", { status: 200 })
}
```

**Portail client (gérer abonnement) :**
```ts
export async function createPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) return { error: "Pas d'abonnement actif" }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  })

  redirect(portalSession.url)
}
```

**Stripe Elements (client-side only) :**
```tsx
'use client'
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
// Utiliser Elements seulement pour les paiements embedded (pas le checkout redirect)
```

## Gotchas
- **Webhook : body brut obligatoire** — ne pas utiliser `req.json()`, utiliser `req.text()`. La vérification de signature échoue sinon.
- **`config.api.bodyParser = false`** en pages router — en App Router, `req.text()` suffit.
- **Toujours vérifier la signature** du webhook — ne jamais traiter un event sans `constructEvent()`.
- **`stripe_customer_id` en DB** — stocker l'ID Stripe en BDD pour éviter de créer des doublons clients.
- **Mode test vs prod** — `sk_test_*` pour dev, `sk_live_*` pour prod. Les webhooks ont des secrets différents.

## À NE PAS FAIRE
- Ne pas exposer `STRIPE_SECRET_KEY` côté client (pas de `NEXT_PUBLIC_`)
- Ne pas traiter un webhook sans vérifier la signature
- Ne pas créer un nouveau customer Stripe à chaque checkout (chercher d'abord en DB)
- Ne pas utiliser `stripe.js` côté serveur pour les redirections — uniquement pour Elements
- Ne pas ignorer `invoice.payment_failed` — l'utilisateur doit être notifié
