'use client'

import { useEffect, useState } from 'react'
import { cartCount } from '@/lib/cart'

export default function CartBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const update = () => setCount(cartCount())
    update()
    window.addEventListener('cart-updated', update)
    return () => window.removeEventListener('cart-updated', update)
  }, [])

  if (!count) return null
  return (
    <span className="absolute -top-2 -right-3 bg-amber-400 text-neutral-900 text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
      {count}
    </span>
  )
}
