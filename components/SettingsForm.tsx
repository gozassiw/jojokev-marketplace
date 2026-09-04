'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateSettings } from '@/app/actions/admin'
import { koboToNaira } from '@/lib/money'

function FeeRow({ label, toggleName, amountName, enabled, amountNaira, suffix }: {
  label: string
  toggleName: string
  amountName: string
  enabled: boolean
  amountNaira: number
  suffix: string
}) {
  const [on, setOn] = useState(enabled)
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" name={toggleName} className="peer sr-only"
               checked={on} onChange={e => setOn(e.target.checked)} />
        <div className="h-6 w-11 rounded-full bg-neutral-300 peer-checked:bg-emerald-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
      </label>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <div className="flex items-center gap-1">
        <input name={amountName} type="number" min="0" step="0.01"
               defaultValue={amountNaira}
               className="w-28 rounded-md border px-2 py-1.5 text-sm text-right" />
        <span className="text-sm text-neutral-500">{suffix}</span>
      </div>
    </div>
  )
}

export default function SettingsForm({ settings }: { settings: any }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({})
  const [pending, setPending] = useState(false)
  const [pod, setPod] = useState<boolean>(settings?.pay_on_delivery_enabled ?? false)
  const router = useRouter()

  async function onSubmit(formData: FormData) {
    setPending(true)
    setMessage(await updateSettings(formData))
    setPending(false)
    router.refresh()
  }

  if (!settings) {
    return <div className="rounded-xl border bg-white p-6 text-neutral-500">Settings row missing — did 01_schema.sql run?</div>
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {message.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{message.error}</div>
      )}
      {message.success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{message.success}</div>
      )}

      <FeeRow label="Commission" toggleName="commission_enabled" amountName="commission_percent"
              enabled={settings.commission_enabled} amountNaira={Number(settings.commission_percent)} suffix="% of subtotal" />
      <FeeRow label="Delivery fee" toggleName="delivery_fee_enabled" amountName="delivery_fee"
              enabled={settings.delivery_fee_enabled} amountNaira={koboToNaira(settings.delivery_fee_kobo)} suffix="₦ per order" />
      <FeeRow label="Withdrawal fee" toggleName="withdrawal_fee_enabled" amountName="withdrawal_fee"
              enabled={settings.withdrawal_fee_enabled} amountNaira={koboToNaira(settings.withdrawal_fee_kobo)} suffix="₦ flat" />
      <FeeRow label="Listing fee" toggleName="listing_fee_enabled" amountName="listing_fee"
              enabled={settings.listing_fee_enabled} amountNaira={koboToNaira(settings.listing_fee_kobo)} suffix="₦ per listing" />

      <div className="flex items-center gap-4 rounded-lg border p-4">
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" name="pay_on_delivery_enabled" className="peer sr-only"
                 checked={pod} onChange={e => setPod(e.target.checked)} />
          <div className="h-6 w-11 rounded-full bg-neutral-300 peer-checked:bg-emerald-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
        </label>
        <div>
          <p className="text-sm font-medium">Pay on delivery</p>
          <p className="text-xs text-neutral-500">Enable only when logistics exist to support it.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <label className="block text-sm font-medium mb-1">Escrow auto-release (days)</label>
          <input name="auto_release_days" type="number" min="0"
                 defaultValue={settings.auto_release_days}
                 className="w-full rounded-md border px-3 py-2" />
        </div>
        <div className="rounded-lg border p-4">
          <label className="block text-sm font-medium mb-1">Minimum withdrawal (₦)</label>
          <input name="min_withdrawal" type="number" min="0"
                 defaultValue={koboToNaira(settings.min_withdrawal_kobo)}
                 className="w-full rounded-md border px-3 py-2" />
        </div>
      </div>

      <button type="submit" disabled={pending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md px-6 py-2.5 disabled:opacity-50">
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
