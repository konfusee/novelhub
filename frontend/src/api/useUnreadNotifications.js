import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from './client'
import { NOTIFICATIONS_CHANGED } from './notificationEvents'
import { WALLET_BALANCE_CHANGED } from './walletEvents'

export function useUnreadNotifications() {
  const { currentUser } = useAuth()
  const { pathname } = useLocation()
  const accountId = currentUser?.id
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
        .catch(() => {
          if (!stopped && !signal.aborted) setState({ accountId, count: null })
        })
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh)
    window.addEventListener(WALLET_BALANCE_CHANGED, refresh)
    document.addEventListener('visibilitychange', refreshVisible)
    const timer = window.setInterval(refreshVisible, 30000)
    return () => {
      stopped = true
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh)
      window.removeEventListener(WALLET_BALANCE_CHANGED, refresh)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [accountId, pathname])

  return state.accountId === accountId ? state.count : null
}
