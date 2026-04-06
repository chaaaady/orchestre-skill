# SKILL: Stripe Billing (SvelteKit + Drizzle)
> Module ID: `billing-stripe-sveltekit` | Domaine: Paiements | Stack: SvelteKit + Drizzle ORM
> version: 1.0 | last_updated: 2026-04-03 | compatible_with: stripe@17.x, @sveltejs/kit@2.x

## SINGLETON OBLIGATOIRE
Le singleton `src/lib/server/stripe.ts` doit etre cree dans l'INIT et importe partout :

```ts
// src/lib/server/stripe.ts  <- creer CE fichier dans l'INIT
import Stripe from "stripe"
import { STRIPE_SECRET_KEY } from "$env/static/private"

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20",
  typescript: true,
})
```

Dans chaque fichier serveur utilisant Stripe :
```ts
import { stripe } from "$lib/server/stripe"  // <- importer le singleton
// PAS: const stripe = new Stripe(STRIPE_SECRET_KEY, {...})
```

## Install
```bash
npm install stripe @stripe/stripe-js
```

## Environment Variables
```bash
# .env — NEVER commit this file
STRIPE_SECRET_KEY=sk_test_...           # Server only — NEVER expose client-side
STRIPE_WEBHOOK_SECRET=whsec_...         # Server only
PUBLIC_STRIPE_KEY=pk_test_...           # Safe for client — publishable key
```

Access pattern in SvelteKit:
```ts
// Server-side (form actions, +server.ts, hooks)
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from "$env/static/private"

// Client-side (Stripe Elements, loadStripe)
import { PUBLIC_STRIPE_KEY } from "$env/static/public"
```

## Exports cles
- `stripe` (server) — instance Stripe initialisee avec secret key
- `loadStripe` (client) — pour Stripe Elements uniquement
- `stripe.checkout.sessions.create()` — creer une session de paiement
- `stripe.webhooks.constructEvent()` — verifier la signature du webhook
- `stripe.billingPortal.sessions.create()` — portail client

---

## 1. Drizzle Schema — Billing Tables

```ts
// src/lib/server/db/schema/billing.ts
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"
import { users } from "./users"

export const customers = pgTable("customers", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(), // Stripe subscription ID
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  status: text("status").notNull(), // active, canceled, past_due, trialing, etc.
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
```

---

## 2. Customer Management

```ts
// src/lib/server/billing/customers.ts
import { stripe } from "$lib/server/stripe"
import { db } from "$lib/server/db"
import { customers } from "$lib/server/db/schema/billing"
import { eq } from "drizzle-orm"
import type { Result } from "$lib/server/errors"

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<Result<string>> {
  // Check DB first — avoid duplicate customers
  const existing = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1)

  if (existing.length > 0) {
    return { success: true, data: existing[0].stripeCustomerId }
  }

  // Create in Stripe
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  // Store mapping in DB
  await db.insert(customers).values({
    userId,
    stripeCustomerId: customer.id,
  })

  return { success: true, data: customer.id }
}

export async function getStripeCustomerId(
  userId: string
): Promise<Result<string | null>> {
  const rows = await db
    .select({ stripeCustomerId: customers.stripeCustomerId })
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1)

  return { success: true, data: rows[0]?.stripeCustomerId ?? null }
}
```

---

## 3. Checkout Session — Form Action

