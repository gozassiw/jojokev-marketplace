import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/clients'

export const dynamic = 'force-dynamic'

export default async function SellerDisputesPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/disputes')
  const { data: seller } = await supabase.from('seller_profiles').select('business_name, status').eq('user_id', user.id).single()
  if (!seller || seller.status !== 'approved') redirect('/seller/pending')
  return <div className="dashboard-shell"><div className="page-wrap py-6 sm:py-8"><div className="mb-6"><p className="section-kicker">Seller workspace</p><h1 className="text-3xl font-black tracking-tight">Disputes & support</h1><p className="mt-1 text-sm text-slate-500">A calm place to keep order issues moving toward resolution.</p></div><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="surface p-6 sm:p-8"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e5f6ee] text-2xl">🤝</div><h2 className="mt-5 text-2xl font-black">No open disputes</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">When a buyer raises an issue, the order will be reviewed with its payment and delivery history. Keep your shipment updates accurate so every order has a clear trail.</p><div className="mt-6 rounded-2xl bg-[#f7f8f6] p-4 text-sm"><p className="font-black">Need help with an order?</p><p className="mt-1 text-xs leading-5 text-slate-500">Start with your orders list and make sure the latest fulfilment status is recorded.</p><Link href="/seller/orders" className="mt-3 inline-block text-xs font-bold text-[#14805d]">Review my orders →</Link></div></section><section className="surface p-6 sm:p-8"><p className="section-kicker">Resolution basics</p><h2 className="text-xl font-black">Keep buyers informed</h2><div className="mt-5 space-y-4 text-sm"><p className="flex gap-3"><span className="font-black text-[#14805d]">01</span><span><b>Ship promptly.</b><br /><span className="text-xs text-slate-500">Mark paid orders shipped after dispatch.</span></span></p><p className="flex gap-3"><span className="font-black text-[#14805d]">02</span><span><b>Add delivery clarity.</b><br /><span className="text-xs text-slate-500">Use order updates to keep the timeline visible.</span></span></p><p className="flex gap-3"><span className="font-black text-[#14805d]">03</span><span><b>Escrow protects both sides.</b><br /><span className="text-xs text-slate-500">Funds release only after delivery confirmation or auto-release.</span></span></p></div></section></div></div></div>
}
