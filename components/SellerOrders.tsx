'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markShipped, markDelivered } from '@/app/actions/orders'
import { formatNaira } from '@/lib/money'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import Link from 'next/link'

export default function SellerOrders({ orders }: { orders: any[] }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  async function act(orderId: string, fn: (id: string) => Promise<any>) {
    setBusyId(orderId)
    const result = await fn(orderId)
    setMessage(result)
    setBusyId(null)
    router.refresh()
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">
        No orders yet. Orders containing your products will appear here.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {message.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{message.error}</div>
      )}
      {message.success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message.success}</div>
      )}

      {orders.map(o => (
        <section key={o.id} className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-medium">{o.order_number}</p>
              <p className="text-xs text-neutral-500">{new Date(o.created_at).toLocaleString('en-NG')}</p>
              <p className="mt-1 text-xs font-bold text-emerald-700">Estimated delivery: 24–48 hours</p>
            </div>
            <OrderStatusBadge status={o.status} />
          </div>

          <ul className="divide-y text-sm mb-4">
            {o.myItems.map((i: any) => (
              <li key={i.id} className="flex justify-between py-2">
                <span>{i.product_title} × {i.quantity}</span>
                <span className="font-medium">{formatNaira(i.seller_net_kobo)} <span className="text-xs text-neutral-500">(after commission)</span></span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/seller/orders/${o.id}`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">View order details →</Link>
            {o.status === 'paid' && (
              <button type="button" disabled={busyId === o.id}
                      onClick={() => act(o.id, markShipped)}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">
                Mark out for delivery
              </button>
            )}
            {o.status === 'shipped' && (
              <button type="button" disabled={busyId === o.id}
                      onClick={() => act(o.id, markDelivered)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">
                Mark delivered
              </button>
            )}
            {o.status === 'delivered' && o.auto_release_at && (
              <p className="text-xs text-neutral-500">
                Buyer confirmation is required. Auto-release is scheduled for {new Date(o.auto_release_at).toLocaleString('en-NG')} if the buyer does not confirm.
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
