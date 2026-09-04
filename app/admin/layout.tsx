import Link from 'next/link'

const NAV = [
  { href: '/admin', label: 'Overview', icon: '▦' },
  { href: '/admin/sellers', label: 'Sellers', icon: '♙' },
  { href: '/admin/orders', label: 'Orders', icon: '▤' },
  { href: '/admin/products', label: 'Products', icon: '▧' },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: '↗' },
  { href: '/admin/revenue', label: 'Revenue', icon: '◒' },
  { href: '/admin/banners', label: 'Banners', icon: '▰' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell">
      <div className="page-wrap grid gap-6 py-5 lg:grid-cols-[230px_1fr] lg:gap-8 lg:py-8">
        <aside className="dashboard-sidebar rounded-3xl p-4 lg:p-5">
          <div className="flex items-center justify-between lg:block">
            <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#d9f33f]">Jojokev</p><h2 className="mt-1 text-xl font-black tracking-tight">Control room</h2></div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/60 lg:mt-5 lg:inline-block">ADMIN</span>
          </div>
          <nav className="mt-5 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:block lg:space-y-1">
            {NAV.map(item => <Link key={item.href} href={item.href} className="dashboard-link"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-sm text-[#d9f33f]">{item.icon}</span><span>{item.label}</span></Link>)}
          </nav>
          <div className="mt-6 hidden rounded-2xl bg-[#1e3b2f] p-4 lg:block"><p className="text-xs font-bold text-white">Marketplace health</p><p className="mt-2 text-[11px] leading-5 text-white/60">Keep an eye on pending sellers, escrow liability and payouts.</p><Link href="/" className="mt-3 inline-block text-xs font-bold text-[#d9f33f]">View storefront →</Link></div>
        </aside>
        <main className="min-w-0">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#14805d]">Operations</p><h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Marketplace admin</h1></div><div className="rounded-full border bg-white px-3 py-2 text-xs font-bold text-slate-500" style={{ borderColor: 'var(--line)' }}>Live workspace</div></div>
          {children}
        </main>
      </div>
    </div>
  )
}
