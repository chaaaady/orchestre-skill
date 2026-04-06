import { z } from 'zod';

// --- Status enum (R8 — zero magic strings) ---
export const InvoiceStatus = {
	DRAFT: 'draft',
	SENT: 'sent',
	PAID: 'paid',
	OVERDUE: 'overdue',
	CANCELLED: 'cancelled'
} as const;

// --- Line item schema ---
export const lineItemSchema = z.object({
	description: z.string().min(1, 'Description is required'),
	quantity: z.number().int().positive(),
	unit_price: z.number().positive()
});

// --- Invoice creation schema ---
export const createInvoiceSchema = z.object({
	client_name: z.string().min(1, 'Client name is required'),
	client_email: z.string().email('Invalid email'),
	due_date: z.string().date('Invalid date format'),
	line_items: z.array(lineItemSchema).min(1, 'At least one line item required'),
	notes: z.string().max(500).optional()
});

// --- Inferred types (R3 — Zod first, never duplicate) ---
export type LineItem = z.infer<typeof lineItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceStatusValue = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export type Invoice = {
	id: string;
	user_id: string;
	client_name: string;
	client_email: string;
	status: InvoiceStatusValue;
	due_date: string;
	total_cents: number;
	stripe_payment_link: string | null;
	notes: string | null;
	created_at: Date;
	updated_at: Date;
	line_items: LineItem[];
};
