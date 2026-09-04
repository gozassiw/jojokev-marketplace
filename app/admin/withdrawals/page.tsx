import { supabaseAdmin } from '@/lib/supabase/clients'
import AdminWithdrawals from '@/components/AdminWithdrawals'

export const dynamic = 'force-dynamic'

export default async function AdminWithdrawalsPage() {
  const db = supabaseAdmin()
  const { data: withdrawals } = await db
    .from('withdrawals')
    .select('*, seller_profiles(business_name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Withdrawals</h1>
      <AdminWithdrawals withdrawals={withdrawals ?? []} />
    </div>
  )
}
