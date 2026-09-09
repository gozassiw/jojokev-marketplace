'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatNaira } from '@/lib/money'

type VA = {
  accountNumber: string
  bankName: string
  accountName?: string
  amountKobo: number
  expiresAt: string
  reference: string
}

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])
  return secondsLeft
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text) } catch {}
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-xs rounded border px-2 py-1 bg-white hover:bg-neutral-50"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

export default function PaymentView({ orderId }: { orderId: string }) {
  const [va, setVa] = useState<VA | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const router = useRouter()
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const secondsLeft = useCountdown(va?.expiresAt ?? null)
  const expired = va ? secondsLeft <= 0 : false

  const issueAccount = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/checkout/${orderId}`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Could not start payment. Please try again.')
      setLoading(false)
      return null
    }
    setVa(json)
    setLoading(false)
    return json as VA
  }, [orderId])

  // issue (or reuse) the virtual account on mount
  useEffect(() => {
    issueAccount()
  }, [issueAccount])

  // poll order status every 5 seconds
  useEffect(() => {
    if (!va) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        const json = await res.json()
        if (json.status && json.status !== 'awaiting_payment') {
          if (pollRef.current) clearInterval(pollRef.current)
          router.push(`/orders/${orderId}?paid=1`)
        }
      } catch {}
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [va, orderId, router])

  async function regenerate() {
    setRegenerating(true)
    // force expiry into the past by clearing local state; the server issues a
    // new reference because the stored one has expired
    setVa(null)
    setLoading(true)
    await issueAccount()
    setRegenerating(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-neutral-500 text-sm">Generating your one-time account…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 text-sm mb-4">{error}</p>
        <button type="button" onClick={() => { setLoading(true); issueAccount() }}
                className="bg-emerald-600 text-white rounded-md px-4 py-2 text-sm font-medium">
          Try again
        </button>
      </div>
    )
  }

  if (!va) return null

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 space-y-5">
        {/* Amount */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Transfer exactly</p>
          <p className="text-4xl font-bold text-emerald-700">{formatNaira(va.amountKobo)}</p>
          <div className="mt-2"><CopyButton text={(va.amountKobo / 100).toFixed(2)} /></div>
        </div>

        {/* Account */}
        <div className="rounded-lg bg-neutral-50 border p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Account number</p>
          <p className="text-3xl font-mono font-semibold tracking-wider">{va.accountNumber}</p>
          <div className="mt-2"><CopyButton text={va.accountNumber} /></div>
          <p className="mt-3 text-sm font-medium">{va.bankName}</p>
          {va.accountName && <p className="text-xs text-neutral-500">{va.accountName}</p>}
        </div>

        {/* Countdown */}
        <div className="text-center">
          {expired ? (
            <p className="text-red-600 font-medium">This account has expired.</p>
          ) : (
            <p className="text-sm">
              Expires in <span className="font-mono font-bold text-amber-600">{mm}:{ss}</span>
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Estimated delivery time: 24–48 hours after payment and rider dispatch.</div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        Transfer <strong>exactly {formatNaira(va.amountKobo)}</strong> to the account above from
        your bank app. A different amount will be reversed automatically.
        This account {expired ? 'has expired' : `expires in ${mm}:${ss}`} and can only be used for this order.
      </div>

      {expired ? (
        <button type="button" onClick={regenerate} disabled={regenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md py-3 disabled:opacity-50">
          {regenerating ? 'Generating…' : 'Regenerate account'}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          Waiting for your transfer… this page updates automatically.
        </div>
      )}
    </div>
  )
}
