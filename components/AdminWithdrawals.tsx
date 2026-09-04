'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveWithdrawal, rejectWithdrawal } from '@/app/actions/admin'
import { formatNaira } from '@/lib/money'

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
}

export default function AdminWithdrawals({ withdrawals }: { withdrawals: any[] }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const router = useRouter()

  async function act(id: string, fn: () => Promise<any>) {
    setBusyId(id)
    setMessage(await fn())
    setBusyId(null)
    router.refresh()
  }

  if (withdrawals.length === 0) {
    return <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">No withdrawal requests yet.</div>
  }

  return (
    <div className="space-y-4">
      {message.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{message.error}</div>
      )}
      {message.success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message.success}</div>
      )}

      {withdrawals.map(w => (
        <section key={w.id} className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{formatNaira(w.amount_kobo)}
                <span className="text-sm font-normal text-neutral-500"> → payout {formatNaira(w.net_payout_kobo)} (fee {formatNaira(w.fee_kobo)})</span>
              </p>
              <p className="text-sm text-neutral-600">{(w as any).seller_profiles?.business_name}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {w.bank_name} · {w.account_number} · {w.account_name}
              </p>
              {w.payout_reference && <p className="text-xs text-neutral-400">Ref: {w.payout_reference}</p>}
              {w.failure_reason && <p className="text-xs text-red-600">{w.failure_reason}</p>}
              <p className="text-xs text-neutral-400 mt-1">{new Date(w.created_at).toLocaleString('en-NG')}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[w.status]}`}>
              {w.status}
            </span>
          </div>

          {w.status === 'requested' && (
            <div className="flex gap-3 mt-4">
              <button type="button" disabled={busyId === w.id}
                      onClick={() => act(w.id, () => approveWithdrawal(w.id))}
                      className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                Approve & pay out
              </button>
              <button type="button" disabled={busyId === w.id}
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection?') ?? ''
                        if (reason) act(w.id, () => rejectWithdrawal(w.id, reason))
                      }}
                      className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                Reject
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
