'use client'

/**
 * Cart state lives in localStorage. IDs and quantities ONLY.
 * Prices are always resolved server-side at checkout.
 */
export type CartLine = { productId: string; quantity: number }

const KEY = 'jojokev_cart_v1'

export function readCart(): CartLine[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function writeCart(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines))
  window.dispatchEvent(new Event('cart-updated'))   // header badge listens for this
}

export function addToCart(productId: string, quantity = 1) {
  const cart = readCart()
  const existing = cart.find(l => l.productId === productId)
  if (existing) existing.quantity += quantity
  else cart.push({ productId, quantity })
  writeCart(cart)
}

export function setQuantity(productId: string, quantity: number) {
  let cart = readCart()
  if (quantity <= 0) cart = cart.filter(l => l.productId !== productId)
  else {
    const line = cart.find(l => l.productId === productId)
    if (line) line.quantity = quantity
  }
  writeCart(cart)
}

export function clearCart() { writeCart([]) }
export const cartCount = () => readCart().reduce((sum, l) => sum + l.quantity, 0)
