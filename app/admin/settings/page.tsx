import { supabaseAdmin } from '@/lib/supabase/clients'
import SettingsForm from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const db = supabaseAdmin()
  const { data: settings } = await db.from('platform_settings').select('*').eq('id', 1).single()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Platform settings</h1>
      <SettingsForm settings={settings} />
    </div>
  )
}
