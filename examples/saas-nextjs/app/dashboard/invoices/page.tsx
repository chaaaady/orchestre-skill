/**
 * Invoices page — Server Component by default (R6).
 * Fetches data via lib/queries, passes to pure UI components (R1, R2).
 * No 'use client' — server-rendered.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInvoices } from '@/lib/queries/invoices'
import { InvoiceListClient } from '@/app/dashboard/invoices/invoice-list-client'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const result = await getInvoices(user.id)

  if (!result.success) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load invoices.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
      </div>
      <InvoiceListClient invoices={result.data} />
    </div>
  )
}
