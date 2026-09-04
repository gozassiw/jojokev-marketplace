'use server'

import { supabaseServer } from '@/lib/supabase/clients'
import { revalidatePath } from 'next/cache'
import { nairaToKobo } from '@/lib/money'

export type ActionState = { error?: string; success?: string }

/** URL-safe slug with a random suffix so two sellers can both list "iPhone 13". */
function makeSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

async function requireApprovedSeller() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' as const }

  const { data: seller } = await supabase
    .from('seller_profiles').select('id, status').eq('user_id', user.id).single()

  if (!seller) return { error: 'You have not applied to sell yet.' as const }
  if (seller.status !== 'approved') return { error: 'Your seller account is not approved yet.' as const }
  return { supabase, sellerId: seller.id }
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireApprovedSeller()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, sellerId } = ctx

  const title = String(formData.get('title') || '').trim()
  const priceNaira = Number(formData.get('price') || 0)
  const stock = Number(formData.get('stock') || 0)

  if (!title) return { error: 'Product title is required.' }
  if (priceNaira <= 0) return { error: 'Price must be greater than zero.' }
  if (stock < 0) return { error: 'Stock cannot be negative.' }

  const images = String(formData.get('images') || '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 6)

  const { error } = await supabase.from('products').insert({
    seller_id: sellerId,
    category_id: String(formData.get('category_id') || '') || null,
    title,
    slug: makeSlug(title),
    description: String(formData.get('description') || '').trim(),
    price_kobo: nairaToKobo(priceNaira),
    stock,
    images,
    status: formData.get('publish') === 'on' ? 'active' : 'draft',
  })

  if (error) return { error: error.message }
  revalidatePath('/seller/products')
  return { success: 'Product created.' }
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireApprovedSeller()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, sellerId } = ctx

  const id = String(formData.get('id') || '')
  const priceNaira = Number(formData.get('price') || 0)
  if (priceNaira <= 0) return { error: 'Price must be greater than zero.' }

  const images = String(formData.get('images') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 6)
  const { error } = await supabase.from('products').update({
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    price_kobo: nairaToKobo(priceNaira),
    stock: Number(formData.get('stock') || 0),
    category_id: String(formData.get('category_id') || '') || null,
    images,
    status: formData.get('publish') === 'on' ? 'active' : 'draft',
  })
  .eq('id', id)
  .eq('seller_id', sellerId)   // ownership guard

  if (error) return { error: error.message }
  revalidatePath('/seller/products')
  return { success: 'Product updated.' }
}

export async function deleteProduct(productId: string): Promise<ActionState> {
  const ctx = await requireApprovedSeller()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, sellerId } = ctx

  // Delist rather than hard delete: order_items reference this row and
  // buyers must keep seeing their purchase history.
  const { error } = await supabase.from('products')
    .update({ status: 'delisted' }).eq('id', productId).eq('seller_id', sellerId)

  if (error) return { error: error.message }
  revalidatePath('/seller/products')
  return { success: 'Product removed from the store.' }
}
