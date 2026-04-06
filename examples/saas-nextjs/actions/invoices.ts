/**
 * Server Actions — mutations go through here, never fetch('/api/...') (R7).
 * Validates input with Zod safeParse, delegates to lib/mutations.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createInvoice, sendInvoice } from '@/lib/mutations/invoices'
import { createInvoiceSchema } from '@/lib/schemas/invoice'
import { AppError } from '@/lib/errors'
import type { Result } from '@/lib/errors'
import type { Invoice } from '@/lib/schemas/invoice'

export async function createInvoiceAction(
  formData: unknown
): Promise<Result<Invoice>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: AppError.unauthorized() }
  }

  // Zod safeParse — never parse() for user input
  const parsed = createInvoiceSchema.safeParse(formData)
  if (!parsed.success) {
    return {
      success: false,
      error: AppError.validation(parsed.error.issues[0].message),
    }
  }

  const result = await createInvoice(parsed.data, user.id)

  if (result.success) {
    revalidatePath('/dashboard/invoices')
  }

  return result
}

export async function sendInvoiceAction(
  invoiceId: string
): Promise<Result<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: AppError.unauthorized() }
  }

  const result = await sendInvoice(invoiceId, user.id)

  if (result.success) {
    revalidatePath('/dashboard/invoices')
  }

  return result
}
