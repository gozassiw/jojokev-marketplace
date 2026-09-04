import { supabaseAdmin } from '@/lib/supabase/clients'
import { formatNaira } from '@/lib/money'

export const dynamic = 'force-dynamic'

const SOURCE_LABELS: Record<string, string> = {
  commission: 'Commission',
  withdrawal_fee: 'Withdrawal fee',
  adjustment: 'Delivery fee / adjustment',
  sale_hold: 'Sale hold',
  hold_release: 'Hold release',
  withdrawal: 'Withdrawal',
  refund_reversal: 'Refund reversal',
}

export default async function AdminRevenuePage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const db = supabaseAdmin()

  let query = db
    .from('platform_revenue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (searchParams.from) query = query.gte('created_at', new Date(searchParams.from).toISOString())
  if (searchParams.to) {
    const to = new Date(searchParams.to)
    to.setDate(to.getDate() + 1)
    query = query.lt('created_at', to.toISOString())
  }

  const { data: rows } = await query
  const total = (rows ?? []).reduce((s, r) => s + Number(r.amount_kobo), 0)

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Platform revenue</h1>

      <form action="/admin/revenue" className="flex flex-wrap items-end gap-3 mb-6 rounded-xl border bg-white p-4">
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input type="date" name="from" defaultValue={searchParams.from}
                 className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input type="date" name="to" defaultValue={searchParams.to}
                 className="rounded-md border px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="bg-emerald-600 text-white rounded-md px-4 py-1.5 text-sm font-medium">
          Filter
        </button>
        <div className="ml-auto text-sm">
          <span className="text-neutral-500">Total in view:</span>{' '}
          <span className="font-bold">{formatNaira(total)}</span>
        </div>
      </form>

      {!rows?.length ? (
        <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">No revenue recorded yet.</div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className="px-4 py-3 text-neutral-600">{r.note}</td>
                  <td className={`px-4 py-3 font-medium ${r.amount_kobo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatNaira(r.amount_kobo)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleString('en-NG')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
