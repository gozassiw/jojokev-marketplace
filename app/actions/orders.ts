'use server'

import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { getEffectiveFees } from '@/lib/settings'
import { calcCommission } from '@/lib/money'
import { redirect } from 'next/navigation'

/** JK-8K3M2Q1P — short, unique, readable over the phone for support. */
function makeOrderNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no confusable 0/O/1/I
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `JK-${s}`
}

export type CreateOrderResult = { error?: string; orderId?: string }

/**
 * Creates an order in 'awaiting_payment'.
 *
 * NO money moves here and NO stock is deducted here. Both happen in the
 * Stage 3 webhook, only after payment is genuinely confirmed. If we deducted
 * stock now, abandoned checkouts would silently drain inventory.
 */
export async function createOrder(
  cartLines: { productId: string; quantity: number }[],
  addressId: string
): Promise<CreateOrderResult> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/checkout')

  if (!cartLines.length) return { error: 'Your cart is empty.' }
  if (!addressId) return { error: 'Choose a delivery address.' }

  // service role: orders and order_items have no client insert policy
  const db = supabaseAdmin()

  // confirm the address belongs to this buyer
  const { data: address } = await db
    .from('addresses').select('id').eq('id', addressId).eq('user_id', user.id).single()
  if (!address) return { error: 'That delivery address is not valid.' }

  // ---- re-price everything from the database; ignore anything the client sent
  const { data: products, error: prodErr } = await db
    .from('products')
    .select('id, title, price_kobo, stock, status, seller_id, seller_profiles!inner(status)')
    .in('id', cartLines.map(l => l.productId))

  if (prodErr) return { error: 'Could not load your items. Please try again.' }

  const { commissionPercent, deliveryFeeKobo } = await getEffectiveFees()

  const items = []
  let subtotalKobo = 0

  for (const line of cartLines) {
    const p = products?.find((x: any) => x.id === line.productId)
    if (!p) return { error: 'An item in your cart is no longer available.' }
    if (p.status !== 'active') return { error: `"${p.title}" is no longer for sale.` }
    if ((p as any).seller_profiles?.status !== 'approved') {
      return { error: `"${p.title}" is temporarily unavailable.` }
    }

    const quantity = Math.max(1, Math.floor(line.quantity))
    if (p.stock < quantity) {
      return { error: `Only ${p.stock} left of "${p.title}". Reduce the quantity to continue.` }
    }

    const lineTotal = p.price_kobo * quantity
    const commission = calcCommission(lineTotal, commissionPercent)

    items.push({
      product_id: p.id,
      seller_id: p.seller_id,
      product_title: p.title,          // snapshot survives later edits
      unit_price_kobo: p.price_kobo,
      quantity,
      line_total_kobo: lineTotal,
      commission_kobo: commission,
      seller_net_kobo: lineTotal - commission,
    })
    subtotalKobo += lineTotal
  }

  const totalKobo = subtotalKobo + deliveryFeeKobo

  const { data: order, error: orderErr } = await db.from('orders').insert({
    order_number: makeOrderNumber(),
    buyer_id: user.id,
    address_id: addressId,
    subtotal_kobo: subtotalKobo,
    delivery_fee_kobo: deliveryFeeKobo,
    total_kobo: totalKobo,
    status: 'awaiting_payment',
  }).select('id').single()

  if (orderErr || !order) return { error: 'Could not create your order. Please try again.' }

  const { error: itemsErr } = await db.from('order_items')
    .insert(items.map(i => ({ ...i, order_id: order.id })))

  if (itemsErr) {
    // don't leave a headless order behind
    await db.from('orders').delete().eq('id', order.id)
    return { error: 'Could not save your order items. Please try again.' }
  }

  return { orderId: order.id }
}

/** Delivery status is now controlled by an assigned, approved Jojokev rider. */
export async function markDelivered(_orderId: string) {
  return { error: 'Delivery is now managed by an assigned Jojokev rider.' }
}

/** Delivery status is now controlled by an assigned, approved Jojokev rider. */
export async function markShipped(_orderId: string) {
  return { error: 'Delivery is now managed by an assigned Jojokev rider.' }
}
