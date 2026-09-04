'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { forceRelease } from '@/app/actions/admin'
import { formatNaira } from '@/lib/money'
import OrderStatusBadge from '@/components/OrderStatusBadge'

const STATUSES = ['', 'awaiting_payment', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded']

export default function AdminOrders({ orders, currentStatus }: { orders: any[]; currentStatus: string }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  async function onForceRelease(id: string) {
    if (!window.confirm('Force-release escrow to the seller? Use only for resolved support cases.')) return
    setBusyId(id)
    setMessage(await forceRelease(id))
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <a key={s || 'all'} href={s ? `/admin/orders?status=${s}` : '/admin/orders'}
             className={`rounded-full px-3 py-1 text-xs font-medium border ${
               currentStatus === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white'
             }`}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </a>
        ))}
      </div>

      {message.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{message.error}</div>
      )}
      {message.success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message.success}</div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">No orders found.</div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Buyer</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium">{o.order_number}</td>
                  <td className="px-4 py-3">{(o as any).profiles?.full_name}</td>
                  <td className="px-4 py-3">{formatNaira(o.total_kobo)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {new Date(o.created_at).toLocaleDateString('en-NG')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['paid', 'shipped', 'delivered'].includes(o.status) && (
                      <button type="button" disabled={busyId === o.id}
                              onClick={() => onForceRelease(o.id)}
                              className="text-xs text-emerald-700 underline disabled:opacity-50">
                        Force release
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
