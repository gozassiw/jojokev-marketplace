import { supabaseServer } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import WalletView from '@/components/WalletView'

export const dynamic = 'force-dynamic'

export default async function SellerWalletPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/wallet')

  const { data: seller } = await supabase
    .from('seller_profiles').select('id, status, bank_name, account_number, account_name')
    .eq('user_id', user.id).single()
  if (!seller || seller.status !== 'approved') redirect('/seller/pending')

  const [{ data: wallet }, { data: transactions }, { data: withdrawals }] = await Promise.all([
    supabase.from('wallets').select('*').eq('seller_id', seller.id).single(),
    supabase.from('wallet_transactions').select('*')
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('withdrawals').select('*').eq('seller_id', seller.id)
      .order('created_at', { ascending: false }).limit(20),
  ])

  const pendingPayouts = (withdrawals ?? [])
    .filter(w => ['requested', 'processing'].includes(w.status))
    .reduce((s, w) => s + Number(w.net_payout_kobo), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">My wallet</h1>
      <WalletView
        wallet={wallet}
        transactions={transactions ?? []}
        withdrawals={withdrawals ?? []}
        pendingPayoutsKobo={pendingPayouts}
        bankAccount={seller.account_number ? {
          bank_name: seller.bank_name,
          account_number: seller.account_number,
          account_name: seller.account_name,
        } : null}
      />
    </div>
  )
}