```ts
// src/routes/pricing/+page.server.ts
import type { Actions } from "./$types"
import { redirect, fail } from "@sveltejs/kit"
import { stripe } from "$lib/server/stripe"
import { getOrCreateStripeCustomer } from "$lib/server/billing/customers"

export const actions = {
  checkout: async ({ request, locals, url }) => {
    // See sveltekit-auth.md for auth setup (Lucia pattern)
    const user = locals.user
    if (!user) return fail(401, { error: "Unauthorized" })

    const formData = await request.formData()
    const priceId = formData.get("priceId") as string
    if (!priceId) return fail(400, { error: "Missing priceId" })

    const customerResult = await getOrCreateStripeCustomer(
      user.id,
      user.email!
    )
    if (!customerResult.success) return fail(500, { error: "Failed to create customer" })

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerResult.data,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${url.origin}/dashboard?success=true`,
      cancel_url: `${url.origin}/pricing`,
      metadata: { userId: user.id },
      allow_promotion_codes: true,
    })

    redirect(303, checkoutSession.url!)
  },
} satisfies Actions
```

Svelte form component:
```svelte
<!-- src/routes/pricing/+page.svelte -->
<script lang="ts">
  import { enhance } from "$app/forms"

  const plans = [
    { name: "Pro", priceId: "price_xxx", amount: "$19/mo" },
    { name: "Team", priceId: "price_yyy", amount: "$49/mo" },
  ]
</script>

{#each plans as plan}
  <form method="POST" action="?/checkout" use:enhance>
    <input type="hidden" name="priceId" value={plan.priceId} />
    <h3>{plan.name}</h3>
    <p>{plan.amount}</p>
    <button type="submit">Subscribe</button>
  </form>
{/each}
```

---

## 4. Webhook Handler

```ts
// src/routes/api/webhooks/stripe/+server.ts
import type { RequestHandler } from "./$types"
import { json, error } from "@sveltejs/kit"
import { stripe } from "$lib/server/stripe"
import { STRIPE_WEBHOOK_SECRET } from "$env/static/private"
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
} from "$lib/server/billing/webhook-handlers"
import type Stripe from "stripe"

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text() // Raw body — mandatory for signature verification
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    error(400, "Missing stripe-signature header")
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error("Webhook signature verification failed")
    error(400, "Invalid signature")
  }

  // Route events — return 200 immediately, process inline
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      break
  }

  return json({ received: true })
}
```

---

## 5. Event Handlers

```ts
// src/lib/server/billing/webhook-handlers.ts
import type Stripe from "stripe"
import { db } from "$lib/server/db"
import { customers, subscriptions } from "$lib/server/db/schema/billing"
import { eq } from "drizzle-orm"

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId
  if (!userId) return

  // Ensure customer mapping exists
  if (session.customer && typeof session.customer === "string") {
    await db
      .insert(customers)
      .values({ userId, stripeCustomerId: session.customer })
      .onConflictDoNothing()
  }

  // Retrieve full subscription from Stripe
  if (session.subscription && typeof session.subscription === "string") {
    const sub = await (await import("$lib/server/stripe")).stripe.subscriptions.retrieve(
      session.subscription
    )

    await db
      .insert(subscriptions)
      .values({
        id: sub.id,
        userId,
        stripeCustomerId: sub.customer as string,
        stripePriceId: sub.items.data[0].price.id,
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      })
      .onConflictDoUpdate({
        target: subscriptions.id,
        set: {
          status: sub.status,
          stripePriceId: sub.items.data[0].price.id,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          updatedAt: new Date(),
        },
      })
  }
}

export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: sub.status,
      stripePriceId: sub.items.data[0].price.id,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id))
}

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id))
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id

  if (!subId) return

  await db
    .update(subscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subId))

  // TODO: Send notification email to user via your email service
}
```

---

## 6. Subscription Lifecycle

```ts
// src/lib/server/billing/subscriptions.ts
import { stripe } from "$lib/server/stripe"
import { db } from "$lib/server/db"
import { subscriptions } from "$lib/server/db/schema/billing"
import { eq, and } from "drizzle-orm"
import type { Result } from "$lib/server/errors"

/** Get active subscription for a user */
export async function getUserSubscription(
  userId: string
): Promise<Result<typeof subscriptions.$inferSelect | null>> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    )
    .limit(1)

  return { success: true, data: rows[0] ?? null }
}

/** Cancel subscription at period end (graceful) */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Result<Stripe.Subscription>> {
  const sub = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))

  return { success: true, data: sub }
}

/** Reactivate a subscription that was set to cancel at period end */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Result<Stripe.Subscription>> {
  const sub = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))

  return { success: true, data: sub }
}

