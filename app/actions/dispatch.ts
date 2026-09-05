'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { getEffectiveFees } from '@/lib/settings'

async function currentUser() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function requireAdmin() {
  const user = await currentUser()
  if (!user) return { error: 'Please log in.' as const }
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Admin access required.' as const }
  return { userId: user.id }
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function sixDigitCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export async function registerRider(_prev: { error?: string; success?: string }, formData: FormData) {
  const user = await currentUser()
  if (!user) return { error: 'Please log in before applying as a rider.' }
  const phone = String(formData.get('phone') || '').trim()
  if (!phone) return { error: 'Phone number is required.' }
  const db = supabaseAdmin()
  const { error } = await db.from('rider_profiles').upsert({
    user_id: user.id,
    phone,
    vehicle_type: String(formData.get('vehicle_type') || '').trim() || null,
    vehicle_plate: String(formData.get('vehicle_plate') || '').trim() || null,
    status: 'pending',
  }, { onConflict: 'user_id' })
  if (error) return { error: error.message }
  revalidatePath('/rider/register')
  return { success: 'Rider application submitted. Jojokev will review your details.' }
}

export async function approveRider(riderId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('user_id').eq('id', riderId).single()
  if (!rider) return { error: 'Rider application not found.' }
  const { error } = await db.from('rider_profiles').update({ status: 'approved', approved_by: ctx.userId, approved_at: new Date().toISOString() }).eq('id', riderId)
  if (error) return { error: error.message }
  await db.from('profiles').update({ role: 'rider' }).eq('id', rider.user_id)
  revalidatePath('/admin/riders')
  return { success: 'Rider approved.' }
}

export async function suspendRider(riderId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('user_id').eq('id', riderId).single()
  if (!rider) return { error: 'Rider not found.' }
  await db.from('rider_profiles').update({ status: 'suspended' }).eq('id', riderId)
  await db.from('profiles').update({ role: 'buyer' }).eq('id', rider.user_id)
  revalidatePath('/admin/riders')
  return { success: 'Rider suspended.' }
}

export async function assignRider(orderId: string, riderId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const db = supabaseAdmin()
  const { data: order } = await db.from('orders').select('id, order_number, buyer_id, status').eq('id', orderId).single()
  const { data: rider } = await db.from('rider_profiles').select('id, user_id, status').eq('id', riderId).single()
  if (!order) return { error: 'Order not found.' }
  if (!rider || rider.status !== 'approved') return { error: 'Choose an approved rider.' }
  if (!['paid', 'shipped', 'delivered'].includes(order.status)) return { error: 'Only paid orders can be assigned.' }
  const { error } = await db.from('delivery_assignments').upsert({ order_id: orderId, rider_id: riderId, assigned_by: ctx.userId, status: 'assigned' }, { onConflict: 'order_id' })
  if (error) return { error: error.message }
  await db.from('notifications').insert([
    { user_id: rider.user_id, order_id: orderId, type: 'rider_assignment', title: 'New delivery assigned', body: `Order ${order.order_number} is ready for your pickup.` },
    { user_id: order.buyer_id, order_id: orderId, type: 'dispatch_assigned', title: 'Delivery rider assigned', body: 'Jojokev has assigned a rider to your order. We will notify you when it is out for delivery.' },
  ])
  revalidatePath('/admin/dispatch')
  revalidatePath('/rider')
  revalidatePath('/notifications')
  return { success: 'Rider assigned.' }
}

async function riderContext(orderId: string) {
  const user = await currentUser()
  if (!user) return { error: 'Please log in.' as const }
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('id, user_id, status').eq('user_id', user.id).single()
  if (!rider || rider.status !== 'approved') return { error: 'Approved rider access required.' as const }
  const { data: assignment } = await db.from('delivery_assignments').select('id, status, rider_id').eq('order_id', orderId).eq('rider_id', rider.id).single()
  if (!assignment) return { error: 'This order is not assigned to you.' as const }
  return { userId: user.id, rider, assignment }
}

export async function riderMarkPickedUp(orderId: string) {
  const ctx = await riderContext(orderId)
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.assignment.status !== 'assigned') return { error: 'This delivery is not waiting for pickup.' }
  const db = supabaseAdmin()
  await db.from('delivery_assignments').update({ status: 'picked_up', picked_up_at: new Date().toISOString() }).eq('id', ctx.assignment.id)
  revalidatePath('/rider')
  return { success: 'Pickup confirmed.' }
}

