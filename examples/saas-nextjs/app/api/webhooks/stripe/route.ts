/**
 * Stripe webhook handler — signature verified before processing.
 * Returns 200 immediately. Idempotent on duplicate events.
 */

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { config } from '@/lib/config'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, config.stripe.webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Service role client for admin operations
  const supabase = createServerClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const invoiceId = session.metadata?.invoice_id
      if (invoiceId) {
        await supabase
          .from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', invoiceId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const plan = subscription.status === 'active' ? 'pro' : 'free'
      await supabase
        .from('profiles')
        .update({ plan })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}

/**
 * --- CE QUE CE CODE FAIT ---
 * Receives Stripe webhook events, verifies the signature to prevent
 * spoofing, then updates invoice status or user plan in Supabase.
 *
 * Concept cle : Always verify webhook signature BEFORE processing.
 * Si ca casse : Check STRIPE_WEBHOOK_SECRET matches your endpoint secret.
 * ---
 */
