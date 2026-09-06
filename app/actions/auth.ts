'use server'

import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: string }

const sellerIdTypes = new Set(['NIN', 'Voters card', 'Drivers license'])
const sellerFileTypes = new Set(['image/jpeg', 'image/png', 'application/pdf'])
async function uploadSellerDocument(db: ReturnType<typeof supabaseAdmin>, userId: string, value: FormDataEntryValue | null, label: string) {
  if (!(value instanceof File) || value.size === 0) return null
  if (value.size > 5 * 1024 * 1024) throw new Error(`${label} must be 5MB or smaller.`)
  if (!sellerFileTypes.has(value.type)) throw new Error(`${label} must be a JPG, PNG, or PDF file.`)
  const ext = value.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${userId}/${Date.now()}-${label.toLowerCase().replaceAll(' ', '-')}.${ext}`
  const { error } = await db.storage.from('seller-documents').upload(path, value, { contentType: value.type, upsert: false })
  if (error) throw new Error(`Could not upload ${label.toLowerCase()}.`)
  return path
}

/* BUYER REGISTRATION
   The profile row is created by the on_auth_user_created trigger,
   so we only pass metadata here. */
export async function registerBuyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const fullName = String(formData.get('full_name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()

  if (!email || !password || !fullName) return { error: 'Fill in all required fields.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone, role: 'buyer' } },
  })
  if (error) return { error: error.message }
  redirect('/?welcome=1')
}

export async function registerSeller(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const firstName = String(formData.get('first_name') || '').trim()
  const lastName = String(formData.get('last_name') || '').trim()
  const fullName = `${firstName} ${lastName}`.trim() || String(formData.get('full_name') || '').trim()
  const businessName = String(formData.get('business_name') || '').trim()
  const idType = String(formData.get('id_type') || '').trim()
  const storeAreaId = String(formData.get('store_area_id') || '').trim()
  if (!email || !password || !firstName || !lastName || !businessName || !idType || !storeAreaId) return { error: 'Complete your name, email, business name, identification type, and store area.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (!sellerIdTypes.has(idType)) return { error: 'Choose a valid identification type.' }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone: String(formData.get('phone') || '').trim(), role: 'buyer' } } })
  if (error || !data.user) return { error: error?.message || 'Could not create your account.' }

  const admin = supabaseAdmin()
  try {
    const idPhotoPath = await uploadSellerDocument(admin, data.user.id, formData.get('id_photo'), 'ID photo')
    const utilityBillPath = await uploadSellerDocument(admin, data.user.id, formData.get('utility_bill'), 'Utility bill')
    const passportPhotoPath = await uploadSellerDocument(admin, data.user.id, formData.get('passport_photo'), 'Passport photo')
    const signaturePath = await uploadSellerDocument(admin, data.user.id, formData.get('signature_photo'), 'Signature photo')
    if (!idPhotoPath || !utilityBillPath || !passportPhotoPath || !signaturePath) return { error: 'Upload your ID, utility bill, passport photo, and signature photo.' }
    const { data: area } = await admin.from('delivery_areas').select('id').eq('id', storeAreaId).eq('active', true).single()
    if (!area) return { error: 'Choose an active store area from the list.' }
    const { error: sellerError } = await admin.from('seller_profiles').insert({ user_id: data.user.id, first_name: firstName, last_name: lastName, phone: String(formData.get('phone') || '').trim(), business_name: businessName, business_address: String(formData.get('business_address') || '').trim(), business_phone: String(formData.get('business_phone') || '').trim(), id_type: idType, id_photo_path: idPhotoPath, utility_bill_path: utilityBillPath, passport_photo_path: passportPhotoPath, signature_path: signaturePath, store_area_id: storeAreaId, bank_name: String(formData.get('bank_name') || '').trim(), account_number: String(formData.get('account_number') || '').trim(), account_name: String(formData.get('account_name') || '').trim(), status: 'pending' })
    if (sellerError) return { error: sellerError.code === '23505' ? 'A seller application already exists for this account.' : sellerError.message }
  } catch (uploadError: any) { return { error: uploadError?.message || 'Could not upload seller verification documents.' } }
  return { success: 'Application submitted. Check your email if confirmation is required, then log in to track your review.' }
}
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const nextPath = String(formData.get('next') || '')
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : ''

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Email or password is incorrect.' }

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if (safeNext && !['admin', 'seller', 'rider'].includes(profile?.role || '')) redirect(safeNext)
  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'seller') redirect('/seller')
  if (profile?.role === 'rider') redirect('/rider')
  redirect('/')
}

export async function logout() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

/* SELLER APPLICATION
   Creates a seller_profile with status 'pending'. They cannot list
   anything until an admin approves — that approval also fires the
   trigger that creates their wallet. */
export async function applyToSell(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/sell')

  const businessName = String(formData.get('business_name') || '').trim()
  if (!businessName) return { error: 'Business name is required.' }

  const { error } = await supabase.from('seller_profiles').insert({
    user_id: user.id,
    business_name: businessName,
    business_address: String(formData.get('business_address') || '').trim(),
    business_phone: String(formData.get('business_phone') || '').trim(),
    bank_name: String(formData.get('bank_name') || '').trim(),
    account_number: String(formData.get('account_number') || '').trim(),
    account_name: String(formData.get('account_name') || '').trim(),
    status: 'pending',
  })

  if (error) {
    if (error.code === '23505') return { error: 'You have already applied to sell.' }
    return { error: error.message }
  }
  revalidatePath('/sell')
  return { success: 'Application submitted. We review new sellers within 24 hours.' }
}
