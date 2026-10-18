import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { WalletPage } from '../../../src/pages/reader/WalletPage';
import { LocaleProvider } from '../../../src/context/LocaleContext';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  ReaderLayout: ({ children }) => <main>{children}</main>,
}));
const pack = { id: '6ad1d6b9bec9b0fe6c41226a', coinAmount: 20000, priceVnd: 20000 };
const order = {
  id: '6ad1d6b9bec9b0fe6c41226b',
  paymentCode: 'NH12345678',
  status: 'pending',
  coinAmount: 20000,
  priceVnd: 20000,
  expiresAt: '2099-01-01T00:00:00Z',
};
const wallet = {
  balance: 37,
  packages: [pack],
  entries: [],
  orders: [],
  payment: { bankName: 'Ngân hàng kiểm thử', accountNumber: '1234567890' },
  authorRatePercent: 65,
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <WalletPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('creates an invoice without crediting locally and refreshes only after server confirmation', async () => {
  let paid = false;
  mocks.apiRequest.mockImplementation((path, options) => {
    if (path === '/reader/wallet')
      return Promise.resolve({ ...wallet, balance: paid ? 20037 : 37 });
    if (options?.method === 'POST') return Promise.resolve({ order });
    paid = true;
    return Promise.resolve({ order: { ...order, status: 'paid' } });
  });
  view();
  await screen.findByText('37');
  expect(screen.queryByText(/1,4 triệu/)).toBeNull();
  expect(screen.getByText('65%')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Chọn gói' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }));
  await screen.findByText('NH12345678');
  expect(await screen.findByText('37')).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/top-up-orders', {
    method: 'POST',
    body: { packageId: pack.id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra thanh toán' }));
  await screen.findByText(/Ngân hàng đã xác nhận thanh toán/);
  await screen.findByText('20.037');
});
it('resumes a pending invoice without creating another and blocks expired payment instructions', async () => {
  mocks.apiRequest.mockImplementation((path) =>
    Promise.resolve(
      path === '/reader/wallet'
        ? { ...wallet, orders: [order] }
        : { order: { ...order, status: 'expired' } },
    ),
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: order.paymentCode }));
  expect(screen.getByText('1234567890')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra thanh toán' }));
  await screen.findByText(/Hóa đơn đã hết hạn/);
  expect(screen.queryByText('1234567890')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Kiểm tra thanh toán' })).toBeNull();
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
it('does not show fabricated balance or packages on a failed response and supports retry', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(wallet);
  view();
  await screen.findByText('Không tải được số dư ví');
  expect(screen.queryByText('1.420')).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'Thử lại' })[0]);
  await screen.findByText('37');
});
it('keeps an invoice error visible without fake success or balance changes', async () => {
  mocks.apiRequest.mockImplementation((path) =>
    path === '/reader/wallet'
      ? Promise.resolve(wallet)
      : Promise.reject(new Error('Gói nạp không còn hoạt động.')),
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn gói' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn' }));
  await screen.findByText('Gói nạp không còn hoạt động.');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Tạo hóa đơn' }).disabled).toBe(false),
  );
  expect(screen.getByText('37')).toBeTruthy();
});
