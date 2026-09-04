'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '@/lib/cart'

export default function AddToCartButton({ productId, disabled }: { productId: string; disabled?: boolean }) {
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const router = useRouter()

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex items-center border rounded-md">
        <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg">−</button>
        <span className="px-3 min-w-[2rem] text-center">{qty}</span>
        <button type="button" onClick={() => setQty(q => q + 1)}
                className="px-3 py-2 text-lg">+</button>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          addToCart(productId, qty)
          setAdded(true)
          setTimeout(() => setAdded(false), 1500)
        }}
        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md py-2.5 disabled:opacity-50"
      >
        {disabled ? 'Out of stock' : added ? 'Added ✓' : 'Add to basket'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          addToCart(productId, qty)
          router.push('/checkout')
        }}
        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-md py-2.5 disabled:opacity-50"
      >
        Buy now — delivery details
      </button>
    </div>
  )
}
