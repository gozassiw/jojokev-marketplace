import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/clients'
import CartBadge from '@/components/CartBadge'
import { logout } from '@/app/actions/auth'
import MobileMenu from '@/components/MobileMenu'
import NotificationBell from '@/components/NotificationBell'

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
}
function UserIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.9-3.3 3.2-5 7-5s6.1 1.7 7 5" /></svg>
}
function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
}

export default async function SiteHeader() {
  let user = null
  let role: string | null = null
  let profileName: string | null = null
  let unreadCount = 0
  try {
    const supabase = await supabaseServer()
    const { data } = await supabase.auth.getUser()
    user = data.user
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      role = profile?.role ?? null
      profileName = profile?.full_name ?? null
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null)
      unreadCount = count || 0
    }
  } catch {
    // Supabase not configured yet — render logged-out header
  }

  const workspace = role === 'seller' || role === 'admin' || role === 'rider'
  const isSeller = role === 'seller'
  const isRider = role === 'rider'
  const workspaceHome = isSeller ? '/seller' : isRider ? '/rider' : '/admin'
  const workspaceLabel = isSeller ? 'Seller workspace' : isRider ? 'Rider workspace' : 'Admin control room'
  const initials = (profileName || user?.email || 'U').slice(0, 1).toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur" style={{ borderColor: 'var(--line)' }}>
      <div className="bg-[#14251e] text-white">
        <div className="page-wrap flex h-9 items-center justify-between text-[11px] font-semibold tracking-wide">
          {workspace ? <><p className="text-white/75">{workspaceLabel}</p><Link href="/" className="font-bold text-[#d9f33f] hover:text-white">View storefront →</Link></> : <p className="ml-auto hidden text-white/70 sm:block">Secure shopping from trusted Nigerian sellers</p>}
        </div>
      </div>
      <div className="page-wrap flex min-h-[72px] items-center gap-2 py-3 sm:gap-4">
        <MobileMenu workspace={workspace} isSeller={isSeller} role={role} />
        <Link href={workspace ? workspaceHome : '/'} className="shrink-0" aria-label={workspace ? workspaceLabel : 'Jojokev home'}>
          <span className="block text-[26px] font-black tracking-[-.07em] text-[#14805d]">jojokev<span className="text-[#ff7a28]">.</span></span>
          <span className="hidden text-[9px] font-bold uppercase tracking-[.2em] text-slate-400 sm:block">{workspace ? (isSeller ? 'seller operations' : 'platform operations') : 'shop smart. shop local.'}</span>
        </Link>
        {user && <NotificationBell initialCount={unreadCount} />}
        {!workspace && <form action="/search" className="hidden min-w-0 flex-1 md:block"><label className="flex h-11 items-center gap-3 rounded-xl border bg-[#f7f8f6] px-4 text-sm text-slate-500" style={{ borderColor: 'var(--line)' }}><SearchIcon /><input name="q" placeholder="Search products, brands and categories" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" /><button className="rounded-lg bg-[#14805d] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0b5d43]">Search</button></label></form>}
        {workspace && <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">{(isSeller ? [['/seller', 'Dashboard'], ['/seller/products', 'Products'], ['/seller/orders', 'Orders'], ['/seller/wallet', 'Balance / payouts']] : isRider ? [['/rider', 'Deliveries'], ['/rider/wallet', 'Wallet'], ['/notifications', 'Notifications']] : [['/admin', 'Overview'], ['/admin/sellers', 'Sellers'], ['/admin/riders', 'Riders'], ['/admin/delivery-areas', 'Delivery Areas'], ['/admin/dispatch', 'Dispatch'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'], ['/admin/withdrawals', 'Payouts'], ['/admin/banners', 'Banners']]).map(([href, label]) => <Link key={href} href={href} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-[#e5f6ee] hover:text-[#0b5d43]">{label}</Link>)}</nav>}
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {!workspace && <Link href="/search" className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-[#e5f6ee] hover:text-[#0b5d43] lg:flex">Categories <ChevronIcon /></Link>}
          {user ? <><Link href="/orders" className={`${workspace ? 'hidden' : 'hidden sm:flex'} rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-[#e5f6ee] hover:text-[#0b5d43]`}>Orders</Link><details className="relative block"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-2 hover:bg-[#e5f6ee]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#d9f33f] text-sm font-black text-[#14251e]">{initials}</span><span className="hidden max-w-[95px] truncate text-xs font-bold text-slate-700 lg:block">{profileName || 'My account'}</span></summary><div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border bg-white p-2 text-sm shadow-xl" style={{ borderColor: 'var(--line)' }}><div className="border-b px-3 pb-3 pt-2" style={{ borderColor: 'var(--line)' }}><p className="font-black">{profileName || 'My account'}</p><p className="mt-1 truncate text-xs text-slate-500">{user.email}</p><span className="mt-2 inline-flex rounded-full bg-[#e5f6ee] px-2 py-1 text-[10px] font-bold uppercase text-[#0b5d43]">{role || 'buyer'}</span></div><div className="grid gap-1 py-2"><Link href="/account" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Account overview</Link>{!workspace && <Link href="/account/addresses" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Addresses</Link>}{isSeller && <Link href="/seller" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Seller dashboard</Link>}{isRider && <><Link href="/rider" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Rider deliveries</Link><Link href="/rider/wallet" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Rider wallet</Link></>}{role === 'admin' && <Link href="/admin" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Admin dashboard</Link>}{user && <Link href="/notifications" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">Notifications</Link>}{workspace && <Link href="/" className="rounded-xl px-3 py-2 font-semibold hover:bg-[#f7f8f6]">View storefront</Link>}</div><form action={logout} className="border-t pt-2" style={{ borderColor: 'var(--line)' }}><button type="submit" className="w-full rounded-xl px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50">Log out</button></form></div></details></> : <Link href="/login" className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-bold text-slate-700 hover:bg-[#e5f6ee] hover:text-[#0b5d43]"><UserIcon /><span className="hidden sm:inline">Account</span></Link>}
          {!workspace && <Link href="/cart" className="relative flex items-center gap-2 rounded-xl bg-[#f7f8f6] px-3 py-2 text-sm font-bold text-slate-700 hover:bg-[#e5f6ee] hover:text-[#0b5d43]"><span className="text-lg leading-none">🛒</span><span className="hidden sm:inline">Cart</span><CartBadge /></Link>}
          {!user && <Link href="/register" className="hidden rounded-xl bg-[#14805d] px-3 py-2 text-sm font-bold text-white hover:bg-[#0b5d43] sm:block">Sign up</Link>}
        </nav>
      </div>
      {!workspace && <form action="/search" className="page-wrap pb-3 md:hidden"><label className="flex h-12 items-center gap-3 rounded-full bg-[#f1f1f1] px-4 text-slate-500"><SearchIcon /><input name="q" placeholder="Search products, brands and categories" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /><button className="sr-only">Search</button></label></form>}
      {workspace && <div className="page-wrap flex items-center gap-4 overflow-x-auto border-t py-2.5 text-xs font-bold text-slate-600 lg:hidden" style={{ borderColor: 'var(--line)' }}>{(isSeller ? [['/seller', 'Dashboard'], ['/seller/products', 'Products'], ['/seller/orders', 'Orders'], ['/seller/wallet', 'Balance / payouts']] : isRider ? [['/rider', 'Deliveries'], ['/rider/wallet', 'Wallet'], ['/notifications', 'Notifications']] : [['/admin', 'Overview'], ['/admin/sellers', 'Sellers'], ['/admin/riders', 'Riders'], ['/admin/delivery-areas', 'Delivery Areas'], ['/admin/dispatch', 'Dispatch'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'], ['/admin/withdrawals', 'Payouts'], ['/admin/banners', 'Banners']]).map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap hover:text-[#14805d]">{label}</Link>)}</div>}
    </header>
  )
}
