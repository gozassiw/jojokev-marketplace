/** All money in this app is an integer number of kobo. ₦1,500.00 = 150000 */

export const nairaToKobo = (naira: number) => Math.round(naira * 100)
export const koboToNaira = (kobo: number) => kobo / 100

/** ₦1,500 — for display */
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

/**
 * Commission, rounded DOWN to whole kobo.
 * Rounding down means the platform never takes a fraction it isn't owed,
 * and seller_net + commission always equals the line total exactly.
 */
export function calcCommission(lineTotalKobo: number, percent: number): number {
  return Math.floor((lineTotalKobo * percent) / 100)
}
