'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveRider, suspendRider } from '@/app/actions/dispatch'

export default function AdminRiders({ riders }: { riders: any[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function run(id: string, action: (id: string) => Promise<any>) { setBusy(id); const result = await action(id); setMessage(result.error || result.success || ''); setBusy(null); router.refresh() }
  return <div className="space-y-4">{message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{!riders.length ? <div className="surface p-10 text-center text-slate-500">No rider applications yet.</div> : riders.map((r: any) => <article key={r.id} className="surface flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">{r.status}</p><h2 className="mt-2 text-lg font-black">{r.profiles?.full_name || 'Rider applicant'}</h2><p className="mt-1 text-sm text-slate-600">{r.phone} · {r.vehicle_type || 'Vehicle not provided'} {r.vehicle_plate ? `· ${r.vehicle_plate}` : ''}</p></div><div className="flex gap-2">{r.status === 'pending' && <button disabled={busy === r.id} onClick={() => run(r.id, approveRider)} className="action-button action-button-primary disabled:opacity-50">Approve</button>}{r.status === 'approved' && <button disabled={busy === r.id} onClick={() => run(r.id, suspendRider)} className="action-button action-button-dark disabled:opacity-50">Suspend</button>}</div></article>)}</div>
}
