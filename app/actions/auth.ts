'use server'

import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: string }

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
  const fullName = String(formData.get('full_name') || '').trim()
  const businessName = String(formData.get('business_name') || '').trim()
  if (!email || !password || !fullName || !businessName) return { error: 'Complete your name, email, password and business name.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone: String(formData.get('phone') || '').trim(), role: 'buyer' } } })
  if (error || !data.user) return { error: error?.message || 'Could not create your account.' }

  const admin = supabaseAdmin()
  const { error: sellerError } = await admin.from('seller_profiles').insert({
    user_id: data.user.id,
    business_name: businessName,
    business_address: String(formData.get('business_address') || '').trim(),
    business_phone: String(formData.get('business_phone') || '').trim(),
    bank_name: String(formData.get('bank_name') || '').trim(),
    account_number: String(formData.get('account_number') || '').trim(),
    account_name: String(formData.get('account_name') || '').trim(),
    status: 'pending',
  })
  if (sellerError) return { error: sellerError.code === '23505' ? 'A seller application already exists for this account.' : sellerError.message }
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

  if (safeNext && profile?.role !== 'admin' && profile?.role !== 'seller') redirect(safeNext)
  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'seller') redirect('/seller')
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
