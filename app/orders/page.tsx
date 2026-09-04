import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'
import { redirect } from 'next/navigation'
import OrderStatusBadge from '@/components/OrderStatusBadge'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/orders')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total_kobo, status, created_at')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">My orders</h1>

      {!orders?.length ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <p className="text-neutral-500 mb-4">You have not placed any orders yet.</p>
          <Link href="/" className="text-emerald-700 underline">Start shopping</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map(o => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`}
                    className="flex items-center justify-between rounded-xl border bg-white p-4 hover:border-emerald-500 transition-colors">
                <div>
                  <p className="font-medium">{o.order_number}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(o.created_at).toLocaleString('en-NG')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatNaira(o.total_kobo)}</p>
                  <OrderStatusBadge status={o.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
