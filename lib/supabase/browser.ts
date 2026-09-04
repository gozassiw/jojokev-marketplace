'use client'

import { createBrowserClient } from '@supabase/ssr'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** BROWSER — runs in the user's tab. RLS applies. Safe to expose. */
export function supabaseBrowser() {
  return createBrowserClient(URL, ANON)
}
