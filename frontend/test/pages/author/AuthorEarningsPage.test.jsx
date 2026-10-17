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
  mocks.apiRequest.mockImplementation(async (path) =>
    path.startsWith('/author/transactions') || path.startsWith('/author/payouts')
      ? { items: [], nextCursor: null }
      : data,
  );
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
  mocks.apiRequest.mockImplementation(async (path) =>
    path.startsWith('/author/transactions') || path.startsWith('/author/payouts')
      ? { items: [], nextCursor: null }
      : data,
  );
  view();
  await screen.findByText('555 xu');
  fireEvent.click(screen.getByRole('combobox', { name: 'Tác phẩm' }));
  fireEvent.click(screen.getByRole('option', { name: 'Truyện thật', exact: true }));
  expect(
    screen.getByRole('link', { name: 'Quản lý truyện', exact: true }).getAttribute('href'),
  ).toBe('/author/stories/real-owned');
  expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull();
});

it('renders real current terms and reloads them separately from historical credits', async () => {
  let percentage = 79;
  mocks.apiRequest.mockImplementation(async (path) =>
    path.startsWith('/author/transactions') || path.startsWith('/author/payouts')
      ? { items: [], nextCursor: null }
      : {
          ...data,
          agreement: {
            authorShare: percentage,
            platformShare: 100 - percentage,
            source: 'agreement',
            effectiveAt: '2026-10-17T00:00:00Z',
          },
        },
  );
  view();
  await screen.findByText('79%');
  expect(screen.getByText('21%')).toBeTruthy();
  expect(screen.getByText('Thỏa thuận đang hiệu lực')).toBeTruthy();
  expect(screen.getByText('100')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu thỏa thuận' })).toBeNull();
  percentage = 0;
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại từ máy chủ' }));
  await screen.findByText('0%');
  expect(screen.getByText('100%')).toBeTruthy();
  expect(screen.getByText('100')).toBeTruthy();
});
it('does not invent a percentage when the terms cannot be loaded', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Offline'));
  view();
  await screen.findByText('Chưa tải được thỏa thuận hiện tại. Không dùng tỷ lệ mẫu để thay thế.');
  expect(screen.queryByText('70%')).toBeNull();
  expect(screen.queryByText('80%')).toBeNull();
});
