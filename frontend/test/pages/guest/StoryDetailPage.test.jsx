import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { StoryDetailPage } from '../../../src/pages/guest/StoryDetailPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), authenticated: false }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mocks.authenticated }),
}));
vi.mock('../../../src/components/public/PublicHeader', () => ({ PublicHeader: () => null }));
vi.mock('../../../src/components/story/StoryCommunity', () => ({ StoryCommunity: () => null }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function view(authenticated, chapters) {
  mocks.authenticated = authenticated;
  mocks.apiRequest.mockResolvedValue({
    story: {
      id: 'story',
      title: 'Truyện mới phát hành thông tin',
      author: 'Tác giả',
      genres: ['Kỳ ảo'],
      chapters: chapters.length,
      ratings: 0,
      rating: '—',
      reads: 0,
      followers: 0,
      authorStats: { works: 1, followers: 0, reads: 0 },
      ratingBreakdown: [0, 0, 0, 0, 0],
      synopsis: 'Thông tin thật, chương được phát hành riêng.',
      status: 'ongoing',
      language: 'Tiếng Việt',
    },
    chapters,
  });
  return render(
    <MemoryRouter initialEntries={['/stories/story']}>
      <LocaleProvider>
        <Routes>
          <Route path="/stories/:storyId" element={<StoryDetailPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
}
it.each([false, true])(
  'disables empty preview routes for authenticated=%s without changing the story layout',
  async (authenticated) => {
    const result = view(authenticated, []);
    await screen.findByRole('heading', { name: 'Truyện mới phát hành thông tin' });
    expect(screen.getByRole('button', { name: 'Đọc thử', exact: true }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Nghe thử', exact: true }).disabled).toBe(true);
    expect(screen.getByText('Hiển thị 0–0 trong 0 chương')).toBeTruthy();
    expect(screen.queryByText('Đọc thử miễn phí')).toBeNull();
    expect(result.container.querySelector('a[href*="undefined"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Truyện âm thanh liên quan' }));
    expect(
      screen
        .getAllByRole('button', { name: 'Nghe thử', exact: true })
        .every((button) => button.disabled),
    ).toBe(true);
    expect(result.container.querySelector('a[href*="undefined"]')).toBeNull();
  },
);
it.each([false, true])(
  'retains the real first chapter destination for authenticated=%s',
  async (authenticated) => {
    view(authenticated, [
      { id: 'chapter-one', title: 'Chương đã phát hành', orderKey: 1, locked: false },
    ]);
    await screen.findByRole('heading', { name: 'Truyện mới phát hành thông tin' });
    const expected = authenticated
      ? '/read/story/chapter-one'
      : '/stories/story/preview/chapter-one';
    expect(
      screen
        .getAllByRole('link', { name: 'Đọc thử', exact: true })
        .every((link) => link.getAttribute('href') === expected),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Nghe thử', exact: true }).getAttribute('href')).toBe(
      '/listen/story/chapter-one',
    );
  },
);
