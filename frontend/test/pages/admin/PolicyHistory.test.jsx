import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { PolicyHistory } from '../../../src/pages/admin/PolicyHistory';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const entry = {
  id: 'policy',
  version: 1,
  status: 'effective',
  current: true,
  future: false,
  effectiveAt: '2026-01-01',
  priceMinCoins: 300,
  priceMaxCoins: 900,
  durationMinDays: 2,
  durationMaxDays: 8,
  authorSharePercent: 82,
  platformSharePercent: 18,
  withdrawalThresholdCoins: 150000,
  orderExpiryHours: 12,
  claimExpiryHours: 48,
  reason: 'Chính sách đã được lưu',
};
const response = (items = [entry], page = 1, total = 1, totalPages = 1) => ({
  items,
  page,
  total,
  totalPages,
  pageSize: 5,
});
const view = () =>
  render(
    <LocaleProvider>
      <PolicyHistory />
    </LocaleProvider>,
  );
it('reads persisted history, reasons and terms with no fabricated activation or writes', async () => {
  mocks.apiRequest.mockResolvedValue(response());
  view();
  await screen.findByText('Chính sách đã được lưu');
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/admin/policy/history?page=1&pageSize=5');
  expect(screen.getByText('82% / 18%')).toBeTruthy();
  expect(screen.getByText('150.000')).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText('48')).toBeTruthy();
  expect(screen.getByText('Đang áp dụng')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Trang lịch sử trước' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Trang lịch sử tiếp' }).disabled).toBe(true);
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it('loads next/previous pages through the API without retaining stale rows', async () => {
  mocks.apiRequest.mockImplementation((path) =>
    Promise.resolve(
      path.includes('page=2')
        ? response(
            [{ ...entry, id: 'second', current: false, reason: 'Phiên bản trang hai' }],
            2,
            6,
            2,
          )
        : response([entry], 1, 6, 2),
    ),
  );
  view();
  await screen.findByText('Chính sách đã được lưu');
  fireEvent.click(screen.getByRole('button', { name: 'Trang lịch sử tiếp' }));
  await screen.findByText('Phiên bản trang hai');
  expect(screen.queryByText('Chính sách đã được lưu')).toBeNull();
  expect(screen.getByRole('button', { name: 'Trang lịch sử tiếp' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Trang lịch sử trước' }));
  await screen.findByText('Chính sách đã được lưu');
});
it('distinguishes scheduled, draft and superseded records without calling them current', async () => {
  mocks.apiRequest.mockResolvedValue(
    response(
      [
        { ...entry, id: 'future', current: false, future: true },
        { ...entry, id: 'draft', current: false, status: 'draft', effectiveAt: null, reason: null },
        { ...entry, id: 'old', current: false, status: 'superseded' },
      ],
      1,
      3,
      1,
    ),
  );
  view();
  await screen.findByText('Chưa đến ngày hiệu lực');
  expect(screen.getByText('Bản nháp')).toBeTruthy();
  expect(screen.getByText('Đã thay thế')).toBeTruthy();
  expect(screen.getByText('Chưa đặt ngày hiệu lực')).toBeTruthy();
  expect(screen.getByText('Chưa có lý do kích hoạt được ghi nhận.')).toBeTruthy();
  expect(screen.queryByText('Đang áp dụng')).toBeNull();
});
it('keeps an empty database empty and retries errors without a sample history', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  view();
  await screen.findByRole('alert');
  mocks.apiRequest.mockResolvedValue(response([], 1, 0, 0));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }));
  await screen.findByText('Chưa có phiên bản chính sách nào.');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('82% / 18%')).toBeNull();
});
it('rejects malformed responses instead of presenting them as an empty history', async () => {
  mocks.apiRequest.mockResolvedValue({ policy: entry });
  view();
  await screen.findByRole('alert');
  expect(screen.queryByText('Chưa có phiên bản chính sách nào.')).toBeNull();
});
it('cancels through the confirmation dialog and refreshes the persisted cancellation reason', async () => {
  let cancelled = false;
  const policy = {
    ...entry,
    id: '111111111111111111111111',
    current: false,
    future: true,
    version: 4,
  };
  mocks.apiRequest.mockImplementation((_path, options) => {
    if (options.method === 'POST') {
      cancelled = true;
      return Promise.resolve({ policyId: policy.id, version: 5 });
    }
    return Promise.resolve(
      response([
        {
          ...policy,
          future: !cancelled,
          cancelled,
          status: cancelled ? 'superseded' : 'effective',
          cancellationReason: cancelled ? 'Hủy lịch thử nghiệm' : null,
        },
      ]),
    );
  });
  view();
  await screen.findByRole('button', { name: 'Hủy lịch chính sách' });
  fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch chính sách' }));
  fireEvent.change(screen.getByLabelText('Lý do hủy lịch (bắt buộc)'), {
    target: { value: 'Hủy lịch thử nghiệm' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy lịch' }));
  await screen.findByText('Lý do hủy lịch: Hủy lịch thử nghiệm');
  expect(screen.getByText('Đã hủy lịch')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Hủy lịch chính sách' })).toBeNull();
});
