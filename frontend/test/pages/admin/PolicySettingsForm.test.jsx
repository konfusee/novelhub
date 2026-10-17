import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { PolicySettingsForm } from '../../../src/pages/admin/PolicySettingsForm';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const policy = {
  id: '111111111111111111111111',
  version: 7,
  priceMinCoins: 200,
  priceMaxCoins: 5000,
  durationMinDays: 1,
  durationMaxDays: 14,
  authorSharePercent: 70,
  withdrawalThresholdCoins: 100000,
};
function view(current = policy) {
  const onSaved = vi.fn();
  const onBusy = vi.fn();
  render(
    <LocaleProvider>
      <PolicySettingsForm policy={current} onSaved={onSaved} onBusy={onBusy} />
    </LocaleProvider>,
  );
  return { onSaved, onBusy };
}
function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
const button = () => screen.getByRole('button', { name: 'Lưu và kích hoạt chính sách' });
it('requires a changed bound and reason, sends exact policy tokens and accepts a real new identity', async () => {
  mocks.apiRequest.mockResolvedValue({ policyId: '222222222222222222222222', version: 0 });
  const callbacks = view();
  expect(button().disabled).toBe(true);
  fill('Giá tối thiểu (xu)', '300');
  expect(button().disabled).toBe(true);
  fill('Lý do thay đổi (bắt buộc)', '  Điều chỉnh mới  ');
  fireEvent.click(button());
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce());
  expect(mocks.apiRequest).toHaveBeenCalledWith('/admin/policy', {
    method: 'POST',
    body: {
      priceMinCoins: 300,
      priceMaxCoins: 5000,
      durationMinDays: 1,
      durationMaxDays: 14,
      authorSharePercent: 70,
      withdrawalThresholdCoins: 100000,
      reason: 'Điều chỉnh mới',
      expectedPolicyId: policy.id,
      expectedPolicyVersion: 7,
    },
  });
});
it('initializes with explicit bounds, null tokens and disclosed default terms', async () => {
  mocks.apiRequest.mockResolvedValue({ policyId: '000000000000000000000001', version: 0 });
  const callbacks = view(null);
  expect(screen.getByLabelText('Tỷ lệ mặc định của tác giả (%)').value).toBe('70');
  for (const [label, value] of [
    ['Giá tối thiểu (xu)', '0'],
    ['Giá tối đa (xu)', '900'],
    ['Thời hạn tối thiểu (ngày)', '2'],
    ['Thời hạn tối đa (ngày)', '8'],
    ['Lý do thay đổi (bắt buộc)', 'Khởi tạo'],
  ])
    fill(label, value);
  fireEvent.click(button());
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce());
  expect(mocks.apiRequest.mock.calls[0][1].body).toMatchObject({
    expectedPolicyId: null,
    expectedPolicyVersion: null,
    priceMinCoins: 0,
  });
});
it('rejects inverted bounds and fractional durations before any write', () => {
  view();
  fill('Lý do thay đổi (bắt buộc)', 'Điều chỉnh');
  fill('Giá tối thiểu (xu)', '6000');
  expect(button().disabled).toBe(true);
  expect(screen.getByRole('alert')).toBeTruthy();
  fill('Giá tối thiểu (xu)', '300');
  fill('Thời hạn tối đa (ngày)', '1.5');
  expect(button().disabled).toBe(true);
  expect(mocks.apiRequest).not.toHaveBeenCalled();
});
it('blocks duplicate submissions and requires reload after uncertain failure', async () => {
  let reject;
  mocks.apiRequest.mockReturnValue(
    new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const callbacks = view();
  fill('Giá tối thiểu (xu)', '300');
  fill('Lý do thay đổi (bắt buộc)', 'Điều chỉnh');
  fireEvent.click(button());
  const busyButton = screen.getByRole('button', { name: 'Đang kích hoạt…' });
  fireEvent.click(busyButton);
  expect(mocks.apiRequest).toHaveBeenCalledOnce();
  reject(new Error('network'));
  await screen.findByRole('alert');
  expect(button().disabled).toBe(true);
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(callbacks.onBusy.mock.calls).toEqual([[true], [false]]);
});
it('does not accept a successful HTTP response that returns the old policy identity', async () => {
  mocks.apiRequest.mockResolvedValue({ policyId: policy.id, version: 8 });
  const callbacks = view();
  fill('Giá tối thiểu (xu)', '300');
  fill('Lý do thay đổi (bắt buộc)', 'Điều chỉnh');
  fireEvent.click(button());
  await screen.findByRole('alert');
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(button().disabled).toBe(true);
});
it('allows a finance-only change and computes the platform complement without sending it', async () => {
  mocks.apiRequest.mockResolvedValue({ policyId: '333333333333333333333333', version: 0 });
  const callbacks = view();
  fill('Tỷ lệ mặc định của tác giả (%)', '82');
  fill('Ngưỡng rút tiền (xu)', '150000');
  fill('Lý do thay đổi (bắt buộc)', 'Cập nhật chính sách doanh thu');
  expect(screen.getByText(/nền tảng: 18%/)).toBeTruthy();
  fireEvent.click(button());
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce());
  expect(mocks.apiRequest.mock.calls[0][1].body).toMatchObject({
    authorSharePercent: 82,
    withdrawalThresholdCoins: 150000,
    priceMinCoins: 200,
  });
  expect(mocks.apiRequest.mock.calls[0][1].body).not.toHaveProperty('platformSharePercent');
});
it('blocks invalid percentages and negative or fractional withdrawal thresholds', () => {
  view();
  fill('Lý do thay đổi (bắt buộc)', 'Kiểm tra');
  for (const value of ['101', '-1', '70.5']) {
    fill('Tỷ lệ mặc định của tác giả (%)', value);
    expect(button().disabled).toBe(true);
  }
  fill('Tỷ lệ mặc định của tác giả (%)', '0');
  fill('Ngưỡng rút tiền (xu)', '0');
  expect(button().disabled).toBe(false);
  for (const value of ['-1', '1.5']) {
    fill('Ngưỡng rút tiền (xu)', value);
    expect(button().disabled).toBe(true);
  }
  expect(mocks.apiRequest).not.toHaveBeenCalled();
});
