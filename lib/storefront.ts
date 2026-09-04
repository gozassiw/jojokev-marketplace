import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/clients'

export const getCachedHomepageData = unstable_cache(async () => {
  const db = supabaseAdmin()
  const [{ data: categories }, { data: products }, { data: banners }] = await Promise.all([
    db.from('categories').select('*').order('sort_order').limit(16),
    db.from('products').select('id, title, slug, price_kobo, images, stock, seller_id, seller_profiles(business_name)').eq('status', 'active').order('created_at', { ascending: false }).limit(24),
    db.from('banners').select('id, title, subtitle, cta_label, cta_url, image_url, sort_order').eq('is_active', true).order('sort_order').limit(12),
  ])
  return { categories: categories ?? [], products: products ?? [], banners: banners ?? [] }
}, ['jojokev-homepage'], { revalidate: 60, tags: ['jojokev-homepage'] })
