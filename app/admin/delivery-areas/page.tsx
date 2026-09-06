import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { getActiveDeliveryAreas } from '@/app/actions/deliveryAreas'
import AdminDeliveryAreas from '@/components/AdminDeliveryAreas'

export const dynamic = 'force-dynamic'

export default async function AdminDeliveryAreasPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/delivery-areas')
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')
  const { data: areas } = await db.from('delivery_areas').select('id, name, city, state, customer_fee_kobo, rider_quote_kobo, is_active').order('state').order('city').order('name')
  return <main className="min-h-[calc(100vh-160px)] bg-slate-50 py-8 sm:py-12"><div className="page-wrap max-w-6xl"><div className="rounded-3xl bg-[#10251d] p-6 text-white sm:p-9"><p className="eyebrow bg-white/10 text-[#d9f33f]">Dispatch settings</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-5xl">Delivery areas and rider quotes</h1><p className="mt-3 max-w-2xl text-sm text-white/70">Set what buyers pay for each area and the offer sent to approved riders after payment.</p></div><div className="mt-6"><AdminDeliveryAreas areas={(areas || []) as any} /></div></div></main>
}
