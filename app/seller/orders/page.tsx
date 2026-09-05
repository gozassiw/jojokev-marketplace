import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import SellerOrders from '@/components/SellerOrders'

export const dynamic = 'force-dynamic'

export default async function SellerOrdersPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/orders')

  const db = supabaseAdmin()
  const { data: seller } = await db
    .from('seller_profiles')
    .select('id, status')
    .eq('user_id', user.id)
    .single()
  if (!seller || seller.status !== 'approved') redirect('/seller/pending')

  // Authenticate with the browser session, then hydrate only this seller's
  // order items and matching orders through the service client. This avoids
  // RLS joins hiding an otherwise valid paid order in the workspace.
  const { data: items } = await db
    .from('order_items')
    .select('*')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })

  const orderIds = Array.from(new Set((items ?? []).map(item => item.order_id)))
  const { data: orders } = orderIds.length
    ? await db
      .from('orders')
      .select('id, order_number, status, total_kobo, created_at, delivered_at, auto_release_at')
      .in('id', orderIds)
      .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const itemsByOrder = new Map<string, any[]>()
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  }

  const rows = (orders ?? []).map(o => ({ ...o, myItems: itemsByOrder.get(o.id) ?? [] }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-emerald-700">Seller workspace</p>
      <h1 className="mb-2 text-2xl font-black text-slate-950">Orders for my products</h1>
      <p className="mb-6 text-sm text-slate-600">Arrange delivery with your own rider, then update the buyer as the order moves.</p>
      <SellerOrders orders={rows} />
    </div>
  )
}
