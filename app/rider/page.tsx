import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import RiderActions from '@/components/RiderActions'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function RiderPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/rider')
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('id, phone, vehicle_type, vehicle_plate, status').eq('user_id', user.id).single()
  if (!rider) redirect('/rider/register')
  if (rider.status !== 'approved') return <main className="page-wrap py-12"><div className="surface mx-auto max-w-xl p-7"><p className="eyebrow">Rider application</p><h1 className="mt-4 text-3xl font-black">Your application is under review</h1><p className="mt-3 text-slate-600">Jojokev will approve your rider account before you can receive delivery assignments.</p></div></main>
  const { data: assignments } = await db.from('delivery_assignments').select('id, order_id, status, assigned_at, orders(order_number, total_kobo, buyer_id, addresses(full_name, phone, street, city, state, landmark), order_items(product_title, quantity))').eq('rider_id', rider.id).in('status', ['assigned','picked_up','out_for_delivery','arrived','delivered']).order('assigned_at', { ascending: false })
  return <main className="min-h-[calc(100vh-160px)] bg-[#f7f8f6] py-8 sm:py-12"><div className="page-wrap max-w-5xl"><div className="rounded-3xl bg-[#14251e] p-6 text-white sm:p-9"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="eyebrow bg-white/10 text-[#d9f33f]">Rider workspace</span><h1 className="mt-4 text-3xl font-black tracking-[-.04em]">Your deliveries</h1><p className="mt-2 text-sm text-white/65">Pick up, deliver, and verify the buyer code before completing a drop-off.</p></div><Link href="/notifications" className="rounded-xl bg-[#d9f33f] px-4 py-3 text-sm font-black text-[#14251e]">Notifications</Link></div></div><div className="surface mt-5 p-5"><p className="section-kicker">Safety rule</p><p className="mt-2 text-sm font-semibold text-amber-800">Never ask for the buyer code before the package is physically with the buyer. The code is shown only in the buyer’s Jojokev notifications.</p></div><div className="mt-5 space-y-4">{!assignments?.length ? <div className="surface p-10 text-center text-slate-500">No delivery assignments yet.</div> : assignments.map((a: any) => { const order = a.orders; const address = order?.addresses; return <article key={a.id} className="surface p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">{order?.order_number}</p><h2 className="mt-2 text-xl font-black">{address?.full_name || 'Buyer delivery'}</h2><p className="mt-1 text-sm text-slate-600">{address?.street}, {address?.city}, {address?.state}</p><p className="mt-1 text-sm text-slate-600">Phone: {address?.phone}</p><p className="mt-3 text-xs text-slate-500">{order?.order_items?.map((i: any) => `${i.quantity} × ${i.product_title}`).join(' · ')}</p></div><OrderStatusBadge status={a.status === 'out_for_delivery' || a.status === 'arrived' ? 'shipped' : a.status === 'delivered' ? 'delivered' : 'paid'} /></div><div className="mt-5 border-t border-slate-100 pt-4"><RiderActions orderId={a.order_id} status={a.status} /></div></article> })}</div></div></main>
}
