/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)
const SESSION_KEY = 'novelhub.session.v1'
const USERS_KEY = 'novelhub.users.v1'
export const MOCK_PASSWORD = '123456'
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

export const mockAccounts = {
  reader: {
    id: 'user-reader',
    name: 'Elena Park',
    email: 'reader@novelhub.test',
    roles: ['reader'],
  },
  author: {
    id: 'user-author',
    name: 'Mira Lane',
    email: 'author@novelhub.test',
    roles: ['reader', 'author'],
    authorProfile: { status: 'active', agreementAccepted: true },
  },
  moderator: {
    id: 'user-moderator',
    name: 'Sarah Jenkins',
    email: 'moderator@novelhub.test',
    roles: ['reader', 'moderator'],
  },
  admin: {
    id: 'user-admin',
    name: 'Marcus Vance',
    email: 'admin@novelhub.test',
    roles: ['reader', 'admin'],
  },
}
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const session = read(SESSION_KEY, null)
    const updatedDemo = session && Object.values(mockAccounts).find(user => user.id === session.id)
    return updatedDemo || session
  })
  const persist = user => {
    setCurrentUser(user)
    user
      ? localStorage.setItem(SESSION_KEY, JSON.stringify(user))
      : localStorage.removeItem(SESSION_KEY)
  }
  const login = (email, password) => {
    const custom = read(USERS_KEY, [])
    const user = [...Object.values(mockAccounts), ...custom].find(
      item => item.email.toLowerCase() === email.toLowerCase(),
    )
    if (!user || password !== MOCK_PASSWORD)
      throw new Error('Invalid email or password. Use a demo account and password 123456.')
    persist(user)
    return user
  }
  const register = ({ name, email, accountType = 'reader' }) => {
    const user = {
      id: `user-${Date.now()}`,
      name,
      email,
      roles: accountType === 'author' ? ['reader', 'author'] : ['reader'],
    }
    if (accountType === 'author') user.authorProfile = { status: 'active', agreementAccepted: true }
    const users = read(USERS_KEY, [])
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]))
    persist(user)
    return user
  }
  const becomeAuthor = () => {
    if (!currentUser) return
    persist({
      ...currentUser,
      roles: [...new Set([...currentUser.roles, 'author'])],
      authorProfile: { status: 'active', agreementAccepted: true },
    })
  }
  const value = {
    currentUser,
    isAuthenticated: Boolean(currentUser),
    roles: currentUser?.roles || [],
    hasRole: role => currentUser?.roles?.includes(role),
    login,
    logout: () => persist(null),
    register,
    becomeAuthor,
    switchAccount: role => {
      const user = role === 'guest' ? null : mockAccounts[role]
      persist(user)
      return user
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
