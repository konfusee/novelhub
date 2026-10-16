import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorEarningsPage } from '../../../src/pages/author/AuthorEarningsPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
const data = {
  balance: '555',
  allocationCredits: 100,
  bars: [100],
  labels: ['2026-10-16'],
  stories: [{ id: 'real-owned', title: 'Truyện thật' }],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorEarningsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('shows recorded credits separately from the real wallet without fabricated USD or prices', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  expect(await screen.findByText('555 xu')).toBeTruthy();
  expect(screen.getByText('100')).toBeTruthy();
  expect(screen.queryByText('Tác giả nhận 70%')).toBeNull();
  expect(screen.queryByText('$292.25')).toBeNull();
  expect(screen.getByRole('spinbutton', { name: 'Giá mỗi chương trả phí (xu)' }).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hôm nay', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/earnings?period=day',
      expect.any(Object),
    ),
  );
});
it('uses actual owned IDs for management and has no fake successful price save', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  await screen.findByText('555 xu');
  fireEvent.click(screen.getByRole('combobox', { name: 'Tác phẩm' }));
  fireEvent.click(screen.getByRole('option', { name: 'Truyện thật', exact: true }));
  expect(
    screen.getByRole('link', { name: 'Quản lý truyện', exact: true }).getAttribute('href'),
  ).toBe('/author/stories/real-owned');
  expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull();
});
