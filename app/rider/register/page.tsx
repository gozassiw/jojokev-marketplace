'use client'

import { useState } from 'react'
import { registerRider } from '@/app/actions/dispatch'

export default function RiderRegisterPage() {
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [pending, setPending] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setState(await registerRider({}, new FormData(event.currentTarget)))
    setPending(false)
  }
  return <main className="min-h-[calc(100vh-160px)] bg-[#f7f8f6] py-10 sm:py-16"><div className="page-wrap max-w-2xl"><div className="surface p-6 sm:p-9"><p className="eyebrow">Become a Jojokev rider</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-4xl">Deliver safely. Earn with every completed drop-off.</h1><p className="mt-3 text-slate-600">Riders collect orders from sellers and complete delivery only after the buyer provides a valid one-time code.</p><form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-sm font-semibold">Phone number<input name="phone" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="080..." /></label><label className="block text-sm font-semibold">Vehicle type<input name="vehicle_type" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Motorbike, car, bicycle" /></label><label className="block text-sm font-semibold">Vehicle plate number<input name="vehicle_plate" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Optional" /></label><div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Never request the buyer’s delivery code before the package is physically with the buyer. Jojokev records every code verification.</div>{state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>}{state.success && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p>}<button disabled={pending} className="action-button action-button-primary w-full disabled:opacity-50">{pending ? 'Submitting…' : 'Submit rider application'}</button></form></div></div></main>
}
