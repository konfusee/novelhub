import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { PayoutOperationsPage } from '../../../src/pages/admin/PayoutOperationsPage';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const data = {
  period: '2026-10',
  asOf: '2026-10-18T00:00:00Z',
  total: 21,
  pageSize: 20,
  summary: {
    evaluations: 21,
    bankRequired: 2,
    belowThreshold: 3,
    remainingCandidates: 1,
    pendingWithdrawals: 0,
    paidWithdrawals: 0,
    pendingEmails: 4,
    failedEmails: 0,
    expiredEmailLeases: 0,
  },
  items: [
    {
      id: 'audit',
      accountId: 'account-private-id',
      action: 'author.monthly-payout.evaluated',
      result: 'bank-required',
      occurredAt: '2026-10-01T00:00:00Z',
    },
  ],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <PayoutOperationsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
it('renders committed evaluation results and paginates without exposing a run action', async () => {
  api.mockResolvedValue(data);
  view();
  expect(await screen.findByText('Thiếu thông tin ngân hàng')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path === '/admin/payout-operations?page=2')).toBe(true),
  );
  expect(screen.queryByRole('button', { name: /Chạy/ })).toBeNull();
});
it('rejects malformed operational counts instead of showing healthy zeros', async () => {
  api.mockResolvedValue({ ...data, summary: { ...data.summary, failedEmails: -1 } });
  view();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('account-private-id')).toBeNull();
});
