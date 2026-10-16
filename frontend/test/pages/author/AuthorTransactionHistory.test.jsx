import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorTransactionHistory } from '../../../src/pages/author/AuthorTransactionHistory';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
const credit = {
  id: 'one',
  type: 'allocation-credit',
  direction: 'credit',
  amount: 100,
  unit: 'coin',
  occurredAt: '2026-10-16T01:00:00Z',
};
const debit = { ...credit, id: 'two', type: 'withdrawal-debit', direction: 'debit', amount: 30 };
const element = (period = 'month') => (
  <LocaleProvider>
    <AuthorTransactionHistory period={period} />
  </LocaleProvider>
);
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('shows recorded signed coins and Vietnam time, without invented payment status', async () => {
  mocks.apiRequest.mockResolvedValue({ items: [credit, debit], nextCursor: null });
  const { container } = render(element());
  expect(await screen.findByText('Phân bổ thu nhập')).toBeTruthy();
  expect(screen.getByText('+100 xu')).toBeTruthy();
  expect(screen.getByText('−30 xu')).toBeTruthy();
  expect(container.querySelector('time').textContent).toContain('08:00');
  expect(screen.getByRole('button', { name: 'Trang sau' }).disabled).toBe(true);
  expect(screen.queryByText('Đã chuyển khoản')).toBeNull();
});
it('uses cursor pagination and resets to the first page when period or direction changes', async () => {
  mocks.apiRequest.mockImplementation(async (path) => ({
    items: path.includes('cursor=page-2') ? [debit] : [credit],
    nextCursor: path.includes('cursor=page-2') ? null : 'page-2',
  }));
  const view = render(element());
  await screen.findByText('Phân bổ thu nhập');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await screen.findByText('Trừ ví để thanh toán');
  expect(mocks.apiRequest).toHaveBeenLastCalledWith(
    '/author/transactions?period=month&direction=all&limit=20&cursor=page-2',
    expect.any(Object),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
  await screen.findByText('Phân bổ thu nhập');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await screen.findByText('Trừ ví để thanh toán');
  view.rerender(element('day'));
  await screen.findByText('Phân bổ thu nhập');
  expect(mocks.apiRequest).toHaveBeenLastCalledWith(
    '/author/transactions?period=day&direction=all&limit=20',
    expect.any(Object),
  );
  view.rerender(element('month'));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      '/author/transactions?period=month&direction=all&limit=20',
      expect.any(Object),
    ),
  );
  expect(screen.getByText('Trang 1')).toBeTruthy();
  view.rerender(element('day'));
  await screen.findByText('Phân bổ thu nhập');
  fireEvent.click(screen.getByRole('combobox', { name: 'Chiều biến động' }));
  fireEvent.click(screen.getByRole('option', { name: 'Giảm thu nhập', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      '/author/transactions?period=day&direction=debit&limit=20',
      expect.any(Object),
    ),
  );
  expect(screen.getByText('Trang 1')).toBeTruthy();
});
it('renders a genuine empty state and retries errors without mock fallback', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('unavailable'));
  render(element());
  await screen.findByText('Không tải được biến động ví thu nhập');
  mocks.apiRequest.mockResolvedValueOnce({ items: [], nextCursor: null });
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại lịch sử' }));
  await screen.findByText('Chưa có biến động trong kỳ');
  expect(screen.queryByText('+100 xu')).toBeNull();
});
it('keeps pagination unavailable while loading or when the response is malformed', async () => {
  mocks.apiRequest.mockResolvedValueOnce({ balance: '555' });
  render(element());
  expect(screen.getByRole('button', { name: 'Trang sau' }).disabled).toBe(true);
  await screen.findByText('Không tải được biến động ví thu nhập');
  expect(screen.getByRole('button', { name: 'Trang sau' }).disabled).toBe(true);
});
