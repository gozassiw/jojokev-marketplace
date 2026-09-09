import Link from 'next/link'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'
import { notFound, redirect } from 'next/navigation'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import ConfirmDeliveryButton from '@/components/ConfirmDeliveryButton'

export const dynamic = 'force-dynamic'

type OrderStatus = 'awaiting_payment' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded'

const TRACKING_STEPS: { key: OrderStatus; label: string; caption: string }[] = [
  { key: 'awaiting_payment', label: 'Payment', caption: 'Payment received' },
  { key: 'paid', label: 'Confirmed', caption: 'Order confirmed' },
  { key: 'shipped', label: 'Out for delivery', caption: 'Seller rider is delivering' },
  { key: 'delivered', label: 'Delivered', caption: 'Arrived at your address' },
  { key: 'completed', label: 'Completed', caption: 'You confirmed delivery' },
]

function getCurrentStep(status: string) {
  const index = TRACKING_STEPS.findIndex(step => step.key === status)
  return index === -1 ? 0 : index
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/orders/${params.id}`)

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

  const status = order.status as OrderStatus
  const currentStep = getCurrentStep(status)
  const isProtected = ['paid', 'shipped', 'delivered'].includes(status)
  const isClosed = ['completed', 'cancelled', 'refunded'].includes(status)
  const formattedDate = new Date(order.created_at).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#f5f8f5]">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        <Link href="/orders" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-emerald-700">
          <span aria-hidden>←</span> Back to my orders
        </Link>

        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_12px_40px_rgba(20,38,29,.08)]">
          <div className="bg-gradient-to-br from-[#0c5d43] via-[#14805d] to-[#1c966e] px-5 py-6 text-white sm:px-8 sm:py-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[.2em] text-emerald-100">Customer order</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Order {order.order_number}</h1>
                <p className="mt-2 text-sm text-emerald-50">Placed {formattedDate}</p><p className="mt-2 text-sm font-bold text-[#d9f33f]">Estimated delivery: 24–48 hours</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-emerald-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d9f33f] text-lg font-black text-[#0b5d43]">
                {status === 'paid' || isProtected || status === 'completed' ? '✓' : '!' }
              </span>
              <p>
                {status === 'awaiting_payment' && 'Complete payment to confirm this order.'}
                {status === 'paid' && 'Payment received and protected in escrow. Estimated delivery is 24–48 hours.'}
                {status === 'shipped' && 'Your payment remains protected while the order is on the way.'}
                {status === 'delivered' && 'Your order arrived. Confirm delivery when everything is correct.'}
                {status === 'completed' && 'Delivery confirmed. Payment has been released to the seller.'}
                {status === 'cancelled' && 'This order has been cancelled.'}
                {status === 'refunded' && 'This order has been refunded.'}
              </p>
            </div>
          </div>

          {!isClosed && (
            <section className="border-b border-slate-100 px-5 py-6 sm:px-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Order progress</p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">Track your order</h2>
                </div>
                <p className="text-xs font-bold text-slate-400">Step {currentStep + 1} of {TRACKING_STEPS.length}</p>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {TRACKING_STEPS.map((step, index) => {
                  const isDone = index < currentStep
                  const isCurrent = index === currentStep
                  return (
                    <div key={step.key} className="min-w-0 text-center">
                      <div className="flex items-center">
                        <div className={`h-1.5 flex-1 rounded-full ${index === 0 ? 'invisible' : index <= currentStep ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${isCurrent ? 'border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-100' : isDone ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-300'}`}>
                          {isDone ? '✓' : index + 1}
                        </div>
                        <div className={`h-1.5 flex-1 rounded-full ${index === TRACKING_STEPS.length - 1 ? 'invisible' : index < currentStep ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                      </div>
                      <p className={`mt-3 text-[10px] font-extrabold leading-tight sm:text-xs ${isCurrent ? 'text-emerald-700' : isDone ? 'text-slate-600' : 'text-slate-400'}`}>{step.label}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {order.status === 'awaiting_payment' && (
            <div className="mx-5 my-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:mx-8">
              <p className="font-black text-amber-950">Payment is still pending</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">Use your secure transfer account to complete this order. Your basket is reserved while payment is pending.</p>
              <Link href={`/checkout/${order.id}/pay`} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto">Continue to payment</Link>
            </div>
          )}

          {isProtected && (
            <div className="mx-5 my-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:mx-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-black text-white">✓</div>
              <div>
                <p className="font-black text-emerald-950">Payment protected by Jojokev escrow</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">Your money stays protected until you confirm that the order has arrived. Never confirm delivery before checking your items.</p>
                {order.status === 'delivered' && <ConfirmDeliveryButton orderId={order.id} />}
              </div>
            </div>
          )}

          <section className="mx-5 mb-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-5 sm:mx-8 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Purchase summary</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Items in this order</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">{items?.length ?? 0} item{(items?.length ?? 0) === 1 ? '' : 's'}</span>
            </div>
            <ul className="divide-y divide-slate-200/80 rounded-xl border border-slate-200 bg-white px-4">
              {(items ?? []).map(item => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0"><p className="font-bold text-slate-950">{item.product_title}</p><p className="mt-1 text-sm text-slate-500">{item.quantity} × {formatNaira(item.unit_price_kobo)}</p></div>
                  <p className="shrink-0 font-black text-slate-950">{formatNaira(item.line_total_kobo)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold text-slate-900">{formatNaira(order.subtotal_kobo)}</dd></div>
              <div className="flex justify-between"><dt>Delivery fee</dt><dd className="font-semibold text-slate-900">{formatNaira(order.delivery_fee_kobo)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-4 text-base font-black text-slate-950"><dt>Total paid</dt><dd className="text-emerald-700">{formatNaira(order.total_kobo)}</dd></div>
            </dl>
          </section>

          {address && (
            <section className="mx-5 mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:mx-8 sm:p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">Delivery details</p>
              <div className="mt-4 flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">⌖</div>
                <div className="min-w-0 text-sm">
                  <h2 className="font-black text-slate-950">Delivering to {address.full_name}</h2>
                  <p className="mt-1 text-slate-600">{address.street}, {address.city}, {address.state}{address.landmark && <> · {address.landmark}</>}</p>
                  <p className="mt-2 font-semibold text-slate-800">{address.phone}</p>
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  )
}
