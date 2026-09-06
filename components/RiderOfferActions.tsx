'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptDeliveryOffer, declineDeliveryOffer } from '@/app/actions/dispatch'
import { formatNaira } from '@/lib/money'

export default function RiderOfferActions({ offer }: { offer: any }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function act(action: (id: string) => Promise<any>) { setBusy(true); setMessage(''); const result = await action(offer.id); setMessage(result.error || result.success || ''); setBusy(false); router.refresh() }
  const order = Array.isArray(offer.orders) ? offer.orders[0] : offer.orders
  const address = Array.isArray(order?.addresses) ? order.addresses[0] : order?.addresses
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">New delivery offer</p><h2 className="mt-2 text-lg font-black text-slate-900">{order?.order_number || 'Delivery job'}</h2><p className="mt-1 text-sm text-slate-700">Pickup and delivery in {offer.delivery_area_name || address?.city || 'your service area'}</p><p className="mt-2 text-sm font-black text-slate-900">Rider quote: {formatNaira(offer.quote_kobo || 0)}</p><p className="mt-1 text-xs text-slate-600">Full addresses and phone numbers appear after you accept.</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => act(acceptDeliveryOffer)} className="rounded-xl bg-[#16845f] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? 'Working…' : 'Accept job'}</button><button disabled={busy} onClick={() => act(declineDeliveryOffer)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50">Decline</button></div></div>{message && <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm font-semibold text-slate-700">{message}</p>}</div>
}
