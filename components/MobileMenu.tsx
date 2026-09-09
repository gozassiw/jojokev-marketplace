'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function MenuIcon() { return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 6h16M4 12h16M4 18h16" /></svg> }
function CloseIcon() { return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 6 12 12M18 6 6 18" /></svg> }
function ArrowIcon() { return <span className="text-xl leading-none text-slate-400">›</span> }

const buyerCategories = [
  ['📱', 'Phones & tablets', '/search?category=phones-tablets'],
  ['👗', 'Fashion', '/search?category=fashion'],
  ['🍼', 'Baby products', '/search?category=baby-products'],
  ['🎮', 'Electronics', '/search?category=electronics'],
  ['🏋️', 'Sporting goods', '/search?category=sporting-goods'],
  ['🚗', 'Automobile', '/search?category=automobile'],
  ['🏠', 'Home & kitchen', '/search?category=home-kitchen'],
]

const workspaceMenus: Record<string, { title: string; subtitle: string; links: [string, string][] }> = {
  seller: {
    title: 'Seller workspace',
    subtitle: 'Run your shop and track your money',
    links: [['Workspace', '/seller'], ['Products', '/seller/products'], ['Orders', '/seller/orders'], ['Wallet & held funds', '/seller/wallet'], ['Disputes', '/seller/disputes'], ['Notifications', '/notifications']],
  },
  rider: {
    title: 'Rider workspace',
    subtitle: 'Accept jobs and complete deliveries safely',
    links: [['Wallet & home', '/rider'], ['Quotes', '/rider#quotes'], ['Live orders', '/rider#live-orders'], ['Completed deliveries', '/rider#completed'], ['Wallet & withdrawals', '/rider/wallet'], ['Notifications', '/notifications']],
  },
  admin: {
    title: 'Admin control room',
    subtitle: 'Manage the Jojokev marketplace',
    links: [['Overview', '/admin'], ['Seller applications', '/admin/sellers'], ['Rider applications', '/admin/riders'], ['Store Areas', '/admin/store-areas'], ['Delivery fees', '/admin/delivery-areas'], ['Dispatch', '/admin/dispatch'], ['Orders', '/admin/orders'], ['Products', '/admin/products'], ['Payouts', '/admin/withdrawals'], ['Banners', '/admin/banners'], ['Notifications', '/notifications']],
  },
}

export default function MobileMenu({ workspace, isSeller, role }: { workspace: boolean; isSeller: boolean; role: string | null }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const close = () => setOpen(false)
  const menu = role ? workspaceMenus[role] : null

  const drawer = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button type="button" aria-label="Close menu" onClick={close} className="absolute inset-0 bg-black/45" />
      <aside onClick={event => event.stopPropagation()} className="absolute bottom-0 left-0 top-0 flex w-[min(88vw,390px)] flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b px-5" style={{ borderColor: 'var(--line)' }}><Link href={workspace ? (isSeller ? '/seller' : role === 'rider' ? '/rider' : '/admin') : '/'} onClick={close} className="text-[27px] font-black tracking-[-.08em] text-[#14805d]">jojokev<span className="text-[#ff7a28]">.</span></Link><button type="button" aria-label="Close menu" onClick={close} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-slate-100"><CloseIcon /></button></div>

        {workspace && menu ? <div className="min-h-0 flex-1 overflow-y-auto"><div className="border-b bg-[#14251e] px-5 py-5 text-white"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#d9f33f]">{menu.title}</p><p className="mt-2 text-lg font-black">{menu.subtitle}</p></div><div className="p-3">{menu.links.map(([label, href]) => <Link key={href} href={href} onClick={close} className="flex items-center justify-between rounded-xl px-3 py-3.5 text-sm font-bold text-slate-700 hover:bg-[#e5f6ee] hover:text-[#0b5d43]"><span>{label}</span><ArrowIcon /></Link>)}</div></div> : <div className="min-h-0 flex-1 overflow-y-auto"><div className="border-b px-5 py-4"><Link href="/account" onClick={close} className="flex items-center justify-between py-2 text-base font-black text-slate-800"><span>My account</span><ArrowIcon /></Link><Link href="/orders" onClick={close} className="flex items-center justify-between py-2 text-sm font-semibold text-slate-700"><span>Orders</span><ArrowIcon /></Link><Link href="/account/addresses" onClick={close} className="flex items-center justify-between py-2 text-sm font-semibold text-slate-700"><span>Addresses</span><ArrowIcon /></Link></div><div className="px-5 py-5"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Categories</p><Link href="/search" onClick={close} className="text-xs font-bold text-[#d99032]">See all</Link></div>{buyerCategories.map(([icon, label, href]) => <Link key={label} href={href} onClick={close} className="flex items-center gap-4 py-3 text-sm font-semibold capitalize text-slate-700"><span className="grid h-8 w-8 place-items-center text-xl grayscale">{icon}</span><span>{label}</span></Link>)}</div><div className="border-t px-5 py-5"><div className="grid gap-2 text-sm font-semibold text-slate-700"><Link href="/sell/register" onClick={close} className="rounded-xl bg-[#14251e] px-4 py-3 text-center font-black text-[#d9f33f]">Start selling on Jojokev</Link><Link href="/rider/register" onClick={close} className="rounded-xl border border-[#14805d] px-4 py-3 text-center font-black text-[#14805d]">Become a Jojokev rider</Link><a href="mailto:support@jojokev.com" onClick={close} className="py-2">Contact us</a><Link href="/register" onClick={close} className="rounded-xl bg-[#14805d] px-4 py-3 text-center font-black text-white">Create a customer account</Link></div></div></div>}
      </aside>
    </div>,
    document.body,
  ) : null

  return <><button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-800 hover:bg-slate-100 md:hidden"><MenuIcon /></button>{drawer}</>
}
