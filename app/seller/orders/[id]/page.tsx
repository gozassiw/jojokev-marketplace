import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import SellerOrderActions from '@/components/SellerOrderActions'

export const dynamic = 'force-dynamic'

export default async function SellerOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/seller/orders/${params.id}`)

  const db = supabaseAdmin()
  const { data: seller } = await db
    .from('seller_profiles')
    .select('id, status, business_name')
    .eq('user_id', user.id)
    .single()
  if (!seller || seller.status !== 'approved') redirect('/seller/pending')

  const { data: order } = await db
    .from('orders')
    .select('id, order_number, status, subtotal_kobo, delivery_fee_kobo, total_kobo, created_at, delivered_at, auto_release_at, address_id')
    .eq('id', params.id)
    .single()
  if (!order) notFound()

  const { data: items } = await db
    .from('order_items')
    .select('id, product_title, quantity, unit_price_kobo, line_total_kobo, commission_kobo, seller_net_kobo')
    .eq('order_id', order.id)
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: true })
  if (!items?.length) notFound()

  let address: any = null
  if (order.address_id) {
    const { data } = await db
      .from('addresses')
      .select('full_name, phone, street, city, state, landmark')
      .eq('id', order.address_id)
      .single()
    address = data
  }

  return (
    <div className="workspace-page">
      <div className="workspace-container max-w-5xl">
        <Link href="/seller/orders" className="workspace-back">← Back to orders</Link>
        <div className="workspace-titlebar">
          <div>
            <p className="eyebrow">Seller order details</p>
            <h1 className="workspace-title">Order {order.order_number}</h1>
            <p className="workspace-subtitle">Placed {new Date(order.created_at).toLocaleString('en-NG')}</p><p className="mt-1 text-sm font-bold text-emerald-700">Estimated delivery: 24–48 hours</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="workspace-grid workspace-grid-3 mb-6">
          <div className="stat-card"><span className="stat-label">Your sales</span><strong className="stat-value">{formatNaira(items.reduce((sum, item) => sum + item.seller_net_kobo, 0))}</strong><span className="stat-help">After commission</span></div>
          <div className="stat-card"><span className="stat-label">Items</span><strong className="stat-value">{items.reduce((sum, item) => sum + item.quantity, 0)}</strong><span className="stat-help">From your listings</span></div>
          <div className="stat-card"><span className="stat-label">Payment protection</span><strong className="stat-value">Escrow</strong><span className="stat-help">Held until delivery is confirmed</span></div>
        </div>

        <div className="workspace-grid lg:grid-cols-[1.2fr_.8fr]">
          <section className="workspace-card">
            <div className="workspace-card-heading"><div><p className="eyebrow">Your items</p><h2 className="workspace-card-title">Order contents</h2></div></div>
            <ul className="divide-y divide-slate-100">
              {items.map(item => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                  <div><p className="font-semibold text-slate-900">{item.product_title}</p><p className="text-sm text-slate-500">{item.quantity} × {formatNaira(item.unit_price_kobo)}</p></div>
                  <div className="text-right"><p className="font-bold text-slate-900">{formatNaira(item.seller_net_kobo)}</p><p className="text-xs text-slate-500">Your net</p></div>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between"><dt>Order subtotal</dt><dd>{formatNaira(order.subtotal_kobo)}</dd></div>
              <div className="flex justify-between"><dt>Delivery fee</dt><dd>{formatNaira(order.delivery_fee_kobo)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Customer total</dt><dd>{formatNaira(order.total_kobo)}</dd></div>
            </dl>
          </section>

          <div className="space-y-5">
            <section className="workspace-card"><p className="eyebrow">Fulfilment</p><h2 className="workspace-card-title mb-3">Update this order</h2><SellerOrderActions orderId={order.id} status={order.status} /></section>
            {address && <section className="workspace-card"><p className="eyebrow">Delivery information</p><h2 className="workspace-card-title mb-2">Ship to</h2><p className="text-sm font-semibold text-slate-900">{address.full_name} · {address.phone}</p><p className="mt-1 text-sm text-slate-600">{address.street}, {address.city}, {address.state}{address.landmark && <> · {address.landmark}</>}</p></section>}
          </div>
        </div>
      </div>
    </div>
  )
}
