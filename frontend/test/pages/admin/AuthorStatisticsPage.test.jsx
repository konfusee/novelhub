import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorStatisticsPage } from '../../../src/pages/admin/AuthorStatisticsPage';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorStatisticsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
it('renders real counts and sends the selected period to the backend', async () => {
  api.mockResolvedValue({
    summary: {
      applications: 2,
      approvedApplications: 1,
      rejectedApplications: 1,
      pendingApplications: 0,
      activeAuthors: 3,
      unlocks: 4,
      unlockCoins: 950,
      buyers: 2,
    },
    asOf: '2026-10-18T00:00:00Z',
  });
  view();
  expect(await screen.findByText('950')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Tháng thống kê'), { target: { value: '2026-09' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  await waitFor(() =>
    expect(
      api.mock.calls.some(([path]) => path === '/admin/author-statistics?period=2026-09'),
    ).toBe(true),
  );
});
it('shows an error rather than sample values on invalid responses', async () => {
  api.mockResolvedValue({ summary: { unlockCoins: -1 }, asOf: 'bad' });
  view();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('950')).toBeNull();
});
