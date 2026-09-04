import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { getOrderStatus } from '@/lib/transactpay'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const db = supabaseAdmin()
  const { data: order } = await db
    .from('orders').select('id, status, buyer_id, payment_reference').eq('id', orderId).single()

  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status !== 'awaiting_payment') {
    return NextResponse.json({ status: order.status })
  }

  // still unpaid — ask TransactPay directly in case the webhook was lost
  if (order.payment_reference) {
    try {
      const remote = await getOrderStatus(order.payment_reference)
      const remoteStatus = String(remote?.data?.status ?? remote?.status ?? '').toLowerCase()
      if (remoteStatus.includes('success') || remoteStatus.includes('paid')) {
        await db.rpc('settle_paid_order', { p_order_id: order.id })
        return NextResponse.json({ status: 'paid' })
      }
    } catch (e) {
      console.error('[status] poll failed', e)
    }
  }

  return NextResponse.json({ status: order.status })
}