/** Change plan (upgrade/downgrade) */
export async function changePlan(
  subscriptionId: string,
  newPriceId: string
): Promise<Result<Stripe.Subscription>> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const sub = await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: "create_prorations",
  })

  await db
    .update(subscriptions)
    .set({
      stripePriceId: newPriceId,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))

  return { success: true, data: sub }
}
```

---

## 7. Billing Portal

```ts
// src/routes/settings/billing/+page.server.ts
import type { Actions } from "./$types"
import { redirect, fail } from "@sveltejs/kit"
import { stripe } from "$lib/server/stripe"
import { getStripeCustomerId } from "$lib/server/billing/customers"

export const actions = {
  portal: async ({ locals, url }) => {
    // See sveltekit-auth.md for auth setup (Lucia pattern)
    const user = locals.user
    if (!user) return fail(401, { error: "Unauthorized" })

    const result = await getStripeCustomerId(user.id)
    if (!result.success || !result.data) {
      return fail(400, { error: "No active subscription" })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: result.data,
      return_url: `${url.origin}/settings/billing`,
    })

    redirect(303, portalSession.url)
  },
} satisfies Actions
```

```svelte
<!-- src/routes/settings/billing/+page.svelte -->
<script lang="ts">
  import { enhance } from "$app/forms"
</script>

<form method="POST" action="?/portal" use:enhance>
  <button type="submit">Manage Billing</button>
</form>
```

---

## 8. Stripe Elements — Embedded Payment Form

For custom payment forms (not checkout redirect):

```svelte
<!-- src/lib/components/billing/PaymentForm.svelte -->
<script lang="ts">
  import { onMount } from "svelte"
  import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js"
  import { PUBLIC_STRIPE_KEY } from "$env/static/public"

  export let clientSecret: string

  let stripe: Stripe | null = null
  let elements: StripeElements | null = null
  let paymentElement: HTMLDivElement
  let loading = true
  let errorMessage = ""

  onMount(async () => {
    stripe = await loadStripe(PUBLIC_STRIPE_KEY)
    if (!stripe) return

    elements = stripe.elements({
      clientSecret,
      appearance: { theme: "stripe" },
    })

    const payment = elements.create("payment")
    payment.mount(paymentElement)
    loading = false
  })

  async function handleSubmit() {
    if (!stripe || !elements) return
    loading = true
    errorMessage = ""

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
    })

    if (error) {
      errorMessage = error.message ?? "Payment failed"
      loading = false
    }
    // If successful, user is redirected — no code runs after this
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <div bind:this={paymentElement}></div>
  {#if errorMessage}
    <p class="text-destructive">{errorMessage}</p>
  {/if}
  <button type="submit" disabled={loading}>
    {loading ? "Processing..." : "Pay"}
  </button>
</form>
```

Create the PaymentIntent server-side:
```ts
// src/routes/checkout/+page.server.ts
import type { PageServerLoad } from "./$types"
import { stripe } from "$lib/server/stripe"
import { redirect } from "@sveltejs/kit"

export const load: PageServerLoad = async ({ locals }) => {
  // See sveltekit-auth.md for auth setup (Lucia pattern)
  const user = locals.user
  if (!user) redirect(303, "/login")

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 2000, // $20.00 in cents
    currency: "usd",
    metadata: { userId: user.id },
  })

  return { clientSecret: paymentIntent.client_secret }
}
```

---

## 9. Helper — Check Subscription Status

```ts
// src/lib/server/billing/guards.ts
import { getUserSubscription } from "$lib/server/billing/subscriptions"

/** Use in +page.server.ts load functions or form actions to gate features */
export async function requireActiveSubscription(userId: string): Promise<boolean> {
  const result = await getUserSubscription(userId)
  if (!result.success || !result.data) return false
  return result.data.status === "active" || result.data.status === "trialing"
}
```

Usage in a load function:
```ts
// src/routes/pro-feature/+page.server.ts
import type { PageServerLoad } from "./$types"
import { redirect } from "@sveltejs/kit"
import { requireActiveSubscription } from "$lib/server/billing/guards"

