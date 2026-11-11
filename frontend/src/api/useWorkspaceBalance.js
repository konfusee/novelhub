import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { workspaceWallets } from '../navigation/workspaceNavigation'
import { apiRequest } from './client'
import { WALLET_BALANCE_CHANGED } from './walletEvents'

/** Account-scoped, workspace-specific balance. Never carry another account's balance forward. */
export function useWorkspaceBalance(workspace) {
  const { currentUser } = useAuth()
  const { pathname } = useLocation()
  const path = workspaceWallets[workspace]?.apiPath
  const accountId = currentUser?.id
  const key = accountId && path ? `${accountId}:${path}` : null
  const [state, setState] = useState({ key: null, status: 'loading', balance: null })

  useEffect(() => {
    if (!key) return undefined
    let controller
    let stopped = false
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      apiRequest(path, { signal })
        .then(response => {
          if (stopped || signal.aborted) return
          if (!Number.isSafeInteger(response?.balance) || response.balance < 0)
            throw new Error('Invalid wallet balance')
          setState({ key, status: 'ready', balance: response.balance })
        })
        .catch(error => {
          if (!stopped && !signal.aborted && error.name !== 'AbortError')
            setState({ key, status: 'error', balance: null })
        })
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener(WALLET_BALANCE_CHANGED, refresh)
    document.addEventListener('visibilitychange', refreshVisible)
    const timer = window.setInterval(refreshVisible, 30000)
    return () => {
      stopped = true
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(WALLET_BALANCE_CHANGED, refresh)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [key, path, pathname])

  return key && state.key === key ? state : { status: 'loading', balance: null }
}
