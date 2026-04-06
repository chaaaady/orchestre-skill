/**
 * Invoice schemas — Zod first, types inferred (R3).
 * Single source of truth for validation and types.
 */

import { z } from 'zod'

const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const // R8 — zero magic strings

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price_cents: z.number().int().nonnegative('Price cannot be negative'),
})

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  client_name: z.string().min(1),
  client_email: z.string().email(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('USD'),
  due_date: z.string().datetime(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item required'),
  stripe_payment_link: z.string().url().nullable(),
  paid_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const createInvoiceSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_email: z.string().email('Valid email required'),
  due_date: z.string().datetime(),
  currency: z.string().length(3).default('USD'),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item required'),
})

// R3 — Types inferred from Zod, never duplicated manually
export type Invoice = z.infer<typeof invoiceSchema>
export type InvoiceItem = z.infer<typeof invoiceItemSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export { InvoiceStatus }
