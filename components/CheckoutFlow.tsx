'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { readCart, clearCart } from '@/lib/cart'
import { priceCart, type PricedLine } from '@/app/actions/cart'
import { createOrder } from '@/app/actions/orders'
import { createCheckoutAddress } from '@/app/actions/addresses'
import { type DeliveryArea } from '@/app/actions/deliveryAreas'
import { formatNaira } from '@/lib/money'

type Address = { id: string; full_name: string; phone: string; street: string; city: string; state: string; landmark: string | null; is_default: boolean }
type DeliveryForm = { fullName: string; phone: string; state: string; city: string; street: string; landmark: string }
const emptyDelivery: DeliveryForm = { fullName: '', phone: '', state: '', city: '', street: '', landmark: '' }

export default function CheckoutFlow({ addresses, areas }: { addresses: Address[]; areas: DeliveryArea[] }) {
  const router = useRouter()
  const [items, setItems] = useState<PricedLine[]>([])
  const [subtotalKobo, setSubtotalKobo] = useState(0)
  const [deliveryFeeKobo, setDeliveryFeeKobo] = useState(0)
  const [totalKobo, setTotalKobo] = useState(0)
  const [addressId, setAddressId] = useState(addresses.find(a => a.is_default)?.id ?? addresses[0]?.id ?? '')
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0)
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '')
  const [delivery, setDelivery] = useState<DeliveryForm>(emptyDelivery)
  const [error, setError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const priced = await priceCart(readCart())
      setItems(priced.items)
      setSubtotalKobo(priced.subtotalKobo)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    const selected = areas.find(area => area.id === areaId)
    const fee = selected?.customer_fee_kobo ?? 0
    setDeliveryFeeKobo(fee)
    setTotalKobo(subtotalKobo + fee)
    if (selected && useNewAddress) setDelivery(current => ({ ...current, city: selected.city, state: selected.state }))
  }, [areaId, areas, subtotalKobo, useNewAddress])

  function updateDelivery(field: keyof DeliveryForm, value: string) { setDelivery(current => ({ ...current, [field]: value })) }

  async function placeOrder() {
    setError(null)
    if (!areaId) { setError('Choose a delivery area before continuing.'); return }
    setPlacing(true)
    let selectedAddressId = addressId
    if (useNewAddress) {
      const saved = await createCheckoutAddress(delivery)
      if (saved.error || !saved.addressId) { setError(saved.error || 'Enter your delivery details.'); setPlacing(false); return }
      selectedAddressId = saved.addressId
    }
    if (!selectedAddressId) { setError('Choose or enter a delivery address before continuing.'); setPlacing(false); return }
    const result = await createOrder(readCart(), selectedAddressId, areaId)
    if (result.error) { setError(result.error); setPlacing(false); return }
    clearCart()
    router.push(`/checkout/${result.orderId}/pay`)
  }

  if (loading) return <p className="text-sm text-slate-500">Loading your order…</p>
  if (!items.length) return <div className="rounded-2xl border bg-white p-10 text-center"><p className="mb-4 text-slate-500">Your cart is empty.</p><Link href="/" className="font-semibold text-emerald-700 underline">Continue shopping</Link></div>

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
  return <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
    <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Step 1</p><h2 className="mt-1 text-xl font-black text-slate-900">Delivery details</h2><p className="mt-1 text-sm text-slate-500">Choose where your order should be delivered. Fees are set by Jojokev for each area.</p></div>
      {!areas.length && <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Delivery is not available in any area yet. Please try again later.</div>}
      {areas.length > 0 && <label className="mb-5 block text-sm font-semibold text-slate-700">Delivery area<select value={areaId} onChange={e => setAreaId(e.target.value)} className={inputClass}><option value="">Choose your delivery area</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name} · {area.city}, {area.state} — {formatNaira(area.customer_fee_kobo)}</option>)}</select></label>}
      {addresses.length > 0 && !useNewAddress && <div className="space-y-3">{addresses.map(a => <label key={a.id} className={`block cursor-pointer rounded-xl border p-4 ${addressId === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}><input type="radio" name="address" className="mr-2" checked={addressId === a.id} onChange={() => setAddressId(a.id)} /><span className="font-semibold text-slate-900">{a.full_name}</span><span className="text-sm text-slate-600"> · {a.phone}</span><p className="ml-5 mt-1 text-sm text-slate-600">{a.street}, {a.city}, {a.state}{a.landmark && <> · {a.landmark}</>}</p></label>)}<button type="button" onClick={() => setUseNewAddress(true)} className="text-sm font-bold text-emerald-700">+ Use a different delivery address</button></div>}
      {useNewAddress && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Full name<input value={delivery.fullName} onChange={e => updateDelivery('fullName', e.target.value)} className={inputClass} autoComplete="name" /></label><label className="text-sm font-semibold text-slate-700">Phone number<input value={delivery.phone} onChange={e => updateDelivery('phone', e.target.value)} className={inputClass} inputMode="tel" autoComplete="tel" /></label><label className="text-sm font-semibold text-slate-700">State<input value={delivery.state} onChange={e => updateDelivery('state', e.target.value)} className={inputClass} autoComplete="address-level1" /></label><label className="text-sm font-semibold text-slate-700">City / area<input value={delivery.city} onChange={e => updateDelivery('city', e.target.value)} className={inputClass} autoComplete="address-level2" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Delivery address<input value={delivery.street} onChange={e => updateDelivery('street', e.target.value)} className={inputClass} autoComplete="street-address" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Landmark <span className="font-normal text-slate-400">(optional)</span><input value={delivery.landmark} onChange={e => updateDelivery('landmark', e.target.value)} className={inputClass} /></label>{addresses.length > 0 && <button type="button" onClick={() => setUseNewAddress(false)} className="text-left text-sm font-bold text-emerald-700 sm:col-span-2">Use a saved address instead</button>}</div>}
    </section>
    <section className="h-fit rounded-2xl border bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-28"><div className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Step 2</p><h2 className="mt-1 text-xl font-black text-slate-900">Review and pay</h2></div><ul className="divide-y divide-slate-100">{items.map(i => <li key={i.productId} className="flex justify-between gap-4 py-3 text-sm"><span className="text-slate-600">{i.title} × {i.quantity}</span><span className="font-semibold text-slate-900">{formatNaira(i.lineTotalKobo)}</span></li>)}</ul><dl className="mt-3 space-y-2 border-t border-slate-100 pt-4 text-sm"><div className="flex justify-between"><dt className="text-slate-600">Items</dt><dd>{formatNaira(subtotalKobo)}</dd></div><div className="flex justify-between"><dt className="text-slate-600">Delivery fee</dt><dd>{formatNaira(deliveryFeeKobo)}</dd></div><div className="flex justify-between border-t border-slate-100 pt-3 text-lg font-black"><dt>Total</dt><dd>{formatNaira(totalKobo)}</dd></div></dl>{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<button type="button" onClick={placeOrder} disabled={placing || !areaId || !areas.length || (!useNewAddress && !addressId)} className="mt-5 w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50">{placing ? 'Preparing secure payment…' : `Pay Now · ${formatNaira(totalKobo)}`}</button><p className="mt-4 text-center text-xs leading-5 text-slate-500">Your payment is protected until your order is delivered. You will receive a one-time bank account for the exact amount.</p></section>
  </div>
}
