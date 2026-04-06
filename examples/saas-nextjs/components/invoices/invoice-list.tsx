/**
 * Invoice list — pure UI component (R2).
 * Receives data via props, no fetch/useQuery inside.
 * Only imports from own feature or components/ui/ (R5).
 */

import { StatusBadge } from '@/components/ui/status-badge'
import type { Invoice } from '@/lib/schemas/invoice'

type Props = {
  invoices: Invoice[]
  onSelect: (id: string) => void
}

export function InvoiceList({ invoices, onSelect }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No invoices yet</p>
        <p className="text-sm">Create your first invoice to get started.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {invoices.map((invoice) => (
        <button
          key={invoice.id}
          onClick={() => onSelect(invoice.id)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {invoice.client_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {invoice.client_email}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              ${(invoice.amount_cents / 100).toFixed(2)}
            </span>
            <StatusBadge status={invoice.status} />
          </div>
        </button>
      ))}
    </div>
  )
}
