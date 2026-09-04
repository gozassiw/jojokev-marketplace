import CartView from '@/components/CartView'

export const dynamic = 'force-dynamic'

export default function CartPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Your cart</h1>
      <CartView />
    </div>
  )
}
