import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SellerDashboard() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller')
  const { data: seller } = await supabase.from('seller_profiles').select('id, business_name, status').eq('user_id', user.id).single()
  if (!seller) redirect('/sell')
  if (seller.status !== 'approved') redirect('/seller/pending')

  const [{ data: wallet }, { data: items }, { data: products }] = await Promise.all([
    supabase.from('wallets').select('available_balance_kobo, hold_balance_kobo, lifetime_earned_kobo').eq('seller_id', seller.id).single(),
    supabase.from('order_items').select('quantity').eq('seller_id', seller.id),
    supabase.from('products').select('id, status').eq('seller_id', seller.id),
  ])

  const totalUnits = (items ?? []).reduce((sum, item) => sum + item.quantity, 0)
  const activeProducts = (products ?? []).filter(product => product.status === 'active').length
  const stats = [
    { label: 'Available balance', value: formatNaira(wallet?.available_balance_kobo ?? 0), icon: '↗', tone: 'bg-[#d9f33f]' },
    { label: 'Held until delivery', value: formatNaira(wallet?.hold_balance_kobo ?? 0), icon: '⛨', tone: 'bg-[#fff0e6]' },
    { label: 'Active products', value: String(activeProducts), icon: '▤', tone: 'bg-[#e5f6ee]' },
    { label: 'Units sold', value: String(totalUnits), icon: '◒', tone: 'bg-[#eeeefe]' },
  ]

  const nav = [['/seller/products', '📦', 'Products'], ['/seller/orders', '🚚', 'Orders'], ['/seller/wallet', '↗', 'Balance / payouts']]

  return <div className="dashboard-shell"><div className="page-wrap py-6 sm:py-8">
    <section className="relative overflow-hidden rounded-3xl bg-[#14251e] p-6 text-white sm:p-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#14805d]/60 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><span className="eyebrow bg-white/10 text-[#d9f33f]">Seller workspace</span><h1 className="mt-4 text-3xl font-black tracking-[-.05em] sm:text-5xl">Welcome back,<br /><span className="text-[#d9f33f]">{seller.business_name}.</span></h1><p className="mt-3 max-w-lg text-sm leading-6 text-white/65">Add products, process orders, and track the money protected in escrow.</p></div><div className="flex flex-wrap gap-2"><Link href="/seller/products" className="rounded-xl bg-[#d9f33f] px-4 py-3 text-sm font-black text-[#14251e] hover:bg-white">Add a product</Link><Link href="/seller/orders" className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">View orders</Link></div></div></section>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(stat => <div key={stat.label} className="dashboard-stat"><span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${stat.tone}`}>{stat.icon}</span><p className="mt-5 text-2xl font-black tracking-tight">{stat.value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{stat.label}</p></div>)}</section>
    <nav className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2 sm:grid-cols-3" style={{ borderColor: 'var(--line)' }}>{nav.map(([href, icon, label]) => <Link key={href} href={href} className="flex items-center gap-2 rounded-xl px-3 py-3 text-xs font-bold text-slate-600 transition hover:bg-[#e5f6ee] hover:text-[#0b5d43]"><span className="text-base">{icon}</span>{label}</Link>)}</nav>
    <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="surface p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="section-kicker">Your shop</p><h2 className="text-xl font-black">Keep your storefront ready</h2></div><span className="rounded-full bg-[#e5f6ee] px-3 py-1 text-xs font-bold text-[#0b5d43]">{activeProducts} active listings</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/seller/products" className="group rounded-2xl bg-[#f7f8f6] p-4 transition hover:bg-[#e5f6ee]"><span className="text-2xl">📦</span><p className="mt-3 text-sm font-black">Products</p><p className="mt-1 text-xs text-slate-500">Add, edit or remove stock.</p><p className="mt-3 text-xs font-bold text-[#14805d]">Manage products →</p></Link><Link href="/seller/orders" className="group rounded-2xl bg-[#f7f8f6] p-4 transition hover:bg-[#e5f6ee]"><span className="text-2xl">🚚</span><p className="mt-3 text-sm font-black">Orders</p><p className="mt-1 text-xs text-slate-500">Prepare orders and update buyers.</p><p className="mt-3 text-xs font-bold text-[#14805d]">Open orders →</p></Link></div></div><div className="surface p-5 sm:p-6"><p className="section-kicker">Payment protection</p><h2 className="text-xl font-black">Get paid with confidence</h2><p className="mt-3 text-sm leading-6 text-slate-500">Buyer payments stay safely in your hold balance. After delivery is confirmed, the funds move to your available balance.</p><div className="mt-5 rounded-2xl bg-[#e5f6ee] p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white">⛨</span><div><p className="text-sm font-black text-[#0b5d43]">Escrow is working for you</p><p className="mt-1 text-xs text-[#14805d]">Available funds can be requested from your balance.</p></div></div></div><Link href="/seller/wallet" className="mt-4 block text-sm font-bold text-[#14805d] hover:underline">View balance and payouts →</Link></div></section>
  </div></div>
}
