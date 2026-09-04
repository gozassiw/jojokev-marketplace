'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { addAddress, deleteAddress, type ActionState } from '@/app/actions/addresses'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md px-5 py-2.5 disabled:opacity-50">
      {pending ? 'Saving…' : 'Save address'}
    </button>
  )
}

export default function AddressBook({ addresses }: { addresses: any[] }) {
  const [state, formAction] = useFormState<ActionState, FormData>(addAddress, {})
  const router = useRouter()

  async function onDelete(id: string) {
    await deleteAddress(id)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map(a => (
            <li key={a.id} className="rounded-xl border bg-white p-4 flex justify-between gap-4">
              <div>
                <p className="font-medium">
                  {a.full_name}
                  {a.is_default && (
                    <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">Default</span>
                  )}
                </p>
                <p className="text-sm text-neutral-600">{a.phone}</p>
                <p className="text-sm text-neutral-600">
                  {a.street}, {a.city}, {a.state}
                  {a.landmark && <> ({a.landmark})</>}
                </p>
              </div>
              <button type="button" onClick={() => onDelete(a.id)}
                      className="text-sm text-red-600 underline self-start">Delete</button>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold mb-4">Add a new address</h2>

        {state.error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
            {state.success}
          </div>
        )}

        <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full name *</label>
            <input name="full_name" required className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone *</label>
            <input name="phone" required className="w-full rounded-md border px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Street address *</label>
            <input name="street" required className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City *</label>
            <input name="city" required className="w-full rounded-md border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State *</label>
            <input name="state" required className="w-full rounded-md border px-3 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Landmark (optional)</label>
            <input name="landmark" className="w-full rounded-md border px-3 py-2" />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_default" className="rounded" />
            Set as default address
          </label>
          <div className="sm:col-span-2">
            <SaveButton />
          </div>
        </form>
      </section>
    </div>
  )
}
