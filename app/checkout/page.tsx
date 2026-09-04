import { supabaseServer } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import CheckoutFlow from '@/components/CheckoutFlow'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/checkout')

  const { data: addresses } = await supabase
    .from('addresses').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Checkout</h1>
      <CheckoutFlow addresses={addresses ?? []} />
    </div>
  )
}
