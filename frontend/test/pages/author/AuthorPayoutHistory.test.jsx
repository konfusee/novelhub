import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorPayoutHistory } from '../../../src/pages/author/AuthorPayoutHistory';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
const item = {
  id: 'paid',
  period: '2026-09',
  amountCoins: 100000,
  state: 'paid',
  evaluatedAt: '2026-10-01T00:00:00Z',
  cutoffAt: '2026-09-30T17:00:00Z',
  paidAt: '2026-10-02T01:00:00Z',
  lastFailedAt: null,
  finalPayout: false,
};
const detail = {
  item,
  slip: { id: 'paid', period: '2026-09', amountVnd: 100000, paidAt: item.paidAt },
};
const view = () =>
  render(
    <LocaleProvider>
      <AuthorPayoutHistory />
    </LocaleProvider>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('opens a real detail and shows VND only in the confirmed Paid slip without any write', async () => {
  mocks.apiRequest.mockImplementation(async (path) =>
    path === '/author/payouts/paid' ? detail : { items: [item], nextCursor: null },
  );
  view();
  await screen.findByText('100.000 xu');
  expect(screen.queryByRole('region', { name: 'Phiếu thanh toán đã ghi nhận' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xem thanh toán kỳ 2026-09' }));
  const slip = await screen.findByRole('region', { name: 'Phiếu thanh toán đã ghi nhận' });
  expect(slip.textContent).toContain('100.000');
  expect(slip.textContent).toContain('₫');
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options.method)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it.each(['pending', 'failed', 'unavailable'])(
  'does not show a slip for %s even if a response includes a stray slip',
  async (state) => {
    mocks.apiRequest.mockImplementation(async (path) =>
      path === '/author/payouts/paid'
        ? { ...detail, item: { ...item, state } }
        : { items: [{ ...item, state }], nextCursor: null },
    );
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Xem thanh toán kỳ 2026-09' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('100.000 xu');
    expect(
      within(dialog).queryByRole('region', { name: 'Phiếu thanh toán đã ghi nhận' }),
    ).toBeNull();
  },
);
it('resets pagination for a new month and can clear the month filter', async () => {
  mocks.apiRequest.mockImplementation(async (path) => ({
    items: [item],
    nextCursor: path.includes('cursor=next') ? null : 'next',
  }));
  view();
  await screen.findByText('100.000 xu');
  fireEvent.click(screen.getByRole('button', { name: 'Trang thanh toán sau' }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      '/author/payouts?limit=20&cursor=next',
      expect.any(Object),
    ),
  );
  const month = screen.getByLabelText('Kỳ thanh toán');
  month.focus();
  fireEvent.change(month, { target: { value: '2026-09' } });
  expect(mocks.apiRequest).toHaveBeenLastCalledWith(
    '/author/payouts?limit=20&cursor=next',
    expect.any(Object),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Lọc kỳ' }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      '/author/payouts?limit=20&period=2026-09',
      expect.any(Object),
    ),
  );
  expect(screen.getByText('Trang 1')).toBeTruthy();
  expect(month.isConnected).toBe(true);
  expect(document.activeElement).toBe(month);
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả các kỳ' }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      '/author/payouts?limit=20',
      expect.any(Object),
    ),
  );
});
it('refreshes the recorded result explicitly without writing payment state', async () => {
  mocks.apiRequest.mockResolvedValueOnce({
    items: [{ ...item, state: 'pending' }],
    nextCursor: null,
  });
  view();
  await screen.findByText('Chờ thanh toán');
  mocks.apiRequest.mockResolvedValueOnce({ items: [item], nextCursor: null });
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới thanh toán' }));
  await screen.findByText('Đã ghi nhận thanh toán');
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it('handles empty, failed list and failed detail responses without mock payment results', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('network'));
  view();
  await screen.findByText('Không tải được thông tin thanh toán');
  mocks.apiRequest.mockResolvedValueOnce({ items: [], nextCursor: null });
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại thanh toán' }));
  await screen.findByText('Chưa có kỳ thanh toán phù hợp');
  cleanup();
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path === '/author/payouts/paid') throw new Error('not found');
    return { items: [item], nextCursor: null };
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem thanh toán kỳ 2026-09' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('region', { name: 'Phiếu thanh toán đã ghi nhận' })).toBeNull();
});
