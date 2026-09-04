import Link from 'next/link'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'
import { notFound, redirect } from 'next/navigation'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import ConfirmDeliveryButton from '@/components/ConfirmDeliveryButton'

export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/orders/${params.id}`)

  // Authenticate with the user session, then hydrate through the server client.
  // This avoids nested public/RLS joins hiding a valid buyer order.
  const db = supabaseAdmin()
  const { data: order } = await db
    .from('orders')
    .select('id, order_number, buyer_id, status, subtotal_kobo, delivery_fee_kobo, total_kobo, created_at, delivered_at, auto_release_at, address_id')
    .eq('id', params.id)
    .eq('buyer_id', user.id)
    .single()

  if (!order) notFound()

  const [{ data: items }, { data: address }] = await Promise.all([
    db.from('order_items').select('id, product_title, quantity, unit_price_kobo, line_total_kobo').eq('order_id', order.id).order('created_at', { ascending: true }),
    order.address_id
      ? db.from('addresses').select('full_name, phone, street, city, state, landmark').eq('id', order.address_id).eq('user_id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="workspace-page">
      <div className="workspace-container max-w-4xl">
        <Link href="/orders" className="workspace-back">← Back to my orders</Link>
        <div className="workspace-titlebar">
          <div>
            <p className="eyebrow">Customer order details</p>
            <h1 className="workspace-title">Order {order.order_number}</h1>
            <p className="workspace-subtitle">Placed {new Date(order.created_at).toLocaleString('en-NG')}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {order.status === 'awaiting_payment' && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-950">This order is waiting for your bank transfer.</p>
            <p className="mt-1 text-sm text-amber-800">Your checkout is reserved while the payment account remains active.</p>
            <Link href={`/checkout/${order.id}/pay`} className="action-button action-button-primary mt-4 inline-flex">Continue to secure payment</Link>
          </div>
        )}

        {['paid', 'shipped', 'delivered'].includes(order.status) && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-950">Payment protected by Jojokev escrow</p>
            <p className="mt-1 text-sm text-emerald-800">Your payment remains held securely until you confirm that the order has arrived.</p>
            {order.status === 'delivered' && <ConfirmDeliveryButton orderId={order.id} />}
          </div>
        )}

        <section className="workspace-card mb-6">
          <div className="workspace-card-heading"><div><p className="eyebrow">Purchase summary</p><h2 className="workspace-card-title">Items in this order</h2></div></div>
          <ul className="divide-y divide-slate-100">
            {(items ?? []).map(item => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                <div><p className="font-semibold text-slate-900">{item.product_title}</p><p className="text-sm text-slate-500">{item.quantity} × {formatNaira(item.unit_price_kobo)}</p></div>
                <p className="font-bold text-slate-900">{formatNaira(item.line_total_kobo)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(order.subtotal_kobo)}</dd></div>
            <div className="flex justify-between"><dt>Delivery fee</dt><dd>{formatNaira(order.delivery_fee_kobo)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatNaira(order.total_kobo)}</dd></div>
          </dl>
        </section>

        {address && <section className="workspace-card"><p className="eyebrow">Delivery details</p><h2 className="workspace-card-title mb-2">Delivering to</h2><p className="text-sm font-semibold text-slate-900">{address.full_name} · {address.phone}</p><p className="mt-1 text-sm text-slate-600">{address.street}, {address.city}, {address.state}{address.landmark && <> · {address.landmark}</>}</p></section>}
      </div>
    </div>
  )
}
