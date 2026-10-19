import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'

const user = {
  id: 'account-1',
  name: 'Test Reader',
  email: 'reader@example.test',
  roles: ['reader'],
}

function Harness() {
  const { authLoading, currentUser, login, loginWithGoogle, logout, register, verifyTwoFactor } =
    useAuth()
  const [registration, setRegistration] = useState('')
  return (
    <div>
      <span>{authLoading ? 'loading' : currentUser?.email || 'guest'}</span>
      <button type="button" onClick={() => login(user.email, 'secret-password')}>
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
      <button
        type="button"
        onClick={() =>
          register({
            name: 'New Reader',
            email: 'new@example.test',
            password: 'secure-password',
            accountType: 'reader',
          }).then(({ account }) => setRegistration(account.status))
        }
      >
        register
      </button>
      <button
        type="button"
        onClick={() => loginWithGoogle().catch(error => setRegistration(error.code))}
      >
        google
      </button>
      <button type="button" onClick={() => verifyTwoFactor('a'.repeat(43), '123456')}>
        verify
      </button>
      <span>{registration}</span>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AuthProvider', () => {
  it('does not authenticate until the login OTP is verified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => {
        if (url.endsWith('/auth/login'))
          return new Response(
            JSON.stringify({ requiresTwoFactor: true, challenge: 'a'.repeat(43) }),
            { status: 200 },
          )
        if (url.endsWith('/two-factor/verify'))
          return new Response(JSON.stringify({ user }), { status: 200 })
        return new Response(JSON.stringify({ user: null }), { status: 200 })
      }),
    )
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )
    await screen.findByText('guest')
    fireEvent.click(screen.getByText('login'))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.anything()))
    expect(screen.getByText('guest')).toBeTruthy()
    fireEvent.click(screen.getByText('verify'))
    expect(await screen.findByText(user.email)).toBeTruthy()
  })
  it('keeps the user in the app when Google is not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async url =>
          new Response(
            JSON.stringify(url.endsWith('/google/status') ? { enabled: false } : { user: null }),
            { status: 200 },
          ),
      ),
    )
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )
    await screen.findByText('guest')
    fireEvent.click(screen.getByText('google'))
    expect(await screen.findByText('google_unavailable')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/google/status',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
  it('waits for session restoration when StrictMode cancels the first request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }) =>
          new Promise((resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            )
            setTimeout(() => resolve(new Response(JSON.stringify({ user }), { status: 200 })), 20)
          }),
      ),
    )
    render(
      <StrictMode>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </StrictMode>,
    )
    expect(screen.getByText('loading')).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(screen.getByText('loading')).toBeTruthy()
    expect(await screen.findByText(user.email)).toBeTruthy()
  })
  it('restores an authenticated cookie session on mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 })),
    )
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )
    expect(screen.getByText('loading')).toBeTruthy()
    expect(await screen.findByText(user.email)).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })

  it('submits credentials and clears state on logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => {
        if (url === '/api/auth/login') {
          return new Response(JSON.stringify({ user }), { status: 200 })
        }
        if (url === '/api/auth/logout') return new Response(null, { status: 204 })
        return new Response(JSON.stringify({ error: { code: 'unauthorized' } }), { status: 401 })
      }),
    )
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )
    expect(await screen.findByText('guest')).toBeTruthy()
    fireEvent.click(screen.getByText('login'))
    expect(await screen.findByText(user.email)).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: user.email, password: 'secret-password', rememberMe: false }),
      }),
    )
    fireEvent.click(screen.getByText('logout'))
    await waitFor(() => expect(screen.getByText('guest')).toBeTruthy())
  })

  it('registers through the API without creating a local authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => {
        if (url === '/api/auth/register') {
          return new Response(
            JSON.stringify({
              account: { email: 'new@example.test', status: 'pending-verification' },
            }),
            { status: 201 },
          )
        }
        return new Response(JSON.stringify({ error: { code: 'unauthorized' } }), { status: 401 })
      }),
    )
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    )
    expect(await screen.findByText('guest')).toBeTruthy()
    fireEvent.click(screen.getByText('register'))
    expect(await screen.findByText('pending-verification')).toBeTruthy()
    expect(screen.getByText('guest')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          displayName: 'New Reader',
          email: 'new@example.test',
          password: 'secure-password',
          acceptedTerms: true,
          accountType: 'reader',
        }),
      }),
    )
  })
})
