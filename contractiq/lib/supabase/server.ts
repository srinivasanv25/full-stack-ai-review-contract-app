import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// Derived from the actual createServerClient<Database>(...) call below rather
// than reconstructed via SupabaseClient<Database, ...> generics — the latter
// drifts out of sync whenever @supabase/supabase-js changes its generic
// signature across versions.
export type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render — safe to ignore because
            // middleware.ts refreshes the session cookie on every request.
          }
        },
      },
    }
  )
}
