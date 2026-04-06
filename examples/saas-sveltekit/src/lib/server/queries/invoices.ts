import { eq, and, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoices, lineItems } from '$lib/server/db/schema';
import { ok, err, Errors } from '$lib/server/errors';
import type { Result } from '$lib/server/errors';
import type { Invoice } from '$lib/schemas/invoice';

// --- R1: Business logic in lib/ only ---
// --- R4: Result<T>, never throw ---

export async function getInvoices(userId: string): Promise<Result<Invoice[]>> {
	try {
		// Use Drizzle relational query to avoid N+1 (one query, not one per invoice)
		const rows = await db.query.invoices.findMany({
			where: eq(invoices.user_id, userId),
			orderBy: desc(invoices.created_at),
			with: {
				line_items: true,
			},
		});

		return ok(rows as Invoice[]);
	} catch (e) {
		return err(Errors.internal('Failed to fetch invoices'));
	}
}

export async function getInvoiceById(
	id: string,
	userId: string
): Promise<Result<Invoice>> {
	try {
		const [row] = await db
			.select()
			.from(invoices)
			.where(and(eq(invoices.id, id), eq(invoices.user_id, userId)))
			.limit(1);

		if (!row) {
			return err(Errors.notFound('Invoice'));
		}

		const items = await db
			.select()
			.from(lineItems)
			.where(eq(lineItems.invoice_id, row.id));

		return ok({
			...row,
			line_items: items.map((item) => ({
				description: item.description,
				quantity: item.quantity,
				unit_price: item.unit_price
			}))
		});
	} catch (e) {
		return err(Errors.internal('Failed to fetch invoice'));
	}
}
