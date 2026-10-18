import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AccountClosuresPage } from '../../../src/pages/admin/AccountClosuresPage';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const account = {
  id: 'account-id',
  version: 8,
  balance: 137,
  pendingWithdrawals: 1,
  canEvaluate: true,
  evaluatedAt: null,
};
function view({ item = account, fail = false } = {}) {
  let row = {
    id: 'withdrawal-id',
    version: 2,
    rowVersion: 3,
    period: '2026-10',
    amountCoins: 137,
    canCorrect: true,
    originalBank: { bankName: 'Ngân hàng gốc', accountNumber: '123456', accountHolder: 'TÁC GIẢ' },
  };
  api.mockImplementation(async (path, options) => {
    if (options?.method) {
      if (fail) throw new Error('Tài khoản đã thay đổi');
      if (path.endsWith('/bank')) {
        row = { ...row, version: 3, rowVersion: 4, correctedBank: options.body.bank };
        return { withdrawalId: row.id, withdrawalVersion: 3, rowVersion: 4 };
      }
      return {
        account: { id: account.id, version: 9, financiallyClosed: false },
        withdrawalId: 'withdrawal-id',
      };
    }
    if (path.endsWith('/payouts')) return { items: [row], limit: 50 };
    return { items: [item], total: 1, pageSize: 20, period: '2026-10' };
  });
  render(
    <LocaleProvider>
      <AccountClosuresPage />
    </LocaleProvider>,
  );
}
it('submits the displayed baseline and reason, then reloads the real queue', async () => {
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Đánh giá cuối' }));
  fireEvent.change(screen.getByLabelText('Lý do đánh giá'), {
    target: { value: ' Kiểm tra kỳ cuối ' },
  });
  fireEvent.click(
    screen
      .getAllByRole('button', { name: 'Đánh giá cuối' })
      .find((button) => button.getAttribute('type') === 'submit'),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/admin/account-closures/account-id/evaluate', {
      method: 'POST',
      body: { expectedVersion: 8, reason: 'Kiểm tra kỳ cuối' },
    }),
  );
  await waitFor(() => expect(screen.queryByLabelText('Lý do đánh giá')).toBeNull());
  expect(api.mock.calls.filter(([, options]) => !options?.method).length).toBeGreaterThan(1);
});
it('disables evaluation before the server says the cutoff has been reached', async () => {
  view({ item: { ...account, canEvaluate: false } });
  expect((await screen.findByRole('button', { name: 'Đánh giá cuối' })).disabled).toBe(true);
  expect(screen.getByText('Chờ kỳ tháng sau khi đóng')).toBeTruthy();
});
it('keeps the reason and requires reload after a stale write rather than showing completion', async () => {
  view({ fail: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Đánh giá cuối' }));
  fireEvent.change(screen.getByLabelText('Lý do đánh giá'), { target: { value: 'Giữ lý do' } });
  fireEvent.click(
    screen
      .getAllByRole('button', { name: 'Đánh giá cuối' })
      .find((button) => button.getAttribute('type') === 'submit'),
  );
  expect((await screen.findByRole('alert')).textContent).toContain('Tài khoản đã thay đổi');
  expect(screen.getByLabelText('Lý do đánh giá').value).toBe('Giữ lý do');
});
it('saves a versioned bank correction and continues to show the original bank snapshot', async () => {
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Các khoản chờ chi trả' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Hiệu chỉnh ngân hàng' }));
  fireEvent.change(screen.getByLabelText('Tên ngân hàng'), { target: { value: 'Ngân hàng mới' } });
  fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '987654' } });
  fireEvent.change(screen.getByLabelText('Lý do hiệu chỉnh'), {
    target: { value: 'Hỗ trợ xác nhận' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin hiệu chỉnh' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/admin/account-closures/account-id/payouts/withdrawal-id/bank',
      {
        method: 'POST',
        body: {
          expectedRowVersion: 3,
          expectedWithdrawalVersion: 2,
          reason: 'Hỗ trợ xác nhận',
          bank: { bankName: 'Ngân hàng mới', accountNumber: '987654', accountHolder: 'TÁC GIẢ' },
        },
      },
    ),
  );
  expect(await screen.findByText(/Ngân hàng tại thời điểm đánh giá: Ngân hàng gốc/)).toBeTruthy();
  expect(await screen.findByText(/Thông tin đã hiệu chỉnh: Ngân hàng mới/)).toBeTruthy();
});
it('retains bank inputs when correction fails and requires a fresh baseline', async () => {
  view({ fail: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Các khoản chờ chi trả' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Hiệu chỉnh ngân hàng' }));
  fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '987654' } });
  fireEvent.change(screen.getByLabelText('Lý do hiệu chỉnh'), { target: { value: 'Giữ lại' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin hiệu chỉnh' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Tài khoản đã thay đổi');
  expect(screen.getByLabelText('Số tài khoản').value).toBe('987654');
  expect(screen.getByRole('button', { name: 'Lưu thông tin hiệu chỉnh' }).disabled).toBe(true);
});
