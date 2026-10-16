import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { RankingsPage } from '../../../src/pages/guest/RankingsPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/components/public/PublicHeader', () => ({
  PublicHeader: () => <header>Header</header>,
}));
const story = {
  id: 'mongo-id',
  title: 'Truyện trong database',
  description: 'Mô tả đã xuất bản',
  author: 'Tác giả thật',
  reads: '7',
  rating: '—',
  chapters: 2,
  genre: 'Kỳ ảo',
  rank: 1,
  change: '—',
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <RankingsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('uses API podium, real pagination and filters without mock counts', async () => {
  mocks.apiRequest.mockImplementation(async (path) => ({
    podium: [story],
    items: path.includes('page=2')
      ? [{ ...story, id: 'second', title: 'Trang tiếp theo', rank: 16 }]
      : [],
    total: 16,
  }));
  view();
  expect(await screen.findAllByText('Truyện trong database')).toBeTruthy();
  expect(screen.getByText('Mô tả đã xuất bản')).toBeTruthy();
  expect(screen.queryByText('48.2K')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '15 truyện tiếp theo' }));
  expect(await screen.findAllByText('Trang tiếp theo')).toBeTruthy();
  expect(screen.getByRole('button', { name: '15 truyện tiếp theo' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/catalog/rankings?category=trending&period=day&page=1',
      expect.anything(),
    ),
  );
});
it('shows an empty audio board and retry on API failure without mock fallback', async () => {
  mocks.apiRequest.mockResolvedValue({ podium: [], items: [], total: 0 });
  view();
  expect(await screen.findByText('Chưa có dữ liệu xếp hạng cho bộ lọc này')).toBeTruthy();
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByText('Nghe nhiều nhất', { exact: true }));
  expect(await screen.findByText('Không tải được bảng xếp hạng')).toBeTruthy();
  mocks.apiRequest.mockResolvedValue({ podium: [story], items: [], total: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findAllByText('Truyện trong database')).toBeTruthy();
});
