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

const allowedIdTypes = new Set(['NIN', 'Voters card', 'Drivers license'])
const allowedFileTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])

async function uploadRiderDocument(db: ReturnType<typeof supabaseAdmin>, userId: string, value: FormDataEntryValue | null, label: string) {
  if (!(value instanceof File) || value.size === 0) return null
  if (value.size > 5 * 1024 * 1024) throw new Error(`${label} must be 5MB or smaller.`)
  if (!allowedFileTypes.has(value.type)) throw new Error(`${label} must be a JPG, PNG, or PDF file.`)
  const ext = value.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${userId}/${Date.now()}-${label.toLowerCase().replaceAll(' ', '-')}.${ext}`
  const { error } = await db.storage.from('rider-documents').upload(path, value, { contentType: value.type, upsert: false })
  if (error) throw new Error(`Could not upload ${label.toLowerCase()}.`)
  return path
}

export async function registerRider(_prev: { error?: string; success?: string }, formData: FormData) {
  const user = await currentUser()
  if (!user) return { error: 'Please log in before applying as a rider.' }
  const firstName = String(formData.get('first_name') || '').trim()
  const lastName = String(formData.get('last_name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const dateOfBirth = String(formData.get('date_of_birth') || '').trim()
  const gender = String(formData.get('gender') || '').trim()
  const address = String(formData.get('residential_address') || '').trim()
  const serviceCity = String(formData.get('service_city') || '').trim()
  const idType = String(formData.get('id_type') || '').trim()
  if (!firstName || !lastName || !phone || !dateOfBirth || !gender || !address || !serviceCity || !idType) return { error: 'Complete all required personal, address, and service-city fields.' }
  if (!allowedIdTypes.has(idType)) return { error: 'Choose a valid identification type.' }
  const db = supabaseAdmin()
  try {
    const proofPath = await uploadRiderDocument(db, user.id, formData.get('proof_of_address'), 'Proof of address')
    const idPath = await uploadRiderDocument(db, user.id, formData.get('id_photo'), 'ID photo')
    const passportPath = await uploadRiderDocument(db, user.id, formData.get('passport_photo'), 'Passport photo')
    if (!proofPath || !idPath || !passportPath) return { error: 'Upload proof of address, your selected ID, and a passport photo.' }
    const { error } = await db.from('rider_profiles').upsert({ user_id: user.id, first_name: firstName, last_name: lastName, phone, date_of_birth: dateOfBirth, gender, residential_address: address, service_city: serviceCity, id_type: idType, proof_of_address_path: proofPath, id_photo_path: idPath, passport_photo_path: passportPath, vehicle_type: String(formData.get('vehicle_type') || '').trim() || null, vehicle_plate: String(formData.get('vehicle_plate') || '').trim() || null, status: 'pending' }, { onConflict: 'user_id' })
    if (error) return { error: error.message }
  } catch (error: any) {
    return { error: error?.message || 'Could not submit rider application.' }
  }
  revalidatePath('/rider/register')
  revalidatePath('/admin/riders')
  return { success: 'Rider application submitted. Jojokev will review your identity and vehicle details.' }
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
  const { data: order } = await db.from('orders').select('id, order_number, buyer_id, status, rider_quote_kobo').eq('id', orderId).single()
  const { data: rider } = await db.from('rider_profiles').select('id, user_id, status').eq('id', riderId).single()
  if (!order) return { error: 'Order not found.' }
  if (!rider || rider.status !== 'approved') return { error: 'Choose an approved rider.' }
  if (!['paid', 'shipped', 'delivered'].includes(order.status)) return { error: 'Only paid orders can be assigned.' }
  const { error } = await db.from('delivery_assignments').upsert({ order_id: orderId, rider_id: riderId, assigned_by: ctx.userId, rider_quote_kobo: Number(order.rider_quote_kobo || 0), status: 'assigned' }, { onConflict: 'order_id' })
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
  if (!order) return { error: 'Order not found.' }
  const code = sixDigitCode()
  const { error: codeError } = await db.from('delivery_codes').upsert({ order_id: orderId, code_hash: hashCode(code), expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), attempts: 0, used_at: null }, { onConflict: 'order_id' })
  if (codeError) return { error: codeError.message }
  const { error: assignmentError } = await db.from('delivery_assignments').update({ status: 'out_for_delivery', out_for_delivery_at: new Date().toISOString() }).eq('id', ctx.assignment.id)
  if (assignmentError) return { error: assignmentError.message }
  const { error: orderError } = await db.from('orders').update({ status: 'shipped' }).eq('id', orderId)
  if (orderError) return { error: orderError.message }
  await db.from('notifications').insert({ user_id: order.buyer_id, order_id: orderId, type: 'out_for_delivery', title: 'Your order is out for delivery', body: `Order ${order.order_number} is on the way. Your private delivery code is ${code}. Only share it when the package is physically with you. Jojokev staff will never ask for it by phone or chat.`, metadata: { order_number: order.order_number, expires_in_minutes: 30 } })
  revalidatePath('/rider')
  revalidatePath('/orders')
  revalidatePath('/notifications')
  return { success: 'Order is out for delivery. The buyer received the private code in their notifications.' }
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
  if (!['out_for_delivery', 'arrived'].includes(ctx.assignment.status)) return { error: 'Mark the order out for delivery first.' }
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
  const { error: riderWalletError } = await db.rpc('release_rider_delivery_earnings', { p_order_id: orderId })
  if (riderWalletError) return { error: riderWalletError.message }
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

export async function broadcastDeliveryOffer(orderId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const db = supabaseAdmin()
  const { data: order } = await db.from('orders').select('id, order_number, buyer_id, status, rider_quote_kobo, delivery_area_id, addresses(city, state), delivery_areas(city, state, name)').eq('id', orderId).single()
  if (!order) return { error: 'Order not found.' }
  if (!['paid', 'shipped', 'delivered'].includes(order.status)) return { error: 'Only paid orders can be broadcast.' }
  const existing = await db.from('delivery_assignments').select('id').eq('order_id', orderId).neq('status', 'cancelled').maybeSingle()
  if (existing.data) return { error: 'This order already has a rider assignment.' }
  const area = Array.isArray(order.delivery_areas) ? order.delivery_areas[0] : order.delivery_areas
  const address = Array.isArray(order.addresses) ? order.addresses[0] : order.addresses
  const city = String(area?.city || address?.city || '').trim().toLowerCase()
  const { data: riderRows } = await db.from('rider_profiles').select('id, user_id, service_city, status').eq('status', 'approved')
  const eligible = (riderRows || []).filter((r: any) => !city || String(r.service_city || '').trim().toLowerCase() === city)
  if (!eligible.length) return { error: `No approved riders are registered for ${city || 'this delivery area'}.` }
  // Give riders a practical acceptance window. Re-broadcasting the same order
  // must refresh an expired/declined offer instead of silently ignoring the
  // unique (order_id, rider_id) row that already exists.
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const offers = eligible.map((r: any) => ({ order_id: orderId, rider_id: r.id, quote_kobo: Number(order.rider_quote_kobo || 0), expires_at: expiresAt, status: 'offered', responded_at: null }))
  const { error } = await db.from('delivery_offers').upsert(offers, { onConflict: 'order_id,rider_id' })
  if (error) return { error: error.message }
  await db.from('notifications').insert(eligible.map((r: any) => ({ user_id: r.user_id, order_id: orderId, type: 'delivery_offer', title: 'New delivery offer', body: `Order ${order.order_number} is available in ${area?.name || city || 'your area'}. Open Deliveries to accept it.`, metadata: { offer_expires_at: expiresAt, area: area?.name || city, quote_kobo: Number(order.rider_quote_kobo || 0) } })))
  revalidatePath('/admin/dispatch'); revalidatePath('/rider'); revalidatePath('/notifications')
  return { success: `Quote sent to ${eligible.length} eligible rider${eligible.length === 1 ? '' : 's'}.` }
}

export async function acceptDeliveryOffer(offerId: string) {
  const user = await currentUser()
  if (!user) return { error: 'Please log in.' }
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('id, user_id, status').eq('user_id', user.id).single()
  if (!rider || rider.status !== 'approved') return { error: 'Approved rider access required.' }
  const { data: offerBefore } = await db.from('delivery_offers').select('order_id, quote_kobo, orders(order_number, buyer_id)').eq('id', offerId).single()
  const offerOrder = Array.isArray(offerBefore?.orders) ? offerBefore?.orders[0] : offerBefore?.orders
  const { data, error } = await db.rpc('accept_delivery_offer', { p_offer_id: offerId, p_rider_id: rider.id })
  if (error) return { error: error.message }
  if (!data?.ok) return { error: data?.error || 'This offer is no longer available.' }
  if (offerBefore && data.assignment_id) {
    const { error: walletError } = await db.rpc('hold_rider_delivery_earnings', { p_order_id: offerBefore.order_id, p_assignment_id: data.assignment_id, p_rider_id: rider.id, p_amount_kobo: Number(offerBefore.quote_kobo || 0) })
    if (walletError) return { error: walletError.message }
  }
  if (offerBefore && offerOrder) await db.from('notifications').insert({ user_id: offerOrder.buyer_id, order_id: offerBefore.order_id, type: 'dispatch_assigned', title: 'Rider accepted your delivery', body: 'An approved Jojokev rider has accepted your delivery offer. We will update you when it is out for delivery.' })
  revalidatePath('/rider'); revalidatePath('/admin/dispatch'); revalidatePath('/notifications')
  return { success: 'You accepted this delivery.' }
}

export async function declineDeliveryOffer(offerId: string) {
  const user = await currentUser()
  if (!user) return { error: 'Please log in.' }
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('id, status').eq('user_id', user.id).single()
  if (!rider || rider.status !== 'approved') return { error: 'Approved rider access required.' }
  const { error } = await db.from('delivery_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', offerId).eq('rider_id', rider.id).eq('status', 'offered')
  if (error) return { error: error.message }
  revalidatePath('/rider'); revalidatePath('/notifications')
  return { success: 'Offer declined.' }
}
