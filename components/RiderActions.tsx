'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { riderMarkOutForDelivery, riderMarkPickedUp, riderVerifyDeliveryCode } from '@/app/actions/dispatch'

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
    setBusy(false)
    router.refresh()
  }

  return <div className="space-y-3">
    {status === 'assigned' && <button disabled={busy} onClick={() => run(() => riderMarkPickedUp(orderId))} className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-[#14251e] bg-[#14251e] px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-[#0b5d43] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Updating pickup…' : 'ITEM PICKED UP'}</button>}
    {status === 'picked_up' && <button disabled={busy} onClick={() => run(() => riderMarkOutForDelivery(orderId))} className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-[#14805d] bg-[#14805d] px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-[#0b5d43] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Updating route…' : 'OUT FOR DELIVERY'}</button>}
    {(status === 'out_for_delivery' || status === 'arrived') && <div className="space-y-3"><div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">The buyer’s delivery code has been sent to their private Jojokev notifications. Ask the buyer to open it only when you are physically with them. Never ask for the code before arrival.</div><div className="rounded-2xl border-2 border-[#d99032] bg-[#fffaf0] p-4"><p className="mb-3 text-xs font-extrabold uppercase tracking-[.16em] text-[#8a5a00]">Buyer confirmation required</p><div className="flex flex-col gap-2 sm:flex-row"><input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="Enter buyer’s 6-digit code" className="min-w-0 flex-1 rounded-xl border-2 border-[#d99032]/40 bg-white px-3 py-3 text-sm outline-none focus:border-[#d99032]" /><button disabled={busy || code.length !== 6} onClick={() => run(() => riderVerifyDeliveryCode(orderId, code))} className="min-h-14 rounded-2xl border-2 border-[#d99032] bg-[#d99032] px-5 py-3 text-sm font-black text-[#14251e] shadow-md transition hover:bg-[#f0b54a] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'VERIFYING…' : 'COMPLETE DELIVERY'}</button></div></div></div>}
    {status === 'delivered' && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">Delivery completed with the buyer code. Rider earnings have been released from hold.</p>}
    {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
    {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
  </div>
}
