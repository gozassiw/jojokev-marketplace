'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignRider } from '@/app/actions/dispatch'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { formatNaira } from '@/lib/money'

export default function AdminDispatch({ orders, riders }: { orders: any[]; riders: any[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function assign(orderId: string, riderId: string) {
    if (!riderId) return
    setBusy(orderId); setMessage('')
    const result = await assignRider(orderId, riderId)
    setMessage(result.error || result.success || '')
    setBusy(null); router.refresh()
  }
  return <div className="space-y-5"><div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Assign only approved riders. Riders verify delivery with the buyer’s one-time code; staff can monitor every status.</div>{message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}<div className="space-y-3">{!orders.length ? <div className="surface p-10 text-center text-slate-500">No paid orders are waiting for dispatch.</div> : orders.map((o: any) => { const assignment = o.delivery_assignments?.[0]; return <article key={o.id} className="surface p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">{o.order_number}</p><h2 className="mt-2 text-lg font-black">{o.profiles?.full_name || 'Buyer'}</h2><p className="mt-1 text-sm text-slate-500">{formatNaira(o.total_kobo)} · {new Date(o.created_at).toLocaleString('en-NG')}</p></div><OrderStatusBadge status={o.status} /></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><select defaultValue={assignment?.rider_id || ''} onChange={e => assign(o.id, e.target.value)} disabled={busy === o.id} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">{assignment ? 'Change assigned rider…' : 'Assign an approved rider…'}</option>{riders.map((r: any) => <option key={r.id} value={r.id}>{r.profiles?.full_name || 'Rider'} · {r.phone}{r.vehicle_plate ? ` · ${r.vehicle_plate}` : ''}</option>)}</select>{assignment && <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{assignment.status.replaceAll('_', ' ')}</span>}</div></article>})}</div></div>
}
