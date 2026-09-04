import Link from 'next/link'
import { formatNaira } from '@/lib/money'

export default function ProductCard({ product }: { product: any }) {
  const image = product.images?.[0]
  const sellerName = product.seller_profiles?.business_name
  const lowStock = product.stock > 0 && product.stock <= 3

  return (
    <Link href={`/product/${product.slug}`} className="market-card group flex min-w-0 flex-col">
      <div className="relative aspect-square overflow-hidden bg-[#eef2ef]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#e5f6ee] to-[#eef2ef] text-5xl">🛍️</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-800">{product.title}</h3>
        <div className="mt-auto pt-2"><p className="text-lg font-black tracking-tight text-[#0b5d43]">{formatNaira(product.price_kobo)}</p><p className="text-[10px] font-semibold text-slate-400">Payment protected until delivery</p></div>
        <p className="truncate text-[11px] font-semibold text-slate-500">{sellerName || 'Trusted seller'}</p>
        {lowStock && <p className="text-[10px] font-bold text-[#ff7a28]">Only {product.stock} left</p>}
        {product.stock === 0 && <p className="text-[10px] font-bold text-red-600">Out of stock</p>}
      </div>
    </Link>
  )
}
