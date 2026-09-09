'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RiderWorkspaceAutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const interval = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [router])

  return null
}
