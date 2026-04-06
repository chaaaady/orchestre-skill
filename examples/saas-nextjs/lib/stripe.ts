/**
 * Stripe singleton — instantiated once, imported everywhere.
 * Never create a new Stripe() instance elsewhere.
 */

import Stripe from 'stripe'
import { config } from '@/lib/config'

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})
