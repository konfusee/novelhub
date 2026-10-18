import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { BankReceiptsPage } from '../../../src/pages/admin/BankReceiptsPage';
import { LocaleProvider } from '../../../src/context/LocaleContext';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
const receipt = {
  id: '6ad1d6b9bec9b0fe6c41226a',
  version: 2,
  providerId: 'bank-123',
  amountVnd: 10000,
  content: 'Nội dung ngân hàng gốc',
  paymentCode: 'NH12345678',
  status: 'amount-mismatch',
  originalStatus: 'amount-mismatch',
  receivedAt: '2026-10-18T00:00:00Z',
  canResolve: true,
};
const accountId = '6ad1d6b9bec9b0fe6c41226b';
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <BankReceiptsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function fill() {
  fireEvent.click(await screen.findByRole('button', { name: 'Đối chiếu và gán người nhận' }));
  fireEvent.change(screen.getByLabelText('Mã tài khoản nhận xu'), { target: { value: accountId } });
  fireEvent.change(screen.getByLabelText('Lý do và bằng chứng đối chiếu'), {
    target: { value: 'Đã kiểm tra sao kê' },
  });
}
it('requires explicit recipient acknowledgement and reloads the real queue after adjustment', async () => {
  let resolved = false;
  mocks.apiRequest.mockImplementation((_path, options) => {
    if (options?.method === 'POST') {
      resolved = true;
      return Promise.resolve({ receiptId: receipt.id, adjustmentId: 'ledger-id' });
    }
    return Promise.resolve({ items: resolved ? [] : [receipt], hasMore: false });
  });
  view();
  await fill();
  expect(screen.getByRole('button', { name: 'Xác nhận cộng xu' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cộng xu' }));
  await screen.findByText('Không có giao dịch trong nhóm này.');
  expect(mocks.apiRequest).toHaveBeenCalledWith(`/admin/bank-receipts/${receipt.id}/resolve`, {
    method: 'POST',
    body: { expectedVersion: 2, accountId, reason: 'Đã kiểm tra sao kê', confirmedRecipient: true },
  });
});
it('retains input and blocks stale retry when the server rejects the receipt', async () => {
  mocks.apiRequest.mockImplementation((_path, options) =>
    options?.method === 'POST'
      ? Promise.reject(new Error('Giao dịch đã thay đổi.'))
      : Promise.resolve({ items: [receipt], hasMore: false }),
  );
  view();
  await fill();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cộng xu' }));
  await screen.findByText('Giao dịch đã thay đổi.');
  expect(screen.getByLabelText('Mã tài khoản nhận xu').value).toBe(accountId);
  expect(screen.getByRole('button', { name: 'Xác nhận cộng xu' }).disabled).toBe(true);
});
it('loads resolved history and handles read errors with a working reload', async () => {
  mocks.apiRequest
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementation((path) =>
      Promise.resolve({
        items: path.includes('status=resolved')
          ? [
              {
                ...receipt,
                status: 'resolved',
                canResolve: false,
                reason: 'Đã đối chiếu',
                adjustmentId: 'ledger-original',
              },
            ]
          : [],
        hasMore: false,
      }),
    );
  view();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Không có giao dịch trong nhóm này.');
  fireEvent.click(screen.getByRole('button', { name: 'Đã xử lý' }));
  await screen.findByText('ledger-original');
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Đối chiếu và gán người nhận' })).toBeNull(),
  );
});
