'use client'

import { useEffect, useState } from 'react'

type Banner = { id: string; title: string; subtitle: string | null; cta_label: string | null; cta_url: string | null; image_url: string; sort_order: number }

const fallback: Banner = { id: 'fallback', title: '', subtitle: null, cta_label: null, cta_url: null, image_url: '', sort_order: 0 }

export default function StorefrontHero({ banners }: { banners: Banner[] }) {
  const slides = banners.length ? banners : [fallback]
  const [active, setActive] = useState(0)
  useEffect(() => { if (slides.length < 2) return; const timer = window.setInterval(() => setActive(current => (current + 1) % slides.length), 10000); return () => window.clearInterval(timer) }, [slides.length])
  const slide = slides[active % slides.length]

  return <div className="relative aspect-[1197/371] w-full overflow-hidden rounded-sm bg-[#1d6a50] shadow-sm">
    {slide.image_url ? <img src={slide.image_url} alt={slide.title || 'Jojokev storefront banner'} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-r from-[#14251e] to-[#1d6a50]"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#d9f33f]/20 blur-3xl" /><div className="absolute bottom-0 right-8 text-[80px] opacity-80 sm:text-[120px]">🛍️</div></div>}
    {slides.length > 1 && <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/25 px-3 py-2 backdrop-blur-sm">{slides.map((item, index) => <button key={item.id} type="button" aria-label={`Show slide ${index + 1}`} onClick={() => setActive(index)} className={`h-2 rounded-full transition-all ${index === active ? 'w-8 bg-[#d9f33f]' : 'w-2 bg-white/70'}`} />)}</div>}
  </div>
}
