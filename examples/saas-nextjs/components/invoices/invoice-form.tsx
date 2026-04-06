/**
 * Invoice form — client component for interactivity (R6 exception).
 * Pure UI: receives onSubmit callback via props (R2).
 * Uses Zod schema for client-side validation (R3).
 */

'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { createInvoiceSchema } from '@/lib/schemas/invoice'
import type { CreateInvoiceInput } from '@/lib/schemas/invoice'

type Props = {
  onSubmit: (data: CreateInvoiceInput) => void
  isLoading: boolean
}

export function InvoiceForm({ onSubmit, isLoading }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      items: [{ description: '', quantity: 1, unit_price_cents: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Client Name</label>
          <input
            {...register('client_name')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="Acme Corp"
          />
          {errors.client_name && (
            <p className="text-xs text-destructive">{errors.client_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Client Email</label>
          <input
            {...register('client_email')}
            type="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="billing@acme.com"
          />
          {errors.client_email && (
            <p className="text-xs text-destructive">{errors.client_email.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Line Items</label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <input
              {...register(`items.${index}.description`)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Description"
            />
            <input
              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
              type="number"
              className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Qty"
            />
            <input
              {...register(`items.${index}.unit_price_cents`, { valueAsNumber: true })}
              type="number"
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Price (cents)"
            />
            {fields.length > 1 && (
              <button type="button" onClick={() => remove(index)} className="p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => append({ description: '', quantity: 1, unit_price_cents: 0 })}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  )
}
