import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

// --- Stripe singleton ---
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
	apiVersion: '2024-06-20',
	typescript: true
});
