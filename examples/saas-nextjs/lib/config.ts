/**
 * ENV validation at boot — fails fast if required vars are missing.
 * Imported once at app startup. Never use process.env directly elsewhere.
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

export const config = {
  supabase: {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  stripe: {
    secretKey: requireEnv('STRIPE_SECRET_KEY'),
    webhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
    proPriceId: requireEnv('STRIPE_PRO_PRICE_ID'),
  },
  resend: {
    apiKey: requireEnv('RESEND_API_KEY'),
    fromEmail: requireEnv('RESEND_FROM_EMAIL'),
  },
  app: {
    url: requireEnv('NEXT_PUBLIC_APP_URL'),
  },
} as const
