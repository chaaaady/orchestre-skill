// Orchestre V15 — Stripe Webhook Handler Pattern
// Copier dans app/api/webhooks/stripe/route.ts

import Stripe from 'stripe'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      // TODO: handle checkout completion
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      // TODO: handle subscription update
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      // TODO: handle subscription cancellation
      break
    }
    case 'invoice.payment_failed': {
      // TODO: handle payment failure
      break
    }
  }

  return new Response('OK', { status: 200 })
}