export async function riderMarkOutForDelivery(orderId: string) {
  const ctx = await riderContext(orderId)
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.assignment.status !== 'picked_up') return { error: 'Confirm pickup before going out for delivery.' }
  const db = supabaseAdmin()
  const { data: order } = await db.from('orders').select('order_number, buyer_id').eq('id', orderId).single()
  await db.from('delivery_assignments').update({ status: 'out_for_delivery', out_for_delivery_at: new Date().toISOString() }).eq('id', ctx.assignment.id)
  await db.from('orders').update({ status: 'shipped' }).eq('id', orderId)
  if (order) await db.from('notifications').insert({ user_id: order.buyer_id, order_id: orderId, type: 'out_for_delivery', title: 'Your order is out for delivery', body: `Order ${order.order_number} is on the way. Never share a delivery code before your package is physically with you.` })
  revalidatePath('/rider')
  revalidatePath('/orders')
  revalidatePath('/notifications')
  return { success: 'Buyer notified: order is out for delivery.' }
}

export async function riderMarkArrived(orderId: string) {
  const ctx = await riderContext(orderId)
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.assignment.status !== 'out_for_delivery') return { error: 'Mark the order out for delivery first.' }
  const db = supabaseAdmin()
  const { data: order } = await db.from('orders').select('order_number, buyer_id').eq('id', orderId).single()
  if (!order) return { error: 'Order not found.' }
  const code = sixDigitCode()
  await db.from('delivery_codes').upsert({ order_id: orderId, code_hash: hashCode(code), expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), attempts: 0, used_at: null }, { onConflict: 'order_id' })
  await db.from('delivery_assignments').update({ status: 'arrived', arrived_at: new Date().toISOString() }).eq('id', ctx.assignment.id)
  await db.from('notifications').insert({ user_id: order.buyer_id, order_id: orderId, type: 'delivery_code', title: 'Your delivery code is ready', body: `Your Jojokev delivery code for ${order.order_number} is ${code}. Only share it when the package is physically with you. Jojokev staff will never ask for it by phone or chat.`, metadata: { order_number: order.order_number, expires_in_minutes: 30 } })
  revalidatePath('/rider')
  revalidatePath('/orders')
  revalidatePath('/notifications')
  return { success: 'Buyer code generated. Ask the buyer to open their Jojokev notifications.' }
}

export async function riderVerifyDeliveryCode(orderId: string, code: string) {
  const ctx = await riderContext(orderId)
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.assignment.status !== 'arrived') return { error: 'First mark that you have arrived.' }
  const clean = code.trim()
  if (!/^\d{6}$/.test(clean)) return { error: 'Enter the six-digit buyer code.' }
  const db = supabaseAdmin()
  const { data: valid, error: verifyError } = await db.rpc('verify_delivery_code', { p_order_id: orderId, p_code_hash: hashCode(clean) })
  if (verifyError || !valid) return { error: 'That code is incorrect, expired, or already used.' }
  const { autoReleaseDays } = await getEffectiveFees()
  const autoReleaseAt = new Date(Date.now() + autoReleaseDays * 24 * 60 * 60 * 1000).toISOString()
  const { data: order } = await db.from('orders').select('order_number, buyer_id').eq('id', orderId).single()
  await db.from('delivery_assignments').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('order_id', orderId)
  await db.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString(), auto_release_at: autoReleaseAt }).eq('id', orderId)
  if (order) await db.from('notifications').insert({ user_id: order.buyer_id, order_id: orderId, type: 'delivered', title: 'Order delivered — please confirm receipt', body: `Order ${order.order_number} was delivered. Open your order and confirm receipt only if you received the correct package.` })
  revalidatePath('/rider')
  revalidatePath('/orders')
  revalidatePath('/notifications')
  return { success: 'Delivery verified. Buyer can now confirm receipt.' }
}

export async function markNotificationRead(notificationId: string) {
  const user = await currentUser()
  if (!user) return { error: 'Please log in.' }
  const db = supabaseAdmin()
  await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', user.id)
  revalidatePath('/notifications')
  return { success: 'Notification marked as read.' }
}
