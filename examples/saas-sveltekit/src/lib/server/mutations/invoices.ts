import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoices, lineItems } from '$lib/server/db/schema';
import { stripe } from '$lib/server/stripe';
import { ok, err, Errors } from '$lib/server/errors';
import type { Result } from '$lib/server/errors';
import type { Invoice, CreateInvoiceInput } from '$lib/schemas/invoice';
import { InvoiceStatus } from '$lib/schemas/invoice';

// --- R1: Business logic in lib/ only ---
// --- R4: Result<T>, never throw ---

export async function createInvoice(
	data: CreateInvoiceInput,
	userId: string
): Promise<Result<Invoice>> {
	try {
		const totalCents = data.line_items.reduce(
			(sum, item) => sum + item.quantity * Math.round(item.unit_price * 100),
			0
		);

		const [invoice] = await db
			.insert(invoices)
			.values({
				user_id: userId,
				client_name: data.client_name,
				client_email: data.client_email,
				due_date: data.due_date,
				total_cents: totalCents,
				notes: data.notes ?? null,
				status: InvoiceStatus.DRAFT
			})
			.returning();

		const items = await db
			.insert(lineItems)
			.values(
				data.line_items.map((item) => ({
					invoice_id: invoice.id,
					description: item.description,
					quantity: item.quantity,
					unit_price: Math.round(item.unit_price * 100)
				}))
			)
			.returning();

		return ok({
			...invoice,
			line_items: items.map((i) => ({
				description: i.description,
				quantity: i.quantity,
				unit_price: i.unit_price
			}))
		});
	} catch (e) {
		return err(Errors.internal('Failed to create invoice'));
	}
}

export async function sendInvoice(
	id: string,
	userId: string
): Promise<Result<Invoice>> {
	try {
		const [invoice] = await db
			.select()
			.from(invoices)
			.where(and(eq(invoices.id, id), eq(invoices.user_id, userId)))
			.limit(1);

		if (!invoice) return err(Errors.notFound('Invoice'));
		if (invoice.status !== InvoiceStatus.DRAFT) {
			return err(Errors.validation('Only draft invoices can be sent'));
		}

		const paymentLink = await stripe.paymentLinks.create({
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: { name: `Invoice for ${invoice.client_name}` },
						unit_amount: invoice.total_cents
					},
					quantity: 1
				}
			],
			metadata: { invoice_id: invoice.id }
		});

		const [updated] = await db
			.update(invoices)
			.set({
				status: InvoiceStatus.SENT,
				stripe_payment_link: paymentLink.url,
				updated_at: new Date()
			})
			.where(eq(invoices.id, id))
			.returning();

		const items = await db
			.select()
			.from(lineItems)
			.where(eq(lineItems.invoice_id, id));

		return ok({
			...updated,
			line_items: items.map((i) => ({
				description: i.description,
				quantity: i.quantity,
				unit_price: i.unit_price
			}))
		});
	} catch (e) {
		return err(Errors.stripe('Failed to create payment link'));
	}
}
