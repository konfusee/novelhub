import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const user = {
  id: 'account-1',
  name: 'Test Reader',
  email: 'reader@example.test',
  roles: ['reader'],
};

function Harness() {
  const { authLoading, currentUser, login, logout, register } = useAuth();
  const [registration, setRegistration] = useState('');
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
      <span>{registration}</span>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AuthProvider', () => {
  it('restores an authenticated cookie session on mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 })),
    );
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText(user.email)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
  });

  it('submits credentials and clears state on logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/auth/login') {
          return new Response(JSON.stringify({ user }), { status: 200 });
        }
        if (url === '/api/auth/logout') return new Response(null, { status: 204 });
        return new Response(JSON.stringify({ error: { code: 'unauthorized' } }), { status: 401 });
      }),
    );
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    expect(await screen.findByText('guest')).toBeTruthy();
    fireEvent.click(screen.getByText('login'));
    expect(await screen.findByText(user.email)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: user.email, password: 'secret-password' }),
      }),
    );
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByText('guest')).toBeTruthy());
  });

  it('registers through the API without creating a local authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/auth/register') {
          return new Response(
            JSON.stringify({ account: { email: 'new@example.test', status: 'pending-verification' } }),
            { status: 201 },
          );
        }
        return new Response(JSON.stringify({ error: { code: 'unauthorized' } }), { status: 401 });
      }),
    );
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    expect(await screen.findByText('guest')).toBeTruthy();
    fireEvent.click(screen.getByText('register'));
    expect(await screen.findByText('pending-verification')).toBeTruthy();
    expect(screen.getByText('guest')).toBeTruthy();
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
    );
  });
});
