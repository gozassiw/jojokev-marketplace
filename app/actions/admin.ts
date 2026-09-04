'use server'

import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { revalidatePath } from 'next/cache'
import { nairaToKobo } from '@/lib/money'
import { payoutToBank } from '@/lib/transactpay'

/** Every admin action starts here. Never trust a hidden form field for this. */
async function requireAdmin() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' as const }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorised' as const }

  return { userId: user.id }
}

/* ---------------- SELLER APPROVAL ---------------- */

export async function approveSeller(sellerId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const db = supabaseAdmin()
  // the on_seller_approved trigger creates their wallet and promotes their role
  const { error } = await db.from('seller_profiles').update({
    status: 'approved',
    approved_by: ctx.userId,
    approved_at: new Date().toISOString(),
    rejection_reason: null,
  }).eq('id', sellerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/sellers')
  return { success: 'Seller approved. They can now list products.' }
}

export async function rejectSeller(sellerId: string, reason: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const db = supabaseAdmin()
  const { error } = await db.from('seller_profiles')
    .update({ status: 'rejected', rejection_reason: reason }).eq('id', sellerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/sellers')
  return { success: 'Application rejected.' }
}

/**
 * Suspending stops new sales immediately — their products stop appearing to
 * shoppers because the storefront RLS policy requires an approved seller.
 * Existing held funds are untouched and still release normally.
 */
export async function suspendSeller(sellerId: string, reason: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const db = supabaseAdmin()
  const { error } = await db.from('seller_profiles')
    .update({ status: 'suspended', rejection_reason: reason }).eq('id', sellerId)

  if (error) return { error: error.message }
  revalidatePath('/admin/sellers')
  return { success: 'Seller suspended.' }
}

/* ---------------- FEE SETTINGS ---------------- */

export async function updateSettings(formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const commissionPercent = Number(formData.get('commission_percent') || 0)
  if (commissionPercent < 0 || commissionPercent > 100) {
    return { error: 'Commission must be between 0 and 100 percent.' }
  }

  const db = supabaseAdmin()
  const { error } = await db.from('platform_settings').update({
    commission_enabled:      formData.get('commission_enabled') === 'on',
    commission_percent:      commissionPercent,
    withdrawal_fee_enabled:  formData.get('withdrawal_fee_enabled') === 'on',
    withdrawal_fee_kobo:     nairaToKobo(Number(formData.get('withdrawal_fee') || 0)),
    delivery_fee_enabled:    formData.get('delivery_fee_enabled') === 'on',
    delivery_fee_kobo:       nairaToKobo(Number(formData.get('delivery_fee') || 0)),
    listing_fee_enabled:     formData.get('listing_fee_enabled') === 'on',
    listing_fee_kobo:        nairaToKobo(Number(formData.get('listing_fee') || 0)),
    pay_on_delivery_enabled: formData.get('pay_on_delivery_enabled') === 'on',
    auto_release_days:       Number(formData.get('auto_release_days') || 2),
    min_withdrawal_kobo:     nairaToKobo(Number(formData.get('min_withdrawal') || 0)),
    updated_at: new Date().toISOString(),
  }).eq('id', 1)

  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  return { success: 'Settings saved. New orders use these rates immediately.' }
}

/* ---------------- WITHDRAWALS ---------------- */

/**
 * Approve and send a payout.
 *
 * The seller's balance was already debited at request time, so this only
 * moves real money out via TransactPay. If the transfer fails, the
 * withdrawal is marked failed and the money is returned to their balance.
 */
export async function approveWithdrawal(withdrawalId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const db = supabaseAdmin()
  const { data: w } = await db.from('withdrawals').select('*').eq('id', withdrawalId).single()
  if (!w) return { error: 'Withdrawal not found.' }
  if (w.status !== 'requested') return { error: 'This withdrawal is not pending.' }

  await db.from('withdrawals')
    .update({ status: 'processing', processed_by: ctx.userId }).eq('id', withdrawalId)

  try {
    const payoutRef = `PO-${withdrawalId.slice(0, 8)}-${Date.now().toString(36)}`
    const res = await payoutToBank({
      reference: payoutRef,
      amountKobo: w.net_payout_kobo,
      bankCode: w.bank_code!,
      accountNumber: w.account_number!,
      accountName: w.account_name!,
      narration: 'Jojokev seller payout',
    })

    await db.from('withdrawals').update({
      status: 'paid',
      payout_reference: payoutRef,
    }).eq('id', withdrawalId)

    console.log('[payout] sent', payoutRef, res?.status)
    revalidatePath('/admin/withdrawals')
    return { success: 'Payout sent.' }
  } catch (err: any) {
    console.error('[payout] failed', err)

    // return the money — the seller must not lose funds to a failed transfer
    await db.rpc('reject_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_reason: `Payout failed: ${err.message}`,
    })
    await db.from('withdrawals')
      .update({ status: 'failed', failure_reason: err.message }).eq('id', withdrawalId)

    revalidatePath('/admin/withdrawals')
    return { error: 'Payout failed. Funds returned to the seller.' }
  }
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const db = supabaseAdmin()
  const { error } = await db.rpc('reject_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_reason: reason,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/withdrawals')
  return { success: 'Rejected and funds returned to the seller.' }
}

/* ---------------- DISPUTES ---------------- */

/** Force-release escrow — for support cases where a buyer went silent. */
export async function forceRelease(orderId: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const db = supabaseAdmin()
  const { error } = await db.rpc('release_order_escrow', {
    p_order_id: orderId,
    p_reason: 'released by admin',
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/orders')
  return { success: 'Escrow released to the seller.' }
}


/* ---------------- STOREFRONT BANNERS ---------------- */

export async function createBanner(formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const title = String(formData.get('title') || '').trim()
  const imageUrl = String(formData.get('image_url') || '').trim()
  if (!title || !imageUrl) return { error: 'Banner title and image are required.' }
  const db = supabaseAdmin()
  const { error } = await db.from('banners').insert({
    title,
    subtitle: String(formData.get('subtitle') || '').trim() || null,
    cta_label: String(formData.get('cta_label') || '').trim() || null,
    cta_url: String(formData.get('cta_url') || '').trim() || null,
    image_url: imageUrl,
    sort_order: Number(formData.get('sort_order') || 0),
    is_active: formData.get('is_active') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin/banners')
  return { success: 'Banner created.' }
}

export async function updateBanner(formData: FormData) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  const imageUrl = String(formData.get('image_url') || '').trim()
  if (!id || !title || !imageUrl) return { error: 'Banner title and image are required.' }
  const db = supabaseAdmin()
  const { error } = await db.from('banners').update({
    title,
    subtitle: String(formData.get('subtitle') || '').trim() || null,
    cta_label: String(formData.get('cta_label') || '').trim() || null,
    cta_url: String(formData.get('cta_url') || '').trim() || null,
    image_url: imageUrl,
    sort_order: Number(formData.get('sort_order') || 0),
    is_active: formData.get('is_active') === 'on',
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin/banners')
  return { success: 'Banner updated.' }
}

export async function deleteBanner(id: string) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { error } = await supabaseAdmin().from('banners').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin/banners')
  return { success: 'Banner deleted.' }
}
