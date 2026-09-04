'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { login, type ActionState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">{pending ? 'Signing you in…' : 'Log in →'}</button>
}

export default function LoginPage({ searchParams }: { searchParams?: { next?: string } }) {
  const [state, formAction] = useFormState<ActionState, FormData>(login, {})
  const nextPath = searchParams?.next && searchParams.next.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : ''
  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#f7f8f6] py-8 sm:py-14"><div className="page-wrap grid max-w-5xl gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center"><div className="surface order-2 p-6 sm:p-9 lg:order-1"><p className="section-kicker">Welcome back</p><h1 className="text-3xl font-black tracking-tight">Log in to Jojokev</h1><p className="mt-2 text-sm text-slate-500">Pick up where you left off — your cart and orders are waiting.</p>{state.error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</div>}<form action={formAction} className="mt-6 space-y-4"><input type="hidden" name="next" value={nextPath} /><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Email address</label><input name="email" type="email" required className="field" placeholder="you@example.com" /></div><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Password</label><input name="password" type="password" required className="field" placeholder="Your password" /></div><SubmitButton /></form><div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" />New to Jojokev?<span className="h-px flex-1 bg-slate-200" /></div><Link href="/register" className="btn-secondary w-full">Create an account</Link></div><div className="order-1 rounded-3xl bg-[#14805d] p-8 text-white lg:order-2"><span className="eyebrow bg-white/15 text-[#d9f33f]">Your marketplace, your way</span><h2 className="mt-6 text-4xl font-black leading-none tracking-[-.05em]">Good to see<br /><span className="text-[#d9f33f]">you again.</span></h2><p className="mt-5 text-sm leading-6 text-white/75">Shop from independent sellers, track every order and stay protected with escrow.</p><div className="mt-10 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-2xl">🛡️</p><p className="mt-2 text-xs font-bold">Escrow protected</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-2xl">🚚</p><p className="mt-2 text-xs font-bold">Track your orders</p></div></div></div></div></div>
  )
}
