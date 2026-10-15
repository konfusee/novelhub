import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { FollowingPage } from './FollowingPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ ReaderLayout: ({ children }) => <main>{children}</main> }));
const stories = Array.from({ length: 5 }, (_, index) => ({
  id: `mongo-${index}`,
  title: `Truyện thật ${index}`,
  author: 'Tác giả thật',
  genre: 'Kỳ ảo',
  chapterId: `chapter-${index}`,
  latestChapterTitle: `Chương thật ${index}`,
}));
const following = {
  savedStories: stories,
  collections: [{ id: 'fantasy', title: 'Kỳ ảo', count: 5, story: stories[0] }],
  authors: [{ id: 'author-id', name: 'Tác giả thật', storyId: stories[0].id, meta: 'Kỳ ảo' }],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <FollowingPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('uses actual saved counts, pagination/search and exact chapter links', async () => {
  mocks.apiRequest.mockResolvedValue(following);
  view();
  expect(await screen.findByRole('button', { name: 'Truyện đã lưu (5)' })).toBeTruthy();
  expect(screen.getAllByRole('link', { name: 'Đọc tiếp' })[0].getAttribute('href')).toBe(
    '/read/mongo-0/chapter-0',
  );
  expect(screen.getByText('Đang hiển thị 4 / 5 truyện đã lưu')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByRole('heading', { name: 'Truyện thật 4' })).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Truyện thật 2' } });
  expect(screen.getByRole('heading', { name: 'Truyện thật 2' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Truyện thật 4' })).toBeNull();
});
it('keeps unsupported favorites and alerts explicit instead of simulated toggles', async () => {
  mocks.apiRequest.mockResolvedValue(following);
  view();
  const favoriteButtons = await screen.findAllByRole('button', { name: 'Bật/tắt yêu thích' });
  expect(favoriteButtons.every((button) => button.disabled)).toBe(true);
  expect(screen.getByRole('link', { name: 'Xem truyện' }).getAttribute('href')).toBe(
    '/stories/mongo-0',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Yêu thích (—)' }));
  expect(screen.getByText('Chưa hỗ trợ danh sách yêu thích riêng')).toBeTruthy();
  expect(mocks.apiRequest.mock.calls.every(([path]) => path === '/reader/following')).toBe(true);
});
it('retries failed API reads and renders an empty saved list without demo collections', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  view();
  expect(await screen.findByText('Không tải được danh sách theo dõi')).toBeTruthy();
  mocks.apiRequest.mockResolvedValue({ savedStories: [], collections: [], authors: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Bạn chưa lưu hay theo dõi truyện nào')).toBeTruthy();
});
