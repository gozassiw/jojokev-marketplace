import { supabaseAdmin } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'
import { notFound } from 'next/navigation'
import AddToCartButton from '@/components/AddToCartButton'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: { slug: string } }) {
  let product: any = null

  try {
    const supabase = supabaseAdmin()
    const { data } = await supabase
      .from('products')
      .select('*, seller_profiles(business_name, status), categories(name)')
      .eq('slug', params.slug)
      .single()
    product = data
  } catch {
    // not configured
  }

  if (!product || product.status !== 'active' || product.seller_profiles?.status !== 'approved') {
    notFound()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="aspect-square bg-neutral-100 flex items-center justify-center">
            {product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-7xl text-neutral-300">🛍️</span>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {product.images.slice(1).map((img: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt="" className="w-16 h-16 rounded-md object-cover border" />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-2xl font-semibold mb-2">{product.title}</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Sold by <span className="font-medium text-neutral-700">{product.seller_profiles?.business_name}</span>
            {product.categories?.name && <> · {product.categories.name}</>}
          </p>

          <p className="text-3xl font-bold text-emerald-700 mb-4">{formatNaira(product.price_kobo)}</p>

          <p className="text-sm mb-6">
            {product.stock > 0 ? (
              <span className="text-emerald-700 font-medium">In stock ({product.stock} available)</span>
            ) : (
              <span className="text-red-600 font-medium">Out of stock</span>
            )}
          </p>

          <AddToCartButton productId={product.id} disabled={product.stock === 0} />

          <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
            <strong>Escrow protected.</strong> Your payment is held securely and only
            released to the seller after you confirm you have received your order.
          </div>

          {product.description && (
            <div className="mt-8">
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-neutral-700 whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
