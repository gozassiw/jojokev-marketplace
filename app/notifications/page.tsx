import { redirect } from 'next/navigation'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import NotificationReadButton from '@/components/NotificationReadButton'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/notifications')
  const db = supabaseAdmin()
  const { data: notifications } = await db.from('notifications').select('id, order_id, type, title, body, metadata, read_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  return <main className="min-h-[calc(100vh-160px)] bg-[#f7f8f6] py-8 sm:py-12"><div className="page-wrap max-w-3xl"><div className="rounded-3xl bg-[#14251e] p-6 text-white sm:p-9"><p className="eyebrow bg-white/10 text-[#d9f33f]">Jojokev notifications</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em]">Updates for your orders</h1><p className="mt-2 text-sm text-white/65">Delivery updates and receipt codes appear here.</p></div><div className="surface mt-5 p-4 sm:p-6"><div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">Safety notice: never share a delivery code before your package is physically with you. Jojokev staff will never ask for your code by phone or chat.</div></div><div className="mt-5 space-y-3">{!notifications?.length ? <div className="surface p-10 text-center text-slate-500">You have no notifications yet.</div> : notifications.map((n: any) => <article key={n.id} className={`surface p-5 ${n.read_at ? 'opacity-70' : 'border-[#14805d] shadow-md'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#14805d]">{n.type.replaceAll('_', ' ')}</p><h2 className="mt-2 text-lg font-black">{n.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{n.body}</p>{n.order_id && <p className="mt-3 text-xs font-semibold text-slate-400">Linked order available in My Orders</p>}</div>{!n.read_at && <NotificationReadButton notificationId={n.id} />}</div><p className="mt-4 text-xs text-slate-400">{new Date(n.created_at).toLocaleString('en-NG')}</p></article>)}</div></div></main>
}
