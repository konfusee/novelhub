import { createContext, useCallback, useContext, useEffect, useState } from 'react'
const Context = createContext(null)
const KEY = 'novelhub.mock-data.v1'
/* Simulated network latency (ms) for mock resources; DevPanel can change it. */
// eslint-disable-next-line react-refresh/only-export-components
export const MOCK_LATENCIES = [0, 450, 1200, 2500]
const initial = {
  agreements: {
    'user-author': {
      authorShare: 80,
      platformShare: 20,
      status: 'active',
      effectiveFrom: '2026-09-29',
      updatedBy: 'System Admin',
    },
  },
  simulation: 'normal',
  latency: 450,
}
const load = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY))
    return stored ? { ...initial, ...stored } : initial
  } catch {
    return initial
  }
}
export function MockDataProvider({ children }) {
  const [data, setData] = useState(load)
  // Number of mock resources currently "fetching"; drives the global top progress bar.
  const [pending, setPending] = useState(0)
  const update = next => {
    setData(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }
  const saveAgreement = (id, authorShare) => {
    const value = Number(authorShare)
    if (!Number.isFinite(value) || value < 0 || value > 100)
      throw new Error('Tỷ lệ của tác giả phải nằm trong khoảng từ 0 đến 100.')
    update({
      ...data,
      agreements: {
        ...data.agreements,
        [id]: {
          authorShare: value,
          platformShare: 100 - value,
          status: 'active',
          effectiveFrom: new Date().toISOString().slice(0, 10),
          updatedBy: 'Marcus Vance',
        },
      },
    })
  }
  const saveCommunityPost = (storyId, post) => {
    const current = data.community?.[storyId] || []
    const posts =
      post.kind === 'review'
        ? current.filter(item => item.kind !== 'review' || item.accountId !== post.accountId)
        : current
    const next = { ...data, community: { ...data.community, [storyId]: [post, ...posts] } }
    localStorage.setItem(KEY, JSON.stringify(next))
    setData(next)
  }
  const beginRequest = useCallback(() => {
    setPending(count => count + 1)
    return () => setPending(count => Math.max(0, count - 1))
  }, [])
  const value = {
    data,
    pending,
    beginRequest,
    saveAgreement,
    saveCommunityPost,
    setSimulation: simulation => update({ ...data, simulation }),
    setLatency: latency => update({ ...data, latency: Number(latency) }),
    reset: () => update(initial),
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useMockData = () => useContext(Context)

/* Resources already "fetched" this session load instantly on revisit, like a cached API. */
const resolved = new Set()

/**
 * Mock data access with real loading semantics: returns `{ status, data, retry }` where status is
 * 'loading' | 'ready' | 'empty' | 'error'. The first read of `key` in a session waits for the
 * configured latency; DevPanel's simulation state forces loading/empty/error for every resource.
 * Replace the body with an API call when the backend contract exists; callers keep their states.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useMockResource(key, value, { isEmpty } = {}) {
  const { data, beginRequest } = useMockData()
  const simulation = data?.simulation ?? 'normal'
  const latency = data?.latency ?? 0
  const [attempt, setAttempt] = useState(0)
  const [loadedKey, setLoadedKey] = useState(null)
  const instant = latency === 0 || resolved.has(key)
  const loading = !instant && loadedKey !== key

  useEffect(() => {
    if (latency === 0 || resolved.has(key)) return undefined
    const end = beginRequest()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      end()
    }
    const timer = setTimeout(() => {
      resolved.add(key)
      setLoadedKey(key)
      finish()
    }, latency)
    return () => {
      clearTimeout(timer)
      finish()
    }
  }, [key, latency, attempt, beginRequest])

  const retry = useCallback(() => {
    resolved.delete(key)
    setLoadedKey(null)
    setAttempt(count => count + 1)
  }, [key])

  let status
  if (simulation === 'loading' || loading) status = 'loading'
  else if (simulation === 'error') status = 'error'
  else if (simulation === 'empty') status = 'empty'
  else {
    const empty = isEmpty ? isEmpty(value) : Array.isArray(value) && value.length === 0
    status = empty ? 'empty' : 'ready'
  }
  const emptyValue = Array.isArray(value) ? [] : value
  return { status, data: status === 'empty' ? emptyValue : value, retry }
}
