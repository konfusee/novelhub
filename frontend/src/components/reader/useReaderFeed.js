import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../../api/client'

/*
 * GET `path` for reader pages that change their own data. Unlike useBackendDocument, `reload()`
 * keeps the current data on screen while the refreshed response loads (after a follow, delete,
 * …); `retry()` is for the error state and shows loading again.
 */
export function useReaderFeed(path) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ path: null, status: 'loading', data: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    apiRequest(path, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setState({ path, status: 'ready', data, error: null })
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ path, status: 'error', data: null, error })
      })
    return () => controller.abort()
  }, [path, attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  const retry = useCallback(() => {
    setState(previous => ({ ...previous, status: 'loading' }))
    setAttempt(value => value + 1)
  }, [])
  const current = state.path === path ? state : { path, status: 'loading', data: null, error: null }
  return { ...current, reload, retry }
}
