const STYLES: Record<string, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
  refunded: 'bg-red-100 text-red-800',
}

const LABELS: Record<string, string> = {
  awaiting_payment: 'Payment pending',
  paid: 'Paid · Escrow protected',
  shipped: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export default function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? 'bg-neutral-100 text-neutral-700'}`}>
      {LABELS[status] ?? status}
    </span>
  )
}
