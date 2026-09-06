'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'

async function approvedRider() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please log in.' as const }
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('id, status').eq('user_id', user.id).single()
  if (!rider || rider.status !== 'approved') return { error: 'Approved rider access required.' as const }
  return { userId: user.id, rider, db }
}

export async function saveRiderBankDetails(_prev: { error?: string; success?: string }, formData: FormData) {
  const ctx = await approvedRider()
  if ('error' in ctx) return { error: ctx.error }
  const bankName = String(formData.get('bank_name') || '').trim()
  const accountName = String(formData.get('account_name') || '').trim()
  const accountNumber = String(formData.get('account_number') || '').replace(/\D/g, '')
  if (!bankName || !accountName || !/^\d{10}$/.test(accountNumber)) return { error: 'Enter your bank name, account name, and a valid 10-digit account number.' }
  const { error } = await ctx.db.from('rider_profiles').update({ bank_name: bankName, account_name: accountName, account_number: accountNumber }).eq('id', ctx.rider.id)
  if (error) return { error: error.message }
  revalidatePath('/rider/wallet')
  return { success: 'Bank details saved.' }
}

export async function requestRiderWithdrawal(_prev: { error?: string; success?: string }, formData: FormData) {
  const ctx = await approvedRider()
  if ('error' in ctx) return { error: ctx.error }
  const amountNaira = Number(String(formData.get('amount') || '').replace(/,/g, ''))
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) return { error: 'Enter a valid withdrawal amount.' }
  const { data, error } = await ctx.db.rpc('request_rider_withdrawal', { p_rider_id: ctx.rider.id, p_amount_kobo: Math.round(amountNaira * 100) })
  if (error) return { error: error.message }
  revalidatePath('/rider/wallet')
  return { success: `Withdrawal request ${data} submitted for admin processing.` }
}
