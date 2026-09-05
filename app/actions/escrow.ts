'use server'

import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { revalidatePath } from 'next/cache'
import { nairaToKobo } from '@/lib/money'

/**
 * Buyer confirms they received the order.
 * This is the moment the seller's money becomes withdrawable.
 */
export async function confirmDelivery(orderId: string) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' }

  const db = supabaseAdmin()
  const { data: order } = await db
    .from('orders').select('id, buyer_id, status').eq('id', orderId).single()

  if (!order) return { error: 'Order not found.' }
  if (order.buyer_id !== user.id) return { error: 'That order is not yours.' }
  if (order.status === 'completed') return { error: 'Already confirmed.' }
  if (order.status !== 'delivered') {
    return { error: 'The seller must mark this order delivered before you can confirm receipt.' }
  }

  const { error } = await db.rpc('release_order_escrow', {
    p_order_id: orderId,
    p_reason: 'buyer confirmed delivery',
  })
  if (error) return { error: 'Could not confirm. Please try again.' }

  revalidatePath('/orders')
  return { success: 'Delivery confirmed. The seller has been paid.' }
}

/** Seller requests a payout from their available balance. */
export async function requestWithdrawal(amountNaira: number) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' }

  const { data: seller } = await supabase
    .from('seller_profiles').select('id').eq('user_id', user.id).single()
  if (!seller) return { error: 'Not a seller account.' }

  if (!amountNaira || amountNaira <= 0) return { error: 'Enter a valid amount.' }

  const db = supabaseAdmin()
  const { error } = await db.rpc('request_withdrawal', {
    p_seller_id: seller.id,
    p_amount_kobo: nairaToKobo(amountNaira),
  })

  // the SQL function raises readable messages; surface them directly
  if (error) return { error: error.message.replace(/^.*ERROR:\s*/, '') }

  revalidatePath('/seller/wallet')
  return { success: 'Withdrawal requested. Payouts are processed within 24 hours.' }
}
