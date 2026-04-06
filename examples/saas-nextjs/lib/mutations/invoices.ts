/**
 * Invoice mutations — write operations in lib/ (R1).
 * Result<T> everywhere, no throws (R4).
 */

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { config } from '@/lib/config'
import { AppError, ok, err } from '@/lib/errors'
import type { Result } from '@/lib/errors'
import type { Invoice, CreateInvoiceInput } from '@/lib/schemas/invoice'

export async function createInvoice(
  data: CreateInvoiceInput,
  userId: string
): Promise<Result<Invoice>> {
  const supabase = await createClient()

  const amountCents = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_cents,
    0
  )

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      client_name: data.client_name,
      client_email: data.client_email,
      status: 'draft',
      amount_cents: amountCents,
      currency: data.currency,
      due_date: data.due_date,
      items: data.items,
      stripe_payment_link: null,
      paid_at: null,
    })
    .select()
    .single()

  if (error) {
    return err(AppError.internal(error.message))
  }

  return ok(invoice as Invoice)
}

export async function sendInvoice(
  id: string,
  userId: string
): Promise<Result<void>> {
  const supabase = await createClient()

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !invoice) {
    return err(AppError.notFound('Invoice'))
  }

  // Create Stripe Payment Link for this invoice
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: invoice.currency,
          product_data: { name: `Invoice #${invoice.id.slice(0, 8)}` },
          unit_amount: invoice.amount_cents,
        },
        quantity: 1,
      },
    ],
    after_completion: {
      type: 'redirect',
      redirect: { url: `${config.app.url}/invoices/${id}/paid` },
    },
  })

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'sent', stripe_payment_link: paymentLink.url })
    .eq('id', id)

  if (updateError) {
    return err(AppError.internal(updateError.message))
  }

  return ok(undefined)
}
