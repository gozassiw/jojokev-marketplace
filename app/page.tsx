import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/clients'
import { getCachedHomepageData } from '@/lib/storefront'
import ProductCard from '@/components/ProductCard'
import StorefrontHero from '@/components/StorefrontHero'

export const dynamic = 'force-dynamic'

const fallbackCategories = [
  { slug: 'phones-tablets', name: 'Phones & tablets', icon: '📱', tone: 'bg-blue-50' },
  { slug: 'fashion', name: 'Fashion', icon: '👗', tone: 'bg-rose-50' },
  { slug: 'baby-products', name: 'Baby products', icon: '🍼', tone: 'bg-yellow-50' },
  { slug: 'electronics', name: 'Electronics', icon: '🎮', tone: 'bg-violet-50' },
  { slug: 'sporting-goods', name: 'Sporting goods', icon: '🏋️', tone: 'bg-orange-50' },
  { slug: 'automobile', name: 'Automobile', icon: '🚗', tone: 'bg-slate-100' },
  { slug: 'home-kitchen', name: 'Home & kitchen', icon: '🏠', tone: 'bg-emerald-50' },
]

export default async function HomePage() {
  let role: string | null = null
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      role = profile?.role ?? null
    }
  } catch {
    // A missing or unavailable session should continue to the public storefront.
  }

  // Keep redirect() outside the try/catch: Next.js implements it by throwing a
  // special control-flow exception that must not be swallowed.
  if (role === 'admin') redirect('/admin')
  if (role === 'seller') redirect('/seller')
  if (role === 'rider') redirect('/rider')

  let categories: any[] = []
  let products: any[] = []
  let banners: any[] = []
  try {
    const data = await getCachedHomepageData()
    categories = data.categories.length ? data.categories : fallbackCategories
    products = data.products
    banners = data.banners
  } catch {
    categories = fallbackCategories
  }

  const displayCategories = categories.slice(0, 8).map((category, index) => ({
    ...fallbackCategories[index % fallbackCategories.length],
    ...category,
    icon: category.icon ?? fallbackCategories[index % fallbackCategories.length].icon,
    tone: category.tone ?? fallbackCategories[index % fallbackCategories.length].tone,
  }))

  return (
    <div className="min-h-screen bg-[#f4f4f4] pb-16">
      <section className="page-wrap pt-4 sm:pt-6"><StorefrontHero banners={banners} /></section>

      <section className="page-wrap mt-5">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#14805d]">Browse simply</p><h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Shop by category</h2></div><Link href="/search" className="text-xs font-bold text-[#d99032]">See all →</Link></div>
        {displayCategories.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">{displayCategories.map(category => <Link key={category.slug + category.name} href={`/search?category=${category.slug}`} className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center shadow-sm ${category.tone ?? 'bg-white'} transition hover:-translate-y-0.5 hover:shadow-md`}><span className="text-2xl grayscale">{category.icon}</span><span className="text-[11px] font-bold leading-tight text-slate-700">{category.name}</span></Link>)}</div>}
      </section>

      <section className="page-wrap mt-6"><div className="rounded-2xl border bg-white px-5 py-5 shadow-sm sm:px-8 sm:py-6" style={{ borderColor: 'var(--line)' }}><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#14805d]">Simple and protected</p><h2 className="mt-2 text-2xl font-black tracking-tight text-[#14251e] sm:text-3xl">Your payment is protected until your order is delivered.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Find something you like, pay securely, receive your order, and confirm delivery. That is all Jojokev needs to do.</p></div><div className="flex shrink-0 flex-wrap gap-3"><Link href="/search" className="inline-flex rounded-xl bg-[#f6b640] px-5 py-3 text-sm font-black text-[#14251e] hover:bg-[#ffd071]">Start shopping</Link><Link href="/sell/register" className="inline-flex rounded-xl bg-[#14251e] px-5 py-3 text-sm font-black text-[#d9f33f] hover:bg-[#0b5d43]">Start selling</Link></div></div></div></section>

      <section className="page-wrap mt-8"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#14805d]">Approved local sellers</p><h2 className="mt-1 text-2xl font-black tracking-tight">Latest products</h2></div><Link href="/search" className="text-xs font-bold text-[#d99032]">See all →</Link></div>{products.length === 0 ? <div className="rounded-2xl bg-white p-12 text-center shadow-sm"><div className="text-5xl">🛒</div><h3 className="mt-4 text-lg font-black">No products here yet</h3><p className="mt-2 text-sm text-slate-500">Check out other categories or come back soon.</p></div> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">{products.map(product => <ProductCard key={product.id} product={product} />)}</div>}</section>

      <section className="page-wrap mt-10"><div className="rounded-2xl bg-[#14251e] px-5 py-7 text-white sm:px-8"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#d9f33f]">How Jojokev works</p><div className="mt-5 grid gap-5 sm:grid-cols-4">{[['1', 'Find what you want.'], ['2', 'Place your order.'], ['3', 'Pay securely.'], ['4', 'Receive and confirm delivery.']].map(([number, text]) => <div key={number} className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d9f33f] text-sm font-black text-[#14251e]">{number}</span><p className="pt-1 text-sm font-semibold text-white/90">{text}</p></div>)}</div></div></section>
    </div>
  )
}
