'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readCart, setQuantity, type CartLine } from '@/lib/cart'
import { priceCart, type PricedLine } from '@/app/actions/cart'
import { formatNaira } from '@/lib/money'

type Priced = {
  items: PricedLine[]
  subtotalKobo: number
  deliveryFeeKobo: number
  totalKobo: number
}

export default function CartView() {
  const [priced, setPriced] = useState<Priced | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const lines: CartLine[] = readCart()
    const result = await priceCart(lines)
    setPriced(result)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const onUpdate = () => refresh()
    window.addEventListener('cart-updated', onUpdate)
    return () => window.removeEventListener('cart-updated', onUpdate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <p className="text-neutral-500">Loading cart…</p>

  if (!priced || priced.items.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        <p className="text-neutral-500 mb-4">Your cart is empty.</p>
        <Link href="/" className="text-emerald-700 underline">Continue shopping</Link>
      </div>
    )
  }

  // group by seller so a multi-vendor cart reads clearly
  const bySeller = new Map<string, PricedLine[]>()
  for (const item of priced.items) {
    const list = bySeller.get(item.sellerName) ?? []
    list.push(item)
    bySeller.set(item.sellerName, list)
  }

  const hasStockIssue = priced.items.some(i => !i.inStock)

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        {Array.from(bySeller.entries()).map(([sellerName, items]) => (
          <section key={sellerName} className="rounded-xl border bg-white overflow-hidden">
            <header className="bg-neutral-50 border-b px-4 py-2 text-sm font-medium">
              {sellerName}
            </header>
            <ul className="divide-y">
              {items.map(item => (
                <li key={item.productId} className="flex gap-4 p-4">
                  <div className="w-20 h-20 rounded-md bg-neutral-100 overflow-hidden flex items-center justify-center shrink-0">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl text-neutral-300">🛍️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-sm text-emerald-700 font-semibold mt-1">
                      {formatNaira(item.unitPriceKobo)}
                    </p>
                    {!item.inStock && (
                      <p className="text-xs text-red-600 mt-1">
                        Only {item.stock} left — reduce quantity
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button"
                              onClick={() => setQuantity(item.productId, item.quantity - 1)}
                              className="w-7 h-7 rounded border text-sm">−</button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <button type="button"
                              onClick={() => setQuantity(item.productId, item.quantity + 1)}
                              className="w-7 h-7 rounded border text-sm">+</button>
                      <button type="button"
                              onClick={() => setQuantity(item.productId, 0)}
                              className="ml-3 text-xs text-red-600 underline">Remove</button>
                    </div>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap">
                    {formatNaira(item.lineTotalKobo)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="rounded-xl border bg-white p-5 h-fit sticky top-20">
        <h2 className="font-semibold mb-4">Order summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt><dd>{formatNaira(priced.subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery fee</dt><dd>{formatNaira(priced.deliveryFeeKobo)}</dd>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <dt>Total</dt><dd>{formatNaira(priced.totalKobo)}</dd>
          </div>
        </dl>
        {hasStockIssue ? (
          <p className="mt-4 text-sm text-red-600">
            Some items exceed available stock. Adjust quantities to continue.
          </p>
        ) : (
          <Link href="/checkout"
                className="mt-4 block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md py-2.5">
            Proceed to checkout
          </Link>
        )}
      </aside>
    </div>
  )
}
