import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** BROWSER — runs in the user's tab. RLS applies. Safe to expose. */
export function supabaseBrowser() {
  return createBrowserClient(URL, ANON)
}

/** SERVER COMPONENTS / ROUTE HANDLERS — acts as the logged-in user. RLS applies. */
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions))
        } catch {
          // called from a Server Component — middleware refreshes the session
        }
      },
    },
  })
}

/**
 * ADMIN — BYPASSES ALL ROW LEVEL SECURITY.
 *
 * Use ONLY in server-side code the user cannot reach directly:
 * webhook handlers, escrow release jobs, order creation.
 *
 * NEVER import this into a Client Component. If this key reaches the
 * browser, anyone can read every wallet and rewrite every balance.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
  return createClient(URL, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
