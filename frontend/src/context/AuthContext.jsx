/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { API_BASE, ApiError, apiRequest } from '../api/client'

const AuthContext = createContext(null)
const loadCurrentUser = signal => apiRequest('/auth/me', { signal })
export const ROLE_HOME = {
  guest: '/',
  reader: '/reader',
  author: '/author',
  moderator: '/moderator',
  admin: '/admin',
}

export const getAccountHome = user => {
  if (!user) return ROLE_HOME.guest
  const primaryRole = ['admin', 'moderator', 'author', 'reader'].find(role =>
    user.roles?.includes(role),
  )
  return ROLE_HOME[primaryRole] || ROLE_HOME.guest
}

export const canAccessPath = (user, path = '/') => {
  if (!user) return !/^\/(reader|read|listen|author|moderator|admin)(\/|$)/.test(path)
  if (/^\/(reader|read|listen|library)(\/|$)/.test(path)) return user.roles?.includes('reader')
  if (path.startsWith('/author/apply')) return user.roles?.includes('reader')
  if (path.startsWith('/author')) return user.roles?.includes('author')
  if (path.startsWith('/moderator')) return user.roles?.includes('moderator')
  if (path.startsWith('/admin')) return user.roles?.includes('admin')
  return true
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const refreshUser = async signal => {
    const result = await loadCurrentUser(signal)
    setCurrentUser(result.user)
    return result.user
  }
  useEffect(() => {
    const controller = new AbortController()
    loadCurrentUser(controller.signal)
      .then(({ user }) => {
        if (!controller.signal.aborted) setCurrentUser(user)
      })
      .catch(() => {
        if (!controller.signal.aborted) setCurrentUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false)
      })
    return () => controller.abort()
  }, [])
  const login = async (email, password, rememberMe = false) => {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password, rememberMe },
    })
    if (result.requiresTwoFactor) return result
    setCurrentUser(result.user)
    return result.user
  }
  const register = ({
    name,
    email,
    password,
    passwordConfirmation,
    captchaToken,
    captchaAnswer,
    accountType = 'reader',
  }) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: {
        displayName: name,
        email,
        password,
        passwordConfirmation,
        captchaToken,
        captchaAnswer,
        acceptedTerms: true,
        accountType,
      },
    })
  const applyForAuthor = async () =>
    apiRequest('/auth/author-application', { method: 'POST', body: {} })
  const loginWithGoogle = async ({ returnTo, mode = 'login' } = {}) => {
    const { enabled } = await apiRequest('/auth/google/status')
    if (!enabled)
      throw new ApiError('Google sign-in is unavailable', { code: 'google_unavailable' })
    if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      sessionStorage.setItem('novelhub.google.returnTo', returnTo)
    } else {
      sessionStorage.removeItem('novelhub.google.returnTo')
    }
    window.location.assign(
      API_BASE + '/auth/google/start' + (mode === 'register' ? '?mode=register' : ''),
    )
  }
  const value = {
    currentUser,
    authLoading,
    isAuthenticated: Boolean(currentUser),
    roles: currentUser?.roles || [],
    hasRole: role => currentUser?.roles?.includes(role),
    login,
    loginWithGoogle,
    refreshUser,
    verifyTwoFactor: async (challenge, otp) => {
      const { user } = await apiRequest('/auth/two-factor/verify', {
        method: 'POST',
        body: { challenge, otp },
      })
      setCurrentUser(user)
      return user
    },
    updateSecurity: async (action, body) => {
      const { user } = await apiRequest('/auth/security/' + action, { method: 'POST', body })
      setCurrentUser(user)
      return user
    },
    logout: async () => {
      try {
        await apiRequest('/auth/logout', { method: 'POST' })
      } catch {
        // Local state must still be cleared when the server is unreachable.
      } finally {
        setCurrentUser(null)
      }
    },
    register,
    applyForAuthor,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
