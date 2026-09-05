'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationRead } from '@/app/actions/dispatch'

export default function NotificationReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => { await markNotificationRead(notificationId); router.refresh() })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">{pending ? '…' : 'Mark read'}</button>
}
