'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function BellIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg> }

export default function NotificationBell({ initialCount = 0 }: { initialCount?: number }) {
  const [count, setCount] = useState(initialCount)
  useEffect(() => {
    let active = true
    const refresh = async () => { try { const response = await fetch('/api/notifications/unread', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); if (active) setCount(Number(data.count || 0)) } catch {} }
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  return <Link href="/notifications" aria-label={count ? `${count} unread notifications` : 'Notifications'} className="relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-[#e5f6ee] hover:text-[#0b5d43] sm:px-3"><BellIcon /><span className="hidden sm:inline">Notifications</span>{count > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#e85d4a] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">{count > 99 ? '99+' : count}</span>}</Link>
}
