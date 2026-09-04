import { supabaseAdmin } from '@/lib/supabase/clients'
import AdminSellers from '@/components/AdminSellers'

export const dynamic = 'force-dynamic'

export default async function AdminSellersPage() {
  const db = supabaseAdmin()
  const { data: rows, error } = await db.from('seller_profiles').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) {
    console.error('[admin sellers] load failed', error)
    return <div className="surface border-red-200 bg-red-50 p-6"><p className="text-sm font-bold text-red-700">Seller applications could not be loaded.</p><p className="mt-1 text-xs text-red-600">Refresh the page and try again.</p></div>
  }

  const sellers = rows ?? []
  const userIds = sellers.map(s => s.user_id).filter(Boolean)
  const { data: profiles } = userIds.length ? await db.from('profiles').select('id, full_name').in('id', userIds) : { data: [] as any[] }
  const names = new Map((profiles ?? []).map(p => [p.id, p.full_name]))
  const hydrated = sellers.map(s => ({ ...s, profiles: { full_name: names.get(s.user_id) ?? 'Applicant' } }))

  return <div><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="section-kicker">Marketplace operations</p><h1 className="text-3xl font-black tracking-tight">Seller applications</h1><p className="mt-1 text-sm text-slate-500">Review new businesses before they can list products.</p></div><span className="rounded-full bg-[#fff7d9] px-3 py-1.5 text-xs font-bold text-[#8d6500]">{hydrated.filter(s => s.status === 'pending').length} pending</span></div><AdminSellers sellers={hydrated} /></div>
}
