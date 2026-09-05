import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import AdminRiders from '@/components/AdminRiders'

export const dynamic = 'force-dynamic'

export default async function AdminRidersPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/riders')
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: riderRows, error } = await db.from('rider_profiles').select('id, user_id, phone, vehicle_type, vehicle_plate, status, created_at').order('created_at', { ascending: false }).limit(200)
  const userIds = (riderRows || []).map((r: any) => r.user_id)
  const { data: profiles } = userIds.length ? await db.from('profiles').select('id, full_name, role').in('id', userIds) : { data: [] as any[] }
  const profileById = new Map((profiles || []).map((p: any) => [p.id, p]))
  const riders = (riderRows || []).map((r: any) => ({ ...r, profiles: profileById.get(r.user_id) || null }))

  return <main className="min-h-[calc(100vh-160px)] bg-[#101714] py-8 text-white sm:py-12"><div className="page-wrap max-w-6xl"><div className="rounded-3xl bg-[#1c3028] p-6 sm:p-9"><p className="eyebrow bg-white/10 text-[#d9f33f]">Rider management</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-5xl">Approve delivery riders</h1><p className="mt-3 text-sm text-white/65">Review rider details before they can receive assignments.</p></div>{error && <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">Could not load rider applications. Refresh the page or contact support.</div>}<div className="mt-6"><AdminRiders riders={riders} /></div></div></main>
}
