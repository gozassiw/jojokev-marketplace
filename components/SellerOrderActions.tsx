'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markDelivered, markShipped } from '@/app/actions/orders'

export default function SellerOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: (id: string) => Promise<any>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    const result = await action(orderId)
    if (result?.error) setError(result.error)
    if (result?.success) setMessage(result.success)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {status === 'paid' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(markShipped)} className="action-button action-button-dark disabled:opacity-50">{busy ? 'Updating…' : 'Mark shipped'}</button>
          <button type="button" disabled={busy} onClick={() => run(markDelivered)} className="action-button action-button-primary disabled:opacity-50">Mark delivered</button>
        </div>
      )}
      {status === 'shipped' && <button type="button" disabled={busy} onClick={() => run(markDelivered)} className="action-button action-button-primary disabled:opacity-50">{busy ? 'Updating…' : 'Mark delivered'}</button>}
      {status === 'delivered' && <p className="text-sm text-slate-600">Waiting for the buyer to confirm delivery. Escrow remains protected until confirmation.</p>}
      {status === 'completed' && <p className="text-sm text-emerald-700">Delivery confirmed. Funds have been released to your available wallet balance.</p>}
    </div>
  )
}
