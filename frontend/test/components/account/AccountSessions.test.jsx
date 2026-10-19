import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AccountSessions } from '../../../src/components/account/AccountSessions';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
const current = {
  id: 'current',
  current: true,
  client: { os: 'Windows', browser: 'Chrome', deviceType: 'desktop' },
  lastSeenAt: '2026-10-15T00:00:00Z',
};
const other = {
  id: 'other',
  current: false,
  client: { os: 'iPhone', browser: 'Safari', deviceType: 'mobile' },
  lastSeenAt: '2026-10-14T20:30:00Z',
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AccountSessions />
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => mocks.apiRequest.mockReset().mockResolvedValue({ items: [current, other] }));
afterEach(cleanup);

describe('account session devices', () => {
  it('requires confirmation and replaces the list only after server revocation succeeds', async () => {
    view();
    expect(await screen.findByText('iPhone · Safari')).toBeTruthy();
    expect(screen.getByText('Phiên hiện tại · Đang hoạt động')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất các thiết bị khác' }));
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
    mocks.apiRequest
      .mockResolvedValueOnce({ revokedCount: 1 })
      .mockResolvedValueOnce({ items: [current] });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đăng xuất' }));
    expect(
      await screen.findByText('Đã thu hồi 1 phiên đăng nhập khác. Phiên hiện tại được giữ.'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('iPhone · Safari')).toBeNull());
    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/sessions/revoke-others', {
      method: 'POST',
      body: {},
    });
  });

  it('reports failures without pretending that another device was signed out', async () => {
    view();
    await screen.findByText('iPhone · Safari');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất các thiết bị khác' }));
    mocks.apiRequest.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đăng xuất' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/Đã thu hồi/)).toBeNull();
  });

  it('does not show fake devices when session loading fails', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('offline'));
    view();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('iPhone · Safari')).toBeNull();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });
});
