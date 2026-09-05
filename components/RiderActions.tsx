'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { riderMarkArrived, riderMarkOutForDelivery, riderMarkPickedUp, riderVerifyDeliveryCode } from '@/app/actions/dispatch'

export default function RiderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<any>) {
    setBusy(true); setError(null); setMessage(null)
    const result = await action()
    if (result?.error) setError(result.error)
    if (result?.success) setMessage(result.success)
    setBusy(false); router.refresh()
  }

  return <div className="space-y-3">
    {status === 'assigned' && <button disabled={busy} onClick={() => run(() => riderMarkPickedUp(orderId))} className="action-button action-button-dark disabled:opacity-50">{busy ? 'Updating…' : 'Confirm pickup'}</button>}
    {status === 'picked_up' && <button disabled={busy} onClick={() => run(() => riderMarkOutForDelivery(orderId))} className="action-button action-button-primary disabled:opacity-50">{busy ? 'Updating…' : 'Mark out for delivery'}</button>}
    {status === 'out_for_delivery' && <button disabled={busy} onClick={() => run(() => riderMarkArrived(orderId))} className="action-button action-button-primary disabled:opacity-50">{busy ? 'Generating code…' : 'I have arrived'}</button>}
    {status === 'arrived' && <div className="space-y-2"><p className="text-sm font-semibold text-amber-800">Ask the buyer to open their Jojokev notifications. Never ask for the code before the package is physically with them.</p><div className="flex gap-2"><input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button disabled={busy || code.length !== 6} onClick={() => run(() => riderVerifyDeliveryCode(orderId, code))} className="action-button action-button-primary disabled:opacity-50">{busy ? 'Verifying…' : 'Verify & deliver'}</button></div></div>}
    {status === 'delivered' && <p className="text-sm font-semibold text-emerald-700">Delivered with buyer code. Waiting for buyer receipt confirmation.</p>}
    {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
    {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
  </div>
}
