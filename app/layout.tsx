import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import SiteHeader from '@/components/SiteHeader'
import { supabaseServer } from '@/lib/supabase/clients'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Jojokev — Shop smart. Shop local.',
  description: 'A trusted Nigerian marketplace with escrow-protected checkout.',
}

async function getWorkspaceRole() {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role ?? null
    return role && ['admin', 'seller', 'rider'].includes(role) ? role : null
  } catch {
    return null
  }
}

function StorefrontFooter() {
  return <footer className="bg-[#14251e] text-white"><div className="page-wrap grid gap-8 py-10 sm:grid-cols-4"><div><p className="text-2xl font-black tracking-[-.07em] text-[#d9f33f]">jojokev<span className="text-[#ff7a28]">.</span></p><p className="mt-3 max-w-xs text-sm leading-6 text-white/55">Shop from trusted Nigerian sellers with payment protection built into every order.</p></div><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-white/45">Shop</p><div className="mt-4 grid gap-2 text-sm text-white/70"><Link href="/search" className="hover:text-[#d9f33f]">Browse products</Link><Link href="/orders" className="hover:text-[#d9f33f]">Track an order</Link><Link href="/account" className="hover:text-[#d9f33f]">My account</Link></div></div><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-white/45">Sell</p><div className="mt-4 grid gap-2 text-sm text-white/70"><Link href="/sell" className="hover:text-[#d9f33f]">Become a seller</Link><Link href="/seller" className="hover:text-[#d9f33f]">Seller workspace</Link><span>Escrow-protected bank transfer</span></div></div><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-white/45">Help and trust</p><div className="mt-4 grid gap-2 text-sm text-white/70"><Link href="/how-it-works" className="hover:text-[#d9f33f]">How it works</Link><Link href="/about" className="hover:text-[#d9f33f]">About us</Link><Link href="/contact" className="hover:text-[#d9f33f]">Contact us</Link><Link href="/returns" className="hover:text-[#d9f33f]">Returns / refunds</Link><Link href="/terms" className="hover:text-[#d9f33f]">Terms</Link><Link href="/privacy" className="hover:text-[#d9f33f]">Privacy</Link></div></div></div><div className="border-t border-white/10"><div className="page-wrap flex flex-col gap-2 py-4 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Jojokev Marketplace. All rights reserved.</p><p>Built for better local commerce in Nigeria.</p></div></div></footer>
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const workspaceRole = await getWorkspaceRole()
  const workspace = Boolean(workspaceRole)
  return <html lang="en"><body className={`min-h-screen flex flex-col ${workspace ? 'bg-[#f2f5f2]' : ''}`}><SiteHeader /><main className="flex-1">{children}</main>{!workspace && <StorefrontFooter />}</body></html>
}
