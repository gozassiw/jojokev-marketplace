'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmDelivery } from '@/app/actions/escrow'

export default function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function onConfirm() {
    if (!window.confirm('Confirm you have received this order? This releases payment to the seller.')) return
    setPending(true)
    const result = await confirmDelivery(orderId)
    setState(result)
    setPending(false)
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Confirming…' : 'I have received my order'}
      </button>
      {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-700 mt-2">{state.success}</p>}
    </div>
  )
}
