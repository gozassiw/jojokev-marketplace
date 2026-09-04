import { supabaseAdmin } from '@/lib/supabase/clients'

export type PlatformSettings = {
  commission_enabled: boolean
  commission_percent: number
  withdrawal_fee_enabled: boolean
  withdrawal_fee_kobo: number
  delivery_fee_enabled: boolean
  delivery_fee_kobo: number
  listing_fee_enabled: boolean
  listing_fee_kobo: number
  pay_on_delivery_enabled: boolean
  auto_release_days: number
  min_withdrawal_kobo: number
}

/** Always read fresh — an admin may have just changed a fee. */
export async function getSettings(): Promise<PlatformSettings> {
  const db = supabaseAdmin()
  const { data, error } = await db.from('platform_settings').select('*').eq('id', 1).single()
  if (error || !data) throw new Error('Platform settings missing. Did 01_schema.sql run?')
  return data as PlatformSettings
}

/** Effective values with toggles applied — use these, never the raw columns. */
export async function getEffectiveFees() {
  const s = await getSettings()
  return {
    commissionPercent: s.commission_enabled ? Number(s.commission_percent) : 0,
    deliveryFeeKobo:   s.delivery_fee_enabled ? s.delivery_fee_kobo : 0,
    withdrawalFeeKobo: s.withdrawal_fee_enabled ? s.withdrawal_fee_kobo : 0,
    listingFeeKobo:    s.listing_fee_enabled ? s.listing_fee_kobo : 0,
    autoReleaseDays:   s.auto_release_days,
    minWithdrawalKobo: s.min_withdrawal_kobo,
    payOnDelivery:     s.pay_on_delivery_enabled,
  }
}
