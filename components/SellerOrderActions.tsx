'use client'

export default function SellerOrderActions({ status }: { orderId: string; status: string }) {
  if (status === 'paid') return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Pack this order for pickup. Jojokev staff will assign an approved rider and update the delivery status.</div>
  if (status === 'shipped') return <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">An assigned Jojokev rider is out for delivery. The buyer will receive a code when the rider arrives.</div>
  if (status === 'delivered') return <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">The rider verified the buyer’s code. Waiting for the buyer to confirm receipt before escrow is released.</div>
  if (status === 'completed') return <p className="text-sm font-semibold text-emerald-700">Buyer confirmed delivery. Funds have been released to your available wallet balance.</p>
  return null
}
