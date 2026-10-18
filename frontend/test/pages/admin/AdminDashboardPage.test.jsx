import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AdminDashboardPage } from '../../../src/pages/admin/AdminDashboardPage';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
const data = {
  asOf: '2026-10-18T00:00:00Z',
  kpis: [
    ['activeAccounts', 123],
    ['activeAuthors', 4],
    ['publishedStories', 9],
    ['pendingApplications', 2],
    ['reviewQueue', 3],
    ['pendingPayouts', 1],
  ],
  actions: [
    ['2026-10-01T00:00:00Z', 'system', 'author.monthly-payout.evaluated', 'below-threshold'],
  ],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AdminDashboardPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it('shows API KPI/audit and unavailable telemetry without sample totals or fake safeguard controls', async () => {
  let exported = '';
  vi.stubGlobal(
    'Blob',
    class {
      constructor(parts) {
        exported = parts.join('');
      }
    },
  );
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:test-kpi';
      }
      static revokeObjectURL() {}
    },
  );
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  api.mockResolvedValue(data);
  view();
  expect(await screen.findByText('123')).toBeTruthy();
  expect(screen.getByText('author.monthly-payout.evaluated')).toBeTruthy();
  expect(screen.queryByText('1.84M')).toBeNull();
  expect(screen.queryByText('6,4 TB / 12 TB')).toBeNull();
  expect(screen.getByText('Chưa có dịch vụ được giám sát')).toBeTruthy();
  for (const control of screen.getAllByRole('switch')) expect(control.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Tải KPI hiện tại' }));
  expect(download).toHaveBeenCalledOnce();
  expect(exported).toContain('"123"');
  expect(exported).toContain('Tài khoản đang hoạt động');
  expect(exported).not.toContain('1.84M');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại từ máy chủ' }));
  expect(await screen.findByText('123')).toBeTruthy();
});
it('keeps KPI export disabled when the API fails instead of using mock fallback', async () => {
  api.mockRejectedValue(new Error('Unavailable'));
  view();
  await screen.findByText('Không tải được chỉ số chính');
  expect(screen.getByRole('button', { name: 'Tải KPI hiện tại' }).disabled).toBe(true);
  expect(screen.queryByText('123')).toBeNull();
});
