import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getInvoices } from '$lib/server/queries/invoices';
import { createInvoice } from '$lib/server/mutations/invoices';
import { createInvoiceSchema } from '$lib/schemas/invoice';

// --- R6: Server load function checks auth, delegates to lib/ ---
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const result = await getInvoices(locals.user.id);

	if (!result.success) {
		return { invoices: [], error: result.error.message };
	}

	return { invoices: result.data };
};

// --- R7: Mutations via form actions, not fetch POST ---
export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			redirect(302, '/login');
		}

		const formData = await request.formData();

		// Parse line items from form
		const lineItems: Array<{ description: string; quantity: number; unit_price: number }> = [];
		let i = 0;
		while (formData.has(`line_items[${i}].description`)) {
			lineItems.push({
				description: formData.get(`line_items[${i}].description`) as string,
				quantity: Number(formData.get(`line_items[${i}].quantity`)),
				unit_price: Number(formData.get(`line_items[${i}].price`))
			});
			i++;
		}

		const input = {
			client_name: formData.get('client_name'),
			client_email: formData.get('client_email'),
			due_date: formData.get('due_date'),
			notes: formData.get('notes') || undefined,
			line_items: lineItems
		};

		// --- Zod safeParse, never parse ---
		const parsed = createInvoiceSchema.safeParse(input);

		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.');
				fieldErrors[key] = issue.message;
			}
			return fail(400, { errors: fieldErrors, values: input });
		}

		const result = await createInvoice(parsed.data, locals.user.id);

		if (!result.success) {
			return fail(result.error.status, { errors: { form: result.error.message } });
		}

		return { success: true };
	}
};
