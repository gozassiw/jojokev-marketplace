import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/clients'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null)
  return NextResponse.json({ count: count || 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