export const load: PageServerLoad = async ({ locals }) => {
  // See sveltekit-auth.md for auth setup (Lucia pattern)
  const user = locals.user
  if (!user) redirect(303, "/login")

  const hasAccess = await requireActiveSubscription(user.id)
  if (!hasAccess) redirect(303, "/pricing")

  return {}
}
```

---

## 10. Testing — Local Webhooks

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev server
stripe listen --forward-to localhost:5173/api/webhooks/stripe

# Copy the webhook signing secret (whsec_...) to .env as STRIPE_WEBHOOK_SECRET

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

Test mode keys:
- `sk_test_...` for server (STRIPE_SECRET_KEY)
- `pk_test_...` for client (PUBLIC_STRIPE_KEY)
- `whsec_...` from `stripe listen` output (STRIPE_WEBHOOK_SECRET)

Production keys are different — swap them in production environment variables, never hardcode.

---

## Gotchas
- **Webhook: raw body mandatory** — use `request.text()`, NOT `request.json()`. Signature verification fails with parsed JSON.
- **SvelteKit auto-parses** — the `+server.ts` handler with `request.text()` gives you the raw body correctly. No extra config needed (unlike Express/Next.js Pages Router).
- **Always verify the signature** — never process a webhook event without `constructEvent()`.
- **`stripe_customer_id` in DB** — store the Stripe customer ID in your database to avoid creating duplicate customers.
- **Test vs prod keys** — `sk_test_*` for dev, `sk_live_*` for prod. Webhook secrets are different per environment.
- **SvelteKit form actions + redirect** — use `redirect(303, url)` (not 302) for POST-redirect-GET pattern.
- **`$env/static/private` vs `$env/dynamic/private`** — prefer static for build-time validation. Use dynamic only if env vars change at runtime.

---

## Anti-patterns — What NOT to Do

### 1. Exposing secret key client-side
```ts
// NEVER — secret key in public env
import { PUBLIC_STRIPE_KEY } from "$env/static/public"
const stripe = new Stripe(PUBLIC_STRIPE_KEY) // This is the publishable key, NOT the secret key
// But also NEVER put STRIPE_SECRET_KEY in a $env/static/public variable
```

### 2. Skipping webhook signature verification
```ts
// NEVER — processing unverified events
export const POST: RequestHandler = async ({ request }) => {
  const event = await request.json() // NO! No signature check = anyone can fake events
  // ...
}
```

### 3. Creating duplicate customers
```ts
// NEVER — creating a new customer every checkout
const customer = await stripe.customers.create({ email })
// ALWAYS check DB first with getOrCreateStripeCustomer()
```

### 4. Using request.json() for webhooks
```ts
// NEVER — json() parses the body, breaking signature verification
const body = await request.json()
stripe.webhooks.constructEvent(JSON.stringify(body), sig, secret) // BREAKS — not the original raw body
```

### 5. Importing stripe server module in client code
```ts
// NEVER — this exposes the secret key
// In a .svelte file or any file without 'server' in the path:
import { stripe } from "$lib/server/stripe" // SvelteKit will error, but don't even try
```

### 6. Hardcoding prices
```ts
// NEVER — hardcode Stripe price IDs in multiple places
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: "price_1234abc", quantity: 1 }], // Magic string
})
// ALWAYS use a config object or DB lookup for price IDs
```

### 7. Ignoring failed payments
```ts
// NEVER — silently dropping invoice.payment_failed
case "invoice.payment_failed":
  break // User has no idea their payment failed
// ALWAYS notify the user and update subscription status
```

### 8. Storing full card details
```ts
// NEVER — Stripe handles PCI compliance. Store only:
// - stripe_customer_id
// - subscription id/status
// - last4 digits (from Stripe API, for display only)
// NEVER store full card numbers, CVV, or expiry
```
