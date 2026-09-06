import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import RiderWalletView from '@/components/RiderWalletView'

export const dynamic = 'force-dynamic'

export default async function RiderWalletPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/rider/wallet')
  const db = supabaseAdmin()
  const { data: rider } = await db.from('rider_profiles').select('id, status, bank_name, account_number, account_name').eq('user_id', user.id).single()
  if (!rider || rider.status !== 'approved') redirect('/rider')
  const { data: wallet } = await db.from('rider_wallets').select('id, held_balance_kobo, available_balance_kobo, lifetime_earned_kobo').eq('rider_id', rider.id).maybeSingle()
  const [{ data: transactions }, { data: withdrawals }] = await Promise.all([
    wallet ? db.from('rider_wallet_transactions').select('type, amount_kobo, description, created_at').eq('wallet_id', wallet.id).order('created_at', { ascending: false }).limit(25) : Promise.resolve({ data: [] }),
    db.from('rider_withdrawals').select('amount_kobo, net_payout_kobo, status, created_at').eq('rider_id', rider.id).order('created_at', { ascending: false }).limit(20),
  ])
  return <main className="min-h-[calc(100vh-160px)] bg-[#f7f8f6] py-8 sm:py-12"><div className="page-wrap max-w-5xl"><div className="rounded-3xl bg-[#14251e] p-6 text-white sm:p-9"><p className="eyebrow bg-white/10 text-[#d9f33f]">Rider wallet</p><h1 className="mt-4 text-3xl font-black">Your delivery earnings</h1><p className="mt-2 text-sm text-white/65">Accepted quotes are held until the buyer delivery code is verified.</p></div><RiderWalletView wallet={wallet} rider={rider} transactions={transactions || []} withdrawals={withdrawals || []} /></div></main>
}
