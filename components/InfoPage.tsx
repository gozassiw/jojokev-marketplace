import Link from 'next/link'

export default function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4f4f4] py-8 sm:py-12"><article className="page-wrap max-w-3xl"><Link href="/" className="text-sm font-bold text-emerald-700">← Back to Jojokev</Link><div className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-10"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-700">{eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h1><p className="mt-4 text-base leading-7 text-slate-600">{intro}</p><div className="prose prose-slate mt-8 max-w-none text-sm leading-7">{children}</div></div></article></div>
}
