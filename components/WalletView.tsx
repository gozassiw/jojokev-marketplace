'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestWithdrawal } from '@/app/actions/escrow'
import { formatNaira } from '@/lib/money'

const TXN_LABELS: Record<string, string> = {
  sale_hold: 'Sale (held in escrow)',
  hold_release: 'Escrow released',
  commission: 'Commission',
  withdrawal: 'Withdrawal',
  withdrawal_fee: 'Withdrawal fee',
  refund_reversal: 'Refund / reversal',
  adjustment: 'Adjustment',
}

export default function WalletView({
  wallet,
  transactions,
  withdrawals,
  pendingPayoutsKobo,
  bankAccount,
}: {
  wallet: any
  transactions: any[]
  withdrawals: any[]
  pendingPayoutsKobo: number
  bankAccount: { bank_name: string | null; account_number: string | null; account_name: string | null } | null
}) {
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<{ error?: string; success?: string }>({})
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function onWithdraw() {
    setMessage({})
    setPending(true)
    const result = await requestWithdrawal(Number(amount))
    setMessage(result)
    if (result.success) setAmount('')
    setPending(false)
    router.refresh()
  }

  const stats = [
    { label: 'On hold', value: formatNaira(wallet?.hold_balance_kobo ?? 0), hint: 'Sold, awaiting delivery confirmation' },
    { label: 'Available', value: formatNaira(wallet?.available_balance_kobo ?? 0), hint: 'Ready to withdraw now' },
    { label: 'Lifetime earned', value: formatNaira(wallet?.lifetime_earned_kobo ?? 0), hint: 'Total after commission' },
    { label: 'Pending payouts', value: formatNaira(pendingPayoutsKobo), hint: 'Being processed' },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border bg-white p-4">
            <div className="text-lg font-semibold">{s.value}</div>
            <div className="text-xs uppercase tracking-wide text-neutral-500 mt-1">{s.label}</div>
            <div className="text-xs text-neutral-400 mt-1">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Withdrawal */}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold mb-1">Withdraw funds</h2>
        <p className="text-sm text-neutral-500 mb-4">
          {bankAccount
            ? <>Payouts go to {bankAccount.bank_name} · {bankAccount.account_number} · {bankAccount.account_name}</>
            : 'Add your bank account details in your seller profile before withdrawing.'}
        </p>

        {message.error && (
          <div className="mb-3 rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{message.error}</div>
        )}
        {message.success && (
          <div className="mb-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message.success}</div>
        )}

        <div className="flex gap-3">
          <input
            type="number" min="0" step="0.01" placeholder="Amount in ₦"
            value={amount} onChange={e => setAmount(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2.5"
          />
          <button type="button" onClick={onWithdraw}
                  disabled={pending || !amount || !bankAccount}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md px-5 py-2.5 disabled:opacity-50">
            {pending ? 'Requesting…' : 'Withdraw'}
          </button>
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          A ₦100 withdrawal fee applies. Minimum withdrawal ₦1,000.
        </p>
      </section>

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <section className="rounded-xl border bg-white overflow-hidden">
          <h2 className="font-semibold px-5 pt-4 pb-2">Withdrawal history</h2>
          <ul className="divide-y text-sm">
            {withdrawals.map(w => (
              <li key={w.id} className="flex justify-between px-5 py-3">
                <div>
                  <p className="font-medium">{formatNaira(w.amount_kobo)}</p>
                  <p className="text-xs text-neutral-500">{new Date(w.created_at).toLocaleString('en-NG')}</p>
                </div>
                <span className={`self-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  w.status === 'paid' ? 'bg-emerald-100 text-emerald-800'
                  : w.status === 'rejected' || w.status === 'failed' ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
                }`}>{w.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ledger */}
      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="font-semibold px-5 pt-4 pb-2">Transaction ledger</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-neutral-500 px-5 pb-5">No transactions yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {transactions.map(t => (
              <li key={t.id} className="flex justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{TXN_LABELS[t.type] ?? t.type}</p>
                  <p className="text-xs text-neutral-500 truncate">{t.description}</p>
                  <p className="text-xs text-neutral-400">{new Date(t.created_at).toLocaleString('en-NG')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold ${t.amount_kobo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {t.amount_kobo >= 0 ? '+' : ''}{formatNaira(t.amount_kobo)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    Hold {formatNaira(t.balance_after_hold_kobo)} · Avail {formatNaira(t.balance_after_available_kobo)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
