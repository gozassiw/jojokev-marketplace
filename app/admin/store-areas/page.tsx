import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import AdminStoreAreas from '@/components/AdminStoreAreas'

export const dynamic = 'force-dynamic'

export default async function AdminStoreAreasPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/store-areas')
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')
  const { data: areas } = await db.from('store_areas').select('id, name, city, state, is_active').order('state').order('city').order('name')
  return <main className="min-h-[calc(100vh-160px)] bg-slate-50 py-8 sm:py-12"><div className="page-wrap max-w-6xl"><div className="rounded-3xl bg-[#10251d] p-6 text-white sm:p-9"><p className="eyebrow bg-white/10 text-[#d9f33f]">Seller settings</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-5xl">Store areas</h1><p className="mt-3 max-w-2xl text-sm text-white/70">Create the locations sellers can choose for their store. This list is separate from delivery fees and rider quotes.</p></div><div className="mt-6"><AdminStoreAreas areas={(areas || []) as any} /></div></div></main>
}
