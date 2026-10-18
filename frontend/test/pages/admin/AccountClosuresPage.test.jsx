import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
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
function view({ item = account, fail = false, monthly = false } = {}) {
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
      if (path.endsWith('/results')) {
        const result = options.body.result;
        row = result === 'Paid' ? null : { ...row, version: row.version + 1, lastResult: 'Failed' };
        return {
          entryId: 'entry-id',
          result,
          financiallyClosed: result === 'Paid',
          replayed: false,
        };
      }
      if (path.endsWith('/bank')) {
        row = { ...row, version: 3, rowVersion: 4, correctedBank: options.body.bank };
        return { withdrawalId: row.id, withdrawalVersion: 3, rowVersion: 4 };
      }
      return {
        account: { id: account.id, version: 9, financiallyClosed: false },
        withdrawalId: 'withdrawal-id',
      };
    }
    if (path.endsWith('/payouts')) return { items: row ? [row] : [], limit: 50 };
    return { items: [item], total: 1, pageSize: 20, period: '2026-10' };
  });
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AccountClosuresPage monthly={monthly} />
      </LocaleProvider>
    </MemoryRouter>,
  );
}
it('shows the monthly queue without manual evaluation and sends results through its own endpoint', async () => {
  view({ monthly: true, item: { ...account, canEvaluate: false, evaluatedAt: '2026-10-01' } });
  expect(await screen.findByRole('heading', { name: 'Chi trả thu nhập tháng' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Đánh giá cuối' })).toBeNull();
  expect(api).toHaveBeenCalledWith('/admin/monthly-payouts?page=1', expect.anything());
  fireEvent.change(screen.getByLabelText('Tháng chi trả'), { target: { value: '2026-10' } });
  fireEvent.click(screen.getByLabelText('Trạng thái khoản chi trả'));
  fireEvent.click(screen.getByRole('option', { name: 'Đã trả' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lọc chi trả' }));
  await waitFor(() =>
    expect(
      api.mock.calls.some(
        ([path]) => path === '/admin/monthly-payouts?page=1&period=2026-10&status=paid',
      ),
    ).toBe(true),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Lịch sử chi trả tài khoản' }));
  await waitFor(() =>
    expect(
      api.mock.calls.some(([path]) => path === '/admin/monthly-payouts/account-id/payouts'),
    ).toBe(true),
  );
});
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
it('requires external-transfer acknowledgement for Paid and sends a unique entry key with both versions', async () => {
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Các khoản chờ chi trả' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận đã chi trả' }));
  fireEvent.change(screen.getByLabelText('Lý do ghi nhận'), {
    target: { value: 'Đã đối chiếu ngân hàng' },
  });
  expect(screen.getByRole('button', { name: 'Lưu kết quả chi trả' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu kết quả chi trả' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/admin/account-closures/account-id/payouts/withdrawal-id/results',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          result: 'Paid',
          confirmedExternalTransfer: true,
          expectedWithdrawalVersion: 2,
          expectedRowVersion: 3,
          resultEntryKey: expect.any(String),
          reason: 'Đã đối chiếu ngân hàng',
        }),
      }),
    ),
  );
  expect(await screen.findByText('Không còn khoản chờ chi trả.')).toBeTruthy();
});
it('records Failed and keeps the pending row visible with its latest result', async () => {
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Các khoản chờ chi trả' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận chưa thành công' }));
  fireEvent.change(screen.getByLabelText('Lý do ghi nhận'), {
    target: { value: 'Chuyển tiền chưa thành công' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu kết quả chi trả' }));
  expect(
    await screen.findByText(/Kết quả gần nhất: Chưa thành công, vẫn chờ chi trả/),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ghi nhận đã chi trả' })).toBeTruthy();
});
