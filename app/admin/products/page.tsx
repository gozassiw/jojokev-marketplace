import { supabaseAdmin } from '@/lib/supabase/clients'
import AdminProducts from '@/components/AdminProducts'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const db = supabaseAdmin()
  const { data: products } = await db
    .from('products')
    .select('id, title, slug, price_kobo, stock, status, created_at, seller_profiles(business_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Product moderation</h1>
      <AdminProducts products={products ?? []} />
    </div>
  )
}
