import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/clients'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = supabaseAdmin()
  const { data, error } = await db.from('store_areas').select('id, name, city, state').eq('is_active', true).order('state').order('city').order('name')
  if (error) return NextResponse.json({ areas: [] }, { status: 500 })
  return NextResponse.json({ areas: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}
