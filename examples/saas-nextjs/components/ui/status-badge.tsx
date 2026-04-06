/**
 * Shared UI component — can be imported by any feature (R5 exception for ui/).
 * Semantic tokens only — no hardcoded Tailwind colors.
 */

const StatusConfig = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-primary/10 text-primary' },
  paid: { label: 'Paid', className: 'bg-accent text-accent-foreground' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground line-through' },
} as const // R8 — zero magic strings

type Props = {
  status: keyof typeof StatusConfig
}

export function StatusBadge({ status }: Props) {
  const config = StatusConfig[status]

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}
