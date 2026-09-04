import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/clients'

/**
 * Releases escrow on delivered orders the buyer never confirmed.
 * Schedule this HOURLY.
 *
 * Protected by CRON_SECRET — otherwise anyone hitting the URL could
 * trigger fund releases at will.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db.rpc('auto_release_due_orders')

  if (error) {
    console.error('[cron] auto-release failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ released: data ?? 0 })
}
