import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ROUTES } from '../../app/routes'

/** Sends a Guest to sign in, returning to the current page afterwards (JoinPage reads `state.from`). */
export function useLoginRedirect() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return useCallback(
    () => navigate(ROUTES.login, { state: { from: pathname + search } }),
    [navigate, pathname, search],
  )
}

export function useReturnPath() {
  const { pathname, search } = useLocation()
  return pathname + search
}
