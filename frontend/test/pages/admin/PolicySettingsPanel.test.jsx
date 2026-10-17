import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { PolicySettingsPanel } from '../../../src/pages/admin/PolicySettingsPanel';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const view = () =>
  render(
    <LocaleProvider>
      <PolicySettingsPanel />
    </LocaleProvider>,
  );
it('renders persisted bounds and reloads actual server data without a save simulation', async () => {
  mocks.apiRequest.mockResolvedValue({
    policy: {
      effectiveAt: '2026-01-01',
      priceMinCoins: 321,
      priceMaxCoins: 987,
      durationMinDays: 2,
      durationMaxDays: 8,
      authorSharePercent: 75,
      platformSharePercent: 25,
    },
  });
  view();
  await screen.findByText('321');
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/admin/policy');
  expect(screen.getByRole('button', { name: 'Lưu và kích hoạt chính sách' }).disabled).toBe(true);
  mocks.apiRequest.mockResolvedValue({ policy: null });
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại chính sách' }));
  await screen.findByText(/Chưa có chính sách đang hiệu lực/);
  expect(screen.queryByText('321')).toBeNull();
});
it('keeps an empty database empty instead of displaying mock settings', async () => {
  mocks.apiRequest.mockResolvedValue({ policy: null });
  view();
  await screen.findByText(/Chưa có chính sách đang hiệu lực/);
  expect(screen.queryByText('200')).toBeNull();
});
it('shows an error and supports retry without stale or fabricated values', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  view();
  await screen.findByRole('alert');
  mocks.apiRequest.mockResolvedValue({ policy: null });
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại chính sách' }));
  await screen.findByText(/Chưa có chính sách đang hiệu lực/);
  expect(screen.queryByRole('alert')).toBeNull();
});
