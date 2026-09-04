'use server'

import { supabaseAdmin } from '@/lib/supabase/clients'
import { getEffectiveFees } from '@/lib/settings'

export type PricedLine = {
  productId: string
  title: string
  unitPriceKobo: number
  quantity: number
  lineTotalKobo: number
  sellerId: string
  sellerName: string
  image: string | null
  stock: number
  inStock: boolean
}

/**
 * Resolve a browser cart into real prices from the database.
 * Also used to render the cart page, so the buyer always sees live prices.
 */
export async function priceCart(lines: { productId: string; quantity: number }[]) {
  if (!lines.length) {
    return { items: [] as PricedLine[], subtotalKobo: 0, deliveryFeeKobo: 0, totalKobo: 0 }
  }

  // Resolve catalog data server-side so seller-profile RLS cannot hide valid buyer cart lines.
  const supabase = supabaseAdmin()
  const { data: products } = await supabase
    .from('products')
    .select('id, title, price_kobo, stock, images, status, seller_id, seller_profiles(business_name, status)')
    .in('id', lines.map(l => l.productId))

  const items: PricedLine[] = []
  for (const line of lines) {
    const p = products?.find((x: any) => x.id === line.productId)
    if (!p) continue                                  // product deleted
    if (p.status !== 'active') continue               // no longer for sale
    if ((p as any).seller_profiles?.status !== 'approved') continue

    const quantity = Math.max(1, Math.floor(line.quantity))
    items.push({
      productId: p.id,
      title: p.title,
      unitPriceKobo: p.price_kobo,
      quantity,
      lineTotalKobo: p.price_kobo * quantity,
      sellerId: p.seller_id,
      sellerName: (p as any).seller_profiles?.business_name ?? 'Seller',
      image: p.images?.[0] ?? null,
      stock: p.stock,
      inStock: p.stock >= quantity,
    })
  }

  const subtotalKobo = items.reduce((s, i) => s + i.lineTotalKobo, 0)
  const { deliveryFeeKobo } = await getEffectiveFees()
  // One delivery fee per order. Change to a per-seller fee here if you later
  // want each vendor to ship separately.
  const fee = items.length ? deliveryFeeKobo : 0

  return { items, subtotalKobo, deliveryFeeKobo: fee, totalKobo: subtotalKobo + fee }
}
