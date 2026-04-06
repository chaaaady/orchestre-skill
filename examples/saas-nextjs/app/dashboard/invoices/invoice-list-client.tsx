/**
 * Client wrapper — 'use client' only because we need onClick (R6).
 * Delegates rendering to pure InvoiceList component.
 */

'use client'

import { useRouter } from 'next/navigation'
import { InvoiceList } from '@/components/invoices/invoice-list'
import type { Invoice } from '@/lib/schemas/invoice'

type Props = {
  invoices: Invoice[]
}

export function InvoiceListClient({ invoices }: Props) {
  const router = useRouter()

  function handleSelect(id: string) {
    router.push(`/dashboard/invoices/${id}`)
  }

  return <InvoiceList invoices={invoices} onSelect={handleSelect} />
}
