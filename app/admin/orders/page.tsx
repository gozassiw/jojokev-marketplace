import { supabaseAdmin } from '@/lib/supabase/clients'
import AdminOrders from '@/components/AdminOrders'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const db = supabaseAdmin()

  let query = db
    .from('orders')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (searchParams.status) query = query.eq('status', searchParams.status)

  const { data: orders } = await query

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">All orders</h1>
      <AdminOrders orders={orders ?? []} currentStatus={searchParams.status ?? ''} />
    </div>
  )
}
