import { supabaseAdmin } from '@/lib/supabase/clients'
import BannerManager from '@/components/BannerManager'

export const dynamic = 'force-dynamic'

export default async function AdminBannersPage() {
  const { data: banners } = await supabaseAdmin().from('banners').select('id, title, subtitle, cta_label, cta_url, image_url, sort_order, is_active').order('sort_order', { ascending: true }).order('created_at', { ascending: false })
  return <div><div className="mb-6"><p className="section-kicker">Storefront content</p><h1 className="text-3xl font-black tracking-tight">Banners & slides</h1><p className="mt-1 text-sm text-slate-500">Upload the campaigns customers see on the homepage. Active slides change every 10 seconds.</p></div><BannerManager banners={banners ?? []} /></div>
}
