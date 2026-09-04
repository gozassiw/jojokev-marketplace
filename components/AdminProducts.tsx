'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { formatNaira } from '@/lib/money'

export default function AdminProducts({ products }: { products: any[] }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function delist(id: string) {
    if (!window.confirm('Delist this product? It will disappear from the storefront.')) return
    setBusyId(id)
    setError(null)
    // admin RLS policy allows this via the browser client
    const { error } = await supabaseBrowser()
      .from('products').update({ status: 'delisted' }).eq('id', id)
    if (error) setError(error.message)
    setBusyId(null)
    router.refresh()
  }

  if (products.length === 0) {
    return <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">No products listed yet.</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Seller</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-3 max-w-[16rem] truncate">{p.title}</td>
                <td className="px-4 py-3">{(p as any).seller_profiles?.business_name}</td>
                <td className="px-4 py-3">{formatNaira(p.price_kobo)}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === 'active' ? 'bg-emerald-100 text-emerald-800'
                    : p.status === 'draft' ? 'bg-neutral-100 text-neutral-700'
                    : p.status === 'out_of_stock' ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                  }`}>{p.status.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.status !== 'delisted' && (
                    <button type="button" disabled={busyId === p.id}
                            onClick={() => delist(p.id)}
                            className="text-xs text-red-600 underline disabled:opacity-50">
                      Delist
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
