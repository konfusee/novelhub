import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { FinanceReportPage } from '../../../src/pages/admin/FinanceReportPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
const report = {
  summary: {
    platformBalanceCoins: 70,
    platformRevenueCoins: 60,
    authorRevenueCoins: 140,
    topUpCoins: 200,
    unlockCoins: 200,
    pendingPayoutCoins: 40,
    paidPayoutCoins: 100,
    openBankExceptions: 1,
    failedPayoutAttempts: 0,
  },
  asOf: '2026-10-18T00:00:00Z',
  items: [
    {
      id: 'ledger-real',
      type: 'allocation-credit',
      direction: 'credit',
      amount: 60,
      occurredAt: '2026-10-18T00:00:00Z',
      purpose: 'system-earnings',
      ownerType: 'system',
      ownerId: 'system-owner',
      sourceId: 'unlock-real',
    },
  ],
  hasMore: true,
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <FinanceReportPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('renders actual finance/ledger and requests month filters with pagination reset', async () => {
  mocks.apiRequest.mockResolvedValue(report);
  view();
  await screen.findByText('Mã nghiệp vụ: unlock-real');
  expect(screen.getByText('Doanh thu hệ thống trong kỳ')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Đối soát ngân hàng' }).getAttribute('href')).toBe(
    '/admin/bank-receipts',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.some(([path]) => path.endsWith('page=2'))).toBe(true),
  );
  await screen.findByText('Mã nghiệp vụ: unlock-real');
  fireEvent.change(screen.getByLabelText('Tháng báo cáo (để trống: tất cả)'), {
    target: { value: '2026-10' },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Áp dụng' }).closest('form'));
  await waitFor(() =>
    expect(
      mocks.apiRequest.mock.calls.some(
        ([path]) => path === '/admin/finance-report?period=2026-10&type=all&purpose=all&page=1',
      ),
    ).toBe(true),
  );
});
it('keeps errors explicit and rejects malformed numeric reports instead of inventing metrics', async () => {
  mocks.apiRequest
    .mockResolvedValueOnce({
      ...report,
      summary: { ...report.summary, platformRevenueCoins: 'fake' },
    })
    .mockResolvedValue({ ...report, items: [], hasMore: false });
  view();
  await screen.findByRole('alert');
  expect(screen.queryByText('Mã nghiệp vụ: unlock-real')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Không có bút toán phù hợp.');
  expect(screen.getByRole('button', { name: 'Trang sau' }).disabled).toBe(true);
});
