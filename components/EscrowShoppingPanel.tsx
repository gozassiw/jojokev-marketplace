import Link from 'next/link'

export default function EscrowShoppingPanel() {
  return <section className="rounded-sm border bg-white px-5 py-5 shadow-sm sm:px-8 sm:py-6" style={{ borderColor: 'var(--line)' }}>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#14805d]">Shop with confidence</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#14251e] sm:text-3xl">Your payment stays protected.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Jojokev holds your payment in escrow while your order is on the way. Funds are released to the seller only after you confirm that your delivery has arrived.</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <Link href="/register" className="inline-flex rounded-sm bg-[#f6b640] px-5 py-3 text-sm font-black text-[#14251e] hover:bg-[#ffd071]">Start shopping</Link>
        <Link href="/sell/register" className="inline-flex rounded-sm bg-[#14251e] px-5 py-3 text-sm font-black text-[#d9f33f] hover:bg-[#0b5d43]">Start selling on Jojokev</Link>
      </div>
    </div>
  </section>
}
