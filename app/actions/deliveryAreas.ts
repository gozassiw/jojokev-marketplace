'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'

export type DeliveryArea = {
  id: string
  name: string
  city: string
  state: string
  customer_fee_kobo: number
  rider_quote_kobo: number
  is_active: boolean
}

async function requireAdmin() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' as const }
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Admin access required.' as const }
  return { userId: user.id }
}

export async function getActiveDeliveryAreas(): Promise<DeliveryArea[]> {
  const db = supabaseAdmin()
  const { data } = await db.from('delivery_areas').select('id, name, city, state, customer_fee_kobo, rider_quote_kobo, is_active').eq('is_active', true).order('state').order('city').order('name')
  return (data || []) as DeliveryArea[]
}

function parseMoney(value: FormDataEntryValue | null) {
  const naira = Number(String(value || '').replace(/,/g, '').trim())
  return Number.isFinite(naira) && naira >= 0 ? Math.round(naira * 100) : null
}

export async function createDeliveryArea(_prev: { error?: string; success?: string }, formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const name = String(formData.get('name') || '').trim()
  const city = String(formData.get('city') || '').trim()
  const state = String(formData.get('state') || '').trim()
  const customer = parseMoney(formData.get('customer_fee'))
  const rider = parseMoney(formData.get('rider_quote'))
  if (!name || !city || !state) return { error: 'Area name, city, and state are required.' }
  if (customer === null || rider === null) return { error: 'Enter valid customer and rider amounts.' }
  if (rider > customer) return { error: 'Rider quote cannot be higher than the customer delivery fee.' }
  const db = supabaseAdmin()
  const { error } = await db.from('delivery_areas').insert({ name, city, state, customer_fee_kobo: customer, rider_quote_kobo: rider, is_active: true })
  if (error) return { error: error.code === '23505' ? 'This delivery area already exists.' : error.message }
  revalidatePath('/admin/delivery-areas')
  revalidatePath('/checkout')
  return { success: 'Delivery area added.' }
}

export async function updateDeliveryArea(areaId: string, formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const customer = parseMoney(formData.get('customer_fee'))
  const rider = parseMoney(formData.get('rider_quote'))
  const name = String(formData.get('name') || '').trim()
  const city = String(formData.get('city') || '').trim()
  const state = String(formData.get('state') || '').trim()
  const isActive = String(formData.get('is_active') || '') === 'true'
  if (!name || !city || !state || customer === null || rider === null) return { error: 'Complete all area fields with valid amounts.' }
  if (rider > customer) return { error: 'Rider quote cannot be higher than the customer delivery fee.' }
  const db = supabaseAdmin()
  const { error } = await db.from('delivery_areas').update({ name, city, state, customer_fee_kobo: customer, rider_quote_kobo: rider, is_active: isActive }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/delivery-areas')
  revalidatePath('/checkout')
  return { success: 'Delivery area updated.' }
}

export async function toggleDeliveryArea(areaId: string, isActive: boolean) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const db = supabaseAdmin()
  const { error } = await db.from('delivery_areas').update({ is_active: isActive }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/delivery-areas')
  revalidatePath('/checkout')
  return { success: isActive ? 'Area enabled.' : 'Area disabled.' }
}
