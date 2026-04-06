/**
 * Supabase server client singleton.
 * Used in Server Components, Server Actions, and API routes.
 * Never instantiate Supabase elsewhere on the server.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { config } from '@/lib/config'
import type { Database } from '@/lib/supabase/types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )
}
