'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'

export type StoreArea = { id: string; name: string; city: string; state: string; is_active: boolean }

async function requireAdmin() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' as const }
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Admin access required.' as const }
  return { userId: user.id }
}

function fields(formData: FormData) {
  return { name: String(formData.get('name') || '').trim(), city: String(formData.get('city') || '').trim(), state: String(formData.get('state') || '').trim() }
}

export async function createStoreArea(_prev: { error?: string; success?: string }, formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const area = fields(formData)
  if (!area.name || !area.city || !area.state) return { error: 'Store area, city, and state are required.' }
  const db = supabaseAdmin()
  const { error } = await db.from('store_areas').insert({ ...area, is_active: true })
  if (error) return { error: error.code === '23505' ? 'This store area already exists.' : error.message }
  revalidatePath('/admin/store-areas')
  revalidatePath('/api/store-areas')
  return { success: 'Store area added. Sellers can now choose it.' }
}

export async function updateStoreArea(areaId: string, formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const area = fields(formData)
  const isActive = String(formData.get('is_active') || '') === 'true'
  if (!area.name || !area.city || !area.state) return { error: 'Store area, city, and state are required.' }
  const db = supabaseAdmin()
  const { error } = await db.from('store_areas').update({ ...area, is_active: isActive }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/store-areas')
  revalidatePath('/api/store-areas')
  return { success: 'Store area updated.' }
}

export async function toggleStoreArea(areaId: string, isActive: boolean) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const db = supabaseAdmin()
  const { error } = await db.from('store_areas').update({ is_active: isActive }).eq('id', areaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/store-areas')
  revalidatePath('/api/store-areas')
  return { success: isActive ? 'Store area enabled.' : 'Store area disabled.' }
}
