'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDeliveryArea, toggleDeliveryArea, updateDeliveryArea, type DeliveryArea } from '@/app/actions/deliveryAreas'
import { formatNaira } from '@/lib/money'

const empty = { name: '', city: '', state: '', customer_fee: '', rider_quote: '' }

export default function AdminDeliveryAreas({ areas }: { areas: DeliveryArea[] }) {
  const router = useRouter()
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#16845f] focus:ring-2 focus:ring-emerald-100'

  async function save() {
    setBusy(true); setMessage('')
    const fd = new FormData()
    Object.entries(form).forEach(([key, value]) => fd.set(key, value))
    const result = editing ? await updateDeliveryArea(editing, fd) : await createDeliveryArea({}, fd)
    setMessage(result.error || result.success || '')
    if (result.success) { setForm(empty); setEditing(null); router.refresh() }
    setBusy(false)
  }

  function edit(area: DeliveryArea) {
    setEditing(area.id)
    setForm({ name: area.name, city: area.city, state: area.state, customer_fee: String(area.customer_fee_kobo / 100), rider_quote: String(area.rider_quote_kobo / 100) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggle(area: DeliveryArea) {
    setBusy(true); setMessage('')
    const result = await toggleDeliveryArea(area.id, !area.is_active)
    setMessage(result.error || result.success || '')
    setBusy(false); router.refresh()
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Delivery pricing</p><h2 className="mt-1 text-xl font-black text-slate-900">{editing ? 'Edit delivery area' : 'Add a delivery area'}</h2><p className="mt-1 text-sm text-slate-500">The customer fee is shown at checkout. The rider quote is the internal payout offer.</p></div>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty) }} className="text-sm font-bold text-slate-500">Cancel edit</button>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">Area name<input className={field} placeholder="Ikeja Mainland" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">City<input className={field} placeholder="Ikeja" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">State<input className={field} placeholder="Lagos" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">Customer delivery fee (₦)<input className={field} inputMode="decimal" placeholder="2000" value={form.customer_fee} onChange={e => setForm({ ...form, customer_fee: e.target.value })} /></label>
        <label className="text-sm font-semibold text-slate-700">Rider quote (₦)<input className={field} inputMode="decimal" placeholder="1500" value={form.rider_quote} onChange={e => setForm({ ...form, rider_quote: e.target.value })} /></label>
        <div className="flex items-end"><button type="button" onClick={save} disabled={busy} className="w-full rounded-xl bg-[#16845f] px-4 py-3 text-sm font-black text-white hover:bg-[#0f6e4e] disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add area'}</button></div>
      </div>
      {message && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p>}
    </section>
    <section className="space-y-3"><div className="flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Configured areas</p><h2 className="mt-1 text-xl font-black text-slate-900">Customer fees and rider offers</h2></div><span className="text-sm text-slate-500">{areas.length} area{areas.length === 1 ? '' : 's'}</span></div>{!areas.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No delivery areas yet. Add your first service area above.</div> : areas.map(area => <article key={area.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${area.is_active ? 'border-slate-200' : 'border-amber-200 opacity-70'}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-slate-900">{area.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${area.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{area.is_active ? 'Active' : 'Disabled'}</span></div><p className="mt-1 text-sm text-slate-500">{area.city}, {area.state}</p></div><div className="flex gap-2"><button type="button" onClick={() => edit(area)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Edit</button><button type="button" disabled={busy} onClick={() => toggle(area)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">{area.is_active ? 'Disable' : 'Enable'}</button></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Customer pays</p><p className="mt-1 text-xl font-black text-slate-900">{formatNaira(area.customer_fee_kobo)}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Rider offer</p><p className="mt-1 text-xl font-black text-slate-900">{formatNaira(area.rider_quote_kobo)}</p></div></div></article>)}</section>
  </div>
}
