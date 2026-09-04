import { supabaseServer } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SellerPendingPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller')

  const { data: seller } = await supabase
    .from('seller_profiles').select('status, rejection_reason, business_name').eq('user_id', user.id).single()

  if (!seller) redirect('/sell')
  if (seller.status === 'approved') redirect('/seller')

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">⏳</div>
      <h1 className="text-2xl font-semibold mb-2">
        {seller.status === 'rejected' ? 'Application not approved' : 'Application under review'}
      </h1>
      {seller.status === 'rejected' ? (
        <p className="text-neutral-600">
          Unfortunately your seller application for <strong>{seller.business_name}</strong> was not approved.
          {seller.rejection_reason && (
            <> Reason: <em>{seller.rejection_reason}</em></>
          )}
        </p>
      ) : (
        <p className="text-neutral-600">
          Thanks for applying to sell on Jojokev, <strong>{seller.business_name}</strong>.
          We review new sellers within 24 hours. You will be able to list products
          as soon as your application is approved.
        </p>
      )}
    </div>
  )
}
