import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { ReaderHomePage } from './ReaderHomePage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ ReaderLayout: ({ children }) => <main>{children}</main> }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { name: 'Độc giả thật' }, hasRole: () => false }),
}));
const story = {
  id: 'mongo-story',
  title: 'Truyện MongoDB',
  author: 'Tác giả thật',
  genre: 'Kỳ ảo',
  rating: '—',
  saved: false,
  chapterId: 'real-seven',
  detail: 'Chương 7',
  progress: 65,
};
const home = {
  continuing: [story],
  recommendations: [story],
  picks: [{ ...story, id: 'pick', title: 'Gợi ý trong database' }],
  picksGenre: 'Kỳ ảo',
  picksPageCount: 2,
  updates: [{ ...story, chapter: 'Tên chương đã xuất bản' }],
  releases: [],
  todayChapters: 1,
  activity: [{ date: '2026-10-12', active: true }],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ReaderHomePage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('uses real resume IDs and confirmed follow mutations across cards, with server recommendation pagination', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return { following: true };
    return path.endsWith('=2')
      ? { ...home, picks: [{ ...story, id: 'next', title: 'Gợi ý trang hai' }] }
      : home;
  });
  view();
  expect(await screen.findByText('Tên chương đã xuất bản')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Đọc tiếp' }).getAttribute('href')).toBe(
    '/read/mongo-story/real-seven',
  );
  expect(screen.getByRole('button', { name: 'Chưa có âm thanh đang phát' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Lưu Truyện MongoDB' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Bỏ lưu truyện' }).getAttribute('aria-pressed')).toBe(
      'true',
    ),
  );
  expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/follows/mongo-story', {
    method: 'PUT',
    body: { following: true },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới đề xuất' }));
  expect(await screen.findAllByText('Gợi ý trang hai')).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/home?picksPage=2', expect.anything());
  expect(screen.queryByText('18 ngày')).toBeNull();
  expect(screen.queryByText('1:24:18')).toBeNull();
});
it('retains the unsaved state on mutation failure and offers retry without mock data', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method) throw new Error('offline');
    return home;
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu Truyện MongoDB' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Lưu Truyện MongoDB' }).getAttribute('aria-pressed'),
  ).toBe('false');
});
it('shows API errors and recovers to genuine empty history', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  view();
  expect(await screen.findByText('Không tải được truyện đang đọc')).toBeTruthy();
  expect(screen.queryByText('The Silent Forest')).toBeNull();
  mocks.apiRequest.mockResolvedValue({
    ...home,
    continuing: [],
    recommendations: [],
    picks: [],
    updates: [],
    activity: [],
    todayChapters: 0,
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Thử lại' })[0]);
  expect(await screen.findByText('Bạn chưa bắt đầu truyện nào')).toBeTruthy();
});
