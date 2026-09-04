'use server'

import { supabaseServer } from '@/lib/supabase/clients'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ActionState = { error?: string; success?: string }

export async function addAddress(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/addresses')

  const fullName = String(formData.get('full_name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const street = String(formData.get('street') || '').trim()
  const city = String(formData.get('city') || '').trim()
  const state = String(formData.get('state') || '').trim()

  if (!fullName || !phone || !street || !city || !state) {
    return { error: 'Fill in all required fields.' }
  }

  const isDefault = formData.get('is_default') === 'on'
  if (isDefault) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
  }

  const { error } = await supabase.from('addresses').insert({
    user_id: user.id,
    full_name: fullName,
    phone,
    street,
    city,
    state,
    landmark: String(formData.get('landmark') || '').trim() || null,
    is_default: isDefault,
  })

  if (error) return { error: error.message }
  revalidatePath('/account/addresses')
  return { success: 'Address saved.' }
}

export async function deleteAddress(addressId: string): Promise<ActionState> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' }

  const { error } = await supabase.from('addresses')
    .delete().eq('id', addressId).eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/account/addresses')
  return { success: 'Address removed.' }
}


export async function createCheckoutAddress(input: {
  fullName: string
  phone: string
  street: string
  city: string
  state: string
  landmark?: string
}): Promise<{ addressId?: string; error?: string }> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in before checking out.' }

  const fullName = input.fullName.trim()
  const phone = input.phone.trim()
  const street = input.street.trim()
  const city = input.city.trim()
  const state = input.state.trim()
  const landmark = input.landmark?.trim() || null

  if (!fullName || !phone || !street || !city || !state) {
    return { error: 'Enter your name, phone number, state, city and delivery address.' }
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({ user_id: user.id, full_name: fullName, phone, street, city, state, landmark, is_default: false })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message || 'Could not save your delivery details.' }
  revalidatePath('/account/addresses')
  return { addressId: data.id }
}
