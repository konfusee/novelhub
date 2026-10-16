import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { GuestHomePage } from '../../../src/pages/guest/GuestHomePage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), authenticated: false }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mocks.authenticated }),
}));
vi.mock('../../../src/components/public/PublicHeader', () => ({
  PublicHeader: () => <header>Header hiện có</header>,
}));
const story = {
  id: 'mongo-story',
  title: 'Tác phẩm từ MongoDB',
  author: 'Tác giả thật',
  genre: 'Kỳ ảo',
  genres: ['Kỳ ảo'],
  reads: '0',
  rating: '—',
};
const home = {
  trending: [story],
  stories: [story],
  categories: [
    {
      id: 'genre',
      name: 'Kỳ ảo',
      count: 1,
      description: 'Mô tả thể loại thật',
      tone: 'purple',
      icon: 'Sparkles',
    },
  ],
  featured: [
    {
      label: 'Tuyển chọn',
      title: 'Bộ sưu tập trong database',
      description: 'Lời giới thiệu từ MongoDB',
      tone: 'rose',
    },
  ],
  stats: { readers: 42, stories: 1, authors: 1, rating: null },
  preview: {
    story,
    number: 7,
    chapterId: 'mongo-chapter',
    title: 'Chương công khai',
    paragraphs: ['Nội dung đọc thử thật trong MongoDB.'],
  },
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <GuestHomePage />
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  mocks.authenticated = false;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('home catalogue from MongoDB preserving its layout', () => {
  it('renders actual counts, genres, editorial cards and public prose without fake audio playback', async () => {
    mocks.apiRequest.mockResolvedValue(home);
    view();
    expect(await screen.findByText('Nội dung đọc thử thật trong MongoDB.')).toBeTruthy();
    expect(screen.getByText('Bộ sưu tập trong database')).toBeTruthy();
    expect(screen.getByText('Mô tả thể loại thật')).toBeTruthy();
    expect(document.querySelector('a[href="/stories/mongo-story"]')).toBeTruthy();
    expect(screen.queryByText('3M+')).toBeNull();
    expect(screen.queryByText('100K+')).toBeNull();
    expect(screen.getByRole('button', { name: 'Phát', exact: true }).disabled).toBe(true);
    expect(mocks.apiRequest).toHaveBeenCalledWith('/catalog/home', expect.any(Object));
    expect(mocks.apiRequest.mock.calls.some(([path]) => path === '/reader/history')).toBe(false);
  });
  it('uses the authenticated reader history to resume the actual chapter', async () => {
    mocks.authenticated = true;
    mocks.apiRequest.mockImplementation((path) =>
      Promise.resolve(
        path === '/catalog/home'
          ? home
          : path === '/reader/history'
            ? {
                items: [
                  {
                    ...story,
                    chapterId: 'mongo-chapter',
                    detail: 'Chương 7',
                    type: 'story',
                    progress: 37,
                  },
                ],
              }
            : { following: true },
      ),
    );
    view();
    expect(await screen.findByText('37%')).toBeTruthy();
    expect(document.querySelector('a[href="/read/mongo-story/mongo-chapter"]')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đánh dấu truyện' }).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu truyện' }));
    await waitFor(() =>
      expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/follows/mongo-story', {
        method: 'PUT',
        body: { following: false },
      }),
    );
  });
  it('shows retryable API errors without replacing them with sample stories', async () => {
    mocks.apiRequest.mockRejectedValue(new Error('offline'));
    view();
    expect((await screen.findAllByRole('button', { name: 'Thử lại' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('The Silent Forest')).toBeNull();
  });
});
