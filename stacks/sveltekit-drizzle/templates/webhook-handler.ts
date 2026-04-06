// src/routes/api/webhooks/stripe/+server.ts
import { stripe } from '$lib/server/stripe'
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private'
import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    error(400, 'Missing stripe-signature header')
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed')
    error(400, 'Invalid signature')
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      // TODO: Fulfill the purchase
      // - Update user subscription status in DB
      // - Send confirmation email
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      // TODO: Update subscription in DB
      // - Check subscription.status (active, past_due, canceled, etc.)
      // - Update user's plan accordingly
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      // TODO: Handle subscription cancellation
      // - Downgrade user to free plan
      // - Send cancellation email
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      // TODO: Handle failed payment
      // - Notify user of payment failure
      // - Consider grace period before downgrade
      break
    }

    default:
      // Unhandled event type — log but don't error
      console.log(`Unhandled event type: ${event.type}`)
  }

  return json({ received: true })
}
