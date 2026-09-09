'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptDeliveryOffer, declineDeliveryOffer } from '@/app/actions/dispatch'
import { formatNaira } from '@/lib/money'

function first(value: any) { return Array.isArray(value) ? value[0] : value }

export default function RiderOfferActions({ offer }: { offer: any }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function act(action: (id: string) => Promise<any>) { setBusy(true); setMessage(''); const result = await action(offer.id); setMessage(result.error || result.success || ''); setBusy(false); router.refresh() }
  const order = first(offer.orders)
  const deliveryArea = first(order?.delivery_areas)
  const items = order?.order_items || []
  const pickupAreas = Array.from(new Map(items.map((item: any) => { const seller = first(item.seller_profiles); const area = first(seller?.store_areas); return [area?.id || seller?.store_area_id || item.seller_id, area] })).values()).filter(Boolean) as any[]
  const pickupText = pickupAreas.length ? pickupAreas.map((area: any) => `${area.name || area.city}${area.city && area.name !== area.city ? `, ${area.city}` : ''}`).join(' · ') : 'Seller store area'
  const deliveryText = deliveryArea ? `${deliveryArea.name || deliveryArea.city}${deliveryArea.city && deliveryArea.name !== deliveryArea.city ? `, ${deliveryArea.city}` : ''}` : first(order?.addresses)?.city || 'Buyer area'
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">New delivery quote</p><dl className="mt-3 space-y-2 text-sm text-slate-700"><div><dt className="text-xs font-black uppercase tracking-wide text-amber-700">Pickup area</dt><dd className="font-semibold">{pickupText}</dd></div><div><dt className="text-xs font-black uppercase tracking-wide text-amber-700">Delivery area</dt><dd className="font-semibold">{deliveryText}</dd></div></dl><p className="mt-3 text-sm font-black text-slate-900">Your quote: {formatNaira(offer.quote_kobo || 0)}</p><p className="mt-1 text-xs font-semibold text-slate-600">Estimated delivery time: 24–48 hours after the quote is accepted.</p><p className="mt-2 text-xs font-bold text-slate-600">Full delivery details will be available after quote is accepted.</p></div><div className="flex shrink-0 flex-col gap-2 sm:min-w-40"><button disabled={busy} onClick={() => act(acceptDeliveryOffer)} className="rounded-xl bg-[#16845f] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? 'Working…' : 'Accept quote'}</button><button disabled={busy} onClick={() => act(declineDeliveryOffer)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50">Decline quote</button></div></div>{message && <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm font-semibold text-slate-700">{message}</p>}</div>
}
