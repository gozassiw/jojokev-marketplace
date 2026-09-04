import { supabaseServer } from '@/lib/supabase/clients'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SearchParams = {
  q?: string
  category?: string
  min?: string
  max?: string
  sort?: string
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q || '').trim()
  const categorySlug = searchParams.category || ''
  const minNaira = Number(searchParams.min || 0)
  const maxNaira = Number(searchParams.max || 0)
  const sort = searchParams.sort || 'newest'

  let products: any[] = []
  let categories: any[] = []

  try {
    const supabase = await supabaseServer()

    const { data: cats } = await supabase.from('categories').select('*').order('sort_order')
    categories = cats ?? []

    let query = supabase
      .from('products')
      .select('id, title, slug, price_kobo, images, stock, category_id, seller_profiles(business_name)')
      .eq('status', 'active')

    if (q) {
      // full-text search against title + description
      query = query.textSearch('title', q.split(/\s+/).join(' & '), { type: 'websearch' })
    }
    if (categorySlug) {
      const cat = categories.find((c: any) => c.slug === categorySlug)
      if (cat) query = query.eq('category_id', cat.id)
    }
    if (minNaira > 0) query = query.gte('price_kobo', minNaira * 100)
    if (maxNaira > 0) query = query.lte('price_kobo', maxNaira * 100)

    if (sort === 'price_asc') query = query.order('price_kobo', { ascending: true })
    else if (sort === 'price_desc') query = query.order('price_kobo', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    const { data } = await query.limit(60)
    products = data ?? []
  } catch {
    // Supabase not configured yet
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">
        {q ? `Results for "${q}"` : 'Browse products'}
      </h1>

      {/* Filters */}
      <form action="/search" className="flex flex-wrap gap-3 items-end mb-6 rounded-xl border bg-white p-4">
        <input type="hidden" name="q" value={q} />
        <div>
          <label className="block text-xs font-medium mb-1">Category</label>
          <select name="category" defaultValue={categorySlug} className="rounded-md border px-2 py-1.5 text-sm">
            <option value="">All</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Min ₦</label>
          <input name="min" type="number" min="0" defaultValue={searchParams.min}
                 className="w-24 rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Max ₦</label>
          <input name="max" type="number" min="0" defaultValue={searchParams.max}
                 className="w-24 rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Sort</label>
          <select name="sort" defaultValue={sort} className="rounded-md border px-2 py-1.5 text-sm">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <button type="submit" className="bg-emerald-600 text-white rounded-md px-4 py-1.5 text-sm font-medium">
          Apply
        </button>
      </form>

      {products.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">
          No products found. <Link href="/" className="text-emerald-700 underline">Back to homepage</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
