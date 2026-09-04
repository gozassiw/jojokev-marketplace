import { supabaseServer } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import SellerOrders from '@/components/SellerOrders'

export const dynamic = 'force-dynamic'

export default async function SellerOrdersPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/orders')

  const { data: seller } = await supabase
    .from('seller_profiles').select('id, status').eq('user_id', user.id).single()
  if (!seller || seller.status !== 'approved') redirect('/seller/pending')

  // orders containing this seller's items (RLS enforces this too)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_kobo, created_at, delivered_at, auto_release_at')
    .order('created_at', { ascending: false })

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('seller_id', seller.id)

  const itemsByOrder = new Map<string, any[]>()
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? []
    list.push(item)
    itemsByOrder.set(item.order_id, list)
  }

  const rows = (orders ?? [])
    .filter(o => itemsByOrder.has(o.id))
    .map(o => ({ ...o, myItems: itemsByOrder.get(o.id)! }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Orders for my products</h1>
      <SellerOrders orders={rows} />
    </div>
  )
}
