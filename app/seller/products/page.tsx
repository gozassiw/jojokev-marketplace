import { supabaseServer } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import ProductManager from '@/components/ProductManager'

export const dynamic = 'force-dynamic'

export default async function SellerProductsPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/products')
  const { data: seller } = await supabase.from('seller_profiles').select('id, business_name, status').eq('user_id', user.id).single()
  if (!seller || seller.status !== 'approved') redirect('/seller/pending')
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('sort_order'),
  ])
  return <div className="dashboard-shell"><div className="page-wrap py-6 sm:py-8"><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="section-kicker">Seller workspace</p><h1 className="text-3xl font-black tracking-tight">My products</h1><p className="mt-1 text-sm text-slate-500">Keep {seller.business_name} stocked and discoverable.</p></div><div className="rounded-full bg-[#e5f6ee] px-3 py-1.5 text-xs font-bold text-[#0b5d43]">{products?.length ?? 0} listings</div></div><div className="surface p-4 sm:p-6"><ProductManager products={products ?? []} categories={categories ?? []} /></div></div></div>
}
