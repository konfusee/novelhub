import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiStatus } from './ApiStatus.jsx';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(impl) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

describe('ApiStatus', () => {
  it('shows ready when the API reports a connected database', async () => {
    mockFetch(async () => new Response(JSON.stringify({ status: 'ready' }), { status: 200 }));
    render(<ApiStatus />);
    expect(await screen.findByText('API and database ready')).toBeTruthy();
  });

  it('shows not-ready when the database is down', async () => {
    mockFetch(async () => new Response(JSON.stringify({ status: 'not-ready' }), { status: 503 }));
    render(<ApiStatus />);
    expect(await screen.findByText('API is up, database not ready')).toBeTruthy();
  });

  it('shows unreachable on a network failure', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    render(<ApiStatus />);
    expect(await screen.findByText('API unreachable')).toBeTruthy();
  });
});
