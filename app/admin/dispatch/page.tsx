import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import AdminDispatch from '@/components/AdminDispatch'

export const dynamic = 'force-dynamic'

export default async function AdminDispatchPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/dispatch')
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')
  const { data: orders } = await db.from('orders').select('id, order_number, total_kobo, delivery_fee_kobo, rider_quote_kobo, status, created_at, profiles(full_name), addresses(full_name, phone, street, city, state, landmark), delivery_areas(name, city, state, customer_fee_kobo, rider_quote_kobo), delivery_assignments(id, rider_id, rider_quote_kobo, status)').in('status', ['paid','shipped','delivered']).order('created_at', { ascending: false }).limit(200)
  return <main className="min-h-[calc(100vh-160px)] bg-[#101714] py-8 text-white sm:py-12"><div className="page-wrap max-w-6xl"><div className="rounded-3xl bg-[#1c3028] p-6 sm:p-9"><p className="eyebrow bg-white/10 text-[#d9f33f]">Dispatch control room</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-5xl">Assign and monitor deliveries</h1><p className="mt-3 max-w-2xl text-sm text-white/65">Jojokev staff assign approved riders. Riders handle pickup and buyer-code verification.</p></div><div className="mt-6"><AdminDispatch orders={orders || []} /></div></div></main>
}
