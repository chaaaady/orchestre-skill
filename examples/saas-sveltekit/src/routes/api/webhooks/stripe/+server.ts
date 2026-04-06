import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stripe } from '$lib/server/stripe';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import { db } from '$lib/server/db';
import { invoices } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { InvoiceStatus } from '$lib/schemas/invoice';
import type Stripe from 'stripe';

/**
 * --- CE QUE CE CODE FAIT ---
 * Verifies Stripe webhook signature, then processes checkout.session.completed
 * events to mark invoices as paid. Returns 200 immediately.
 *
 * Concept cle : signature verification prevents forged webhook calls.
 * Si ca casse : check STRIPE_WEBHOOK_SECRET matches `stripe listen` output.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		error(400, 'Missing stripe-signature header');
	}

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
	} catch (e) {
		error(400, 'Invalid webhook signature');
	}

	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			const invoiceId = session.metadata?.invoice_id;

			if (invoiceId) {
				await db
					.update(invoices)
					.set({
						status: InvoiceStatus.PAID,
						updated_at: new Date()
					})
					.where(eq(invoices.id, invoiceId));
			}
			break;
		}

		case 'payment_intent.payment_failed': {
			const intent = event.data.object as Stripe.PaymentIntent;
			const invoiceId = intent.metadata?.invoice_id;

			if (invoiceId) {
				await db
					.update(invoices)
					.set({
						status: InvoiceStatus.OVERDUE,
						updated_at: new Date()
					})
					.where(eq(invoices.id, invoiceId));
			}
			break;
		}
	}

	return json({ received: true });
};
