import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'

export const dynamic = 'force-dynamic'

function sum(rows: any[] | null, key: string) { return (rows ?? []).reduce((total, row) => total + Number(row[key] ?? 0), 0) }

export default async function AdminDashboard() {
  const db = supabaseAdmin()
  const [revenue, orders, sellers, withdrawals, wallets] = await Promise.all([
    db.from('platform_revenue').select('source, amount_kobo').limit(500),
    db.from('orders').select('status, total_kobo').limit(500),
    db.from('seller_profiles').select('status').limit(500),
    db.from('withdrawals').select('status, net_payout_kobo').eq('status', 'requested').limit(100),
    db.from('wallets').select('hold_balance_kobo, available_balance_kobo').limit(500),
  ])
  const bySource = (src: string) => sum((revenue.data ?? []).filter(r => r.source === src), 'amount_kobo')
  const totalRevenue = bySource('commission') + bySource('withdrawal_fee') + bySource('adjustment')
  const orderRows = orders.data ?? []
  const pendingSellers = (sellers.data ?? []).filter(s => s.status === 'pending').length
  const pendingPayouts = withdrawals.data ?? []
  const escrowLiability = sum(wallets.data, 'hold_balance_kobo') + sum(wallets.data, 'available_balance_kobo')
  const stats = [
    { label: 'Gross platform revenue', value: formatNaira(totalRevenue), icon: '◒', tone: 'bg-[#e5f6ee] text-[#0b5d43]' },
    { label: 'Escrow liability', value: formatNaira(escrowLiability), icon: '⛨', tone: 'bg-[#fff1e8] text-[#c45410]' },
    { label: 'Orders processed', value: String(orderRows.length), icon: '▤', tone: 'bg-[#eeeefe] text-[#4b45c4]' },
    { label: 'Pending payouts', value: String(pendingPayouts.length), icon: '↗', tone: 'bg-[#fff7d9] text-[#996d00]' },
  ]
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#14251e] p-6 text-white sm:p-8"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d9f33f]/15 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><span className="eyebrow bg-white/10 text-[#d9f33f]">Good morning, admin</span><h2 className="mt-4 max-w-xl text-3xl font-black tracking-[-.05em] sm:text-4xl">Keep the marketplace moving.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/65">A quick view of marketplace health, money in motion, and actions waiting on you.</p></div><Link href="/admin/sellers" className="inline-flex rounded-xl bg-[#d9f33f] px-4 py-3 text-sm font-black text-[#14251e] hover:bg-white">Review sellers →</Link></div></section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s => <div key={s.label} className="dashboard-stat"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${s.tone}`}>{s.icon}</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live</span></div><p className="mt-5 text-2xl font-black tracking-tight">{s.value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{s.label}</p></div>)}</section>
      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="surface p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="section-kicker">Action centre</p><h3 className="text-xl font-black">Needs your attention</h3></div><span className="rounded-full bg-[#f2f5f2] px-3 py-1 text-xs font-bold text-slate-500">{pendingSellers + pendingPayouts.length} items</span></div><div className="mt-5 space-y-3">{pendingSellers > 0 && <Link href="/admin/sellers" className="flex items-center justify-between rounded-2xl bg-[#fff7d9] p-4 transition hover:shadow-md"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg">♙</span><div><p className="text-sm font-black">Seller applications</p><p className="mt-1 text-xs text-slate-500">{pendingSellers} seller application{pendingSellers > 1 ? 's' : ''} awaiting review</p></div></div><span className="font-bold text-[#996d00]">→</span></Link>}{pendingPayouts.length > 0 && <Link href="/admin/withdrawals" className="flex items-center justify-between rounded-2xl bg-[#e5f6ee] p-4 transition hover:shadow-md"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg">↗</span><div><p className="text-sm font-black">Withdrawal requests</p><p className="mt-1 text-xs text-slate-500">{pendingPayouts.length} payout request{pendingPayouts.length > 1 ? 's' : ''} to process</p></div></div><span className="font-bold text-[#0b5d43]">→</span></Link>}{pendingSellers === 0 && pendingPayouts.length === 0 && <div className="rounded-2xl bg-[#f7f8f6] p-6 text-center"><div className="text-3xl">✨</div><p className="mt-2 text-sm font-bold">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">No urgent marketplace actions right now.</p></div>}</div></div>
        <div className="surface p-5 sm:p-6"><p className="section-kicker">Quick links</p><h3 className="text-xl font-black">Go somewhere fast</h3><div className="mt-5 grid gap-2">{[['/admin/orders', 'Orders', 'Manage fulfilment and delivery'], ['/admin/products', 'Products', 'Moderate marketplace listings'], ['/admin/revenue', 'Revenue', 'Review platform earnings'], ['/admin/settings', 'Settings', 'Tune marketplace fees']].map(([href, title, text]) => <Link key={href} href={href} className="group flex items-center justify-between rounded-xl border p-3 transition hover:border-[#14805d] hover:bg-[#e5f6ee]" style={{ borderColor: 'var(--line)' }}><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-[11px] text-slate-500">{text}</p></div><span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#14805d]">→</span></Link>)}</div></div>
      </section>
    </div>
  )
}
