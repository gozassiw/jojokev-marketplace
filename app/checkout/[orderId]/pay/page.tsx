import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { notFound, redirect } from 'next/navigation'
import PaymentView from '@/components/PaymentView'

export const dynamic = 'force-dynamic'

export default async function PayPage({ params }: { params: { orderId: string } }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/orders')

  const { data: order } = await supabaseAdmin()
    .from('orders')
    .select('id, order_number, total_kobo, status, buyer_id')
    .eq('id', params.orderId)
    .single()

  if (!order || order.buyer_id !== user.id) notFound()
  if (order.status !== 'awaiting_payment') redirect(`/orders/${order.id}`)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Pay for order {order.order_number}</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Transfer the exact amount below from your bank app. Your payment is held
        in escrow until you confirm delivery.
      </p>
      <PaymentView orderId={order.id} />
    </div>
  )
}
