import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from './client'

export const NOTIFICATIONS_CHANGED = 'novelhub:notifications-changed'

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}

/** Account-scoped unread notification count for the header bell; null until known. */
export function useUnreadNotifications() {
  const { currentUser } = useAuth()
  const accountId = currentUser?.id ?? null
  const [state, setState] = useState({ accountId: null, count: null })

  useEffect(() => {
    if (!accountId) return undefined
    let controller
    let stopped = false
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      apiRequest('/reader/notifications/unread-count', { signal })
        .then(response => {
          if (stopped || signal.aborted) return
          if (!Number.isSafeInteger(response?.count) || response.count < 0)
            throw new Error('Invalid unread count')
          setState({ accountId, count: response.count })
        })
        .catch(() => {})
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    document.addEventListener('visibilitychange', refreshVisible)
    const timer = window.setInterval(refreshVisible, 30000)
    return () => {
      stopped = true
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [accountId])

  return state.accountId === accountId ? state.count : null
}
