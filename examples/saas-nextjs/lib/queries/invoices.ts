/**
 * Invoice queries — business logic lives in lib/ (R1).
 * All functions return Result<T>, never throw (R4).
 * No Supabase calls in app/ or components/.
 */

import { createClient } from '@/lib/supabase/server'
import { AppError, ok, err } from '@/lib/errors'
import type { Result } from '@/lib/errors'
import type { Invoice } from '@/lib/schemas/invoice'

export async function getInvoices(userId: string): Promise<Result<Invoice[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return err(AppError.internal(error.message))
  }

  return ok(data as Invoice[])
}

export async function getInvoiceById(
  id: string,
  userId: string
): Promise<Result<Invoice>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    return err(AppError.notFound('Invoice'))
  }

  return ok(data as Invoice)
}

export async function getInvoiceStats(
  userId: string
): Promise<Result<{ total: number; paid: number; pending: number; overdue: number }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('status, amount_cents')
    .eq('user_id', userId)

  if (error) {
    return err(AppError.internal(error.message))
  }

  const stats = {
    total: data.length,
    paid: data.filter((i) => i.status === 'paid').length,
    pending: data.filter((i) => i.status === 'sent').length,
    overdue: data.filter((i) => i.status === 'overdue').length,
  }

  return ok(stats)
}
