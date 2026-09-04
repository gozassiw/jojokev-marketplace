import { supabaseServer } from '@/lib/supabase/clients'
import { redirect } from 'next/navigation'
import AddressBook from '@/components/AddressBook'

export const dynamic = 'force-dynamic'

export default async function AddressesPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/addresses')

  const { data: addresses } = await supabase
    .from('addresses').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">My addresses</h1>
      <AddressBook addresses={addresses ?? []} />
    </div>
  )
}
