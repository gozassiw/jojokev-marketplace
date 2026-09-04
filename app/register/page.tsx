'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { registerBuyer, type ActionState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">{pending ? 'Creating account…' : 'Create my account →'}</button>
}

export default function RegisterPage() {
  const [state, formAction] = useFormState<ActionState, FormData>(registerBuyer, {})
  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#f7f8f6] py-8 sm:py-14">
      <div className="page-wrap grid max-w-5xl gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div className="hidden rounded-3xl bg-[#14251e] p-8 text-white lg:block"><span className="eyebrow bg-white/10 text-[#d9f33f]">Welcome to jojokev</span><h1 className="mt-6 text-5xl font-black leading-[.95] tracking-[-.06em]">Shop local.<br /><span className="text-[#d9f33f]">Feel secure.</span></h1><p className="mt-5 text-sm leading-6 text-white/65">A better way to discover products from Nigerian sellers, with escrow protection built into every order.</p><div className="mt-10 space-y-3 text-sm font-semibold text-white/80"><p>✓ Protected bank-transfer checkout</p><p>✓ Seller accountability from start to finish</p><p>✓ Simple order tracking</p></div></div>
        <div className="surface mx-auto w-full max-w-lg p-6 sm:p-9"><p className="section-kicker">Join the community</p><h2 className="text-3xl font-black tracking-tight">Create your account</h2><p className="mt-2 text-sm text-slate-500">Save your details and start shopping trusted local finds.</p>{state.error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error}</div>}<form action={formAction} className="mt-6 space-y-4"><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Full name</label><input name="full_name" type="text" required className="field" placeholder="e.g. Ada Okafor" /></div><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Email address</label><input name="email" type="email" required className="field" placeholder="you@example.com" /></div><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Phone <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></label><input name="phone" type="tel" className="field" placeholder="0800 000 0000" /></div><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Password</label><input name="password" type="password" required minLength={8} className="field" placeholder="At least 8 characters" /></div><SubmitButton /></form><p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-bold text-[#14805d] hover:underline">Log in</Link></p></div>
      </div>
    </div>
  )
}
