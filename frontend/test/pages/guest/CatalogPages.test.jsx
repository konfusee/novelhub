import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { SearchResultsPage } from '../../../src/pages/guest/SearchResultsPage';
import { StoryDetailPage } from '../../../src/pages/guest/StoryDetailPage';
import { GuestReaderPreviewPage } from '../../../src/pages/guest/GuestReaderPreviewPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/components/public/PublicHeader', () => ({
  PublicHeader: () => <header>Header</header>,
}));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));
vi.mock('../../../src/components/story/StoryCommunity', () => ({ StoryCommunity: () => null }));
const story = {
  id: 'mongo-story',
  title: 'Truyện từ MongoDB',
  author: 'Tác giả thật',
  description: 'Nội dung tìm thấy theo mô tả',
  synopsis: 'Nội dung tìm thấy theo mô tả',
  genres: ['Kỳ ảo'],
  genre: 'Kỳ ảo',
  format: 'Story',
  status: 'Ongoing',
  reads: '7',
  rating: '—',
  ratings: 0,
  followers: 0,
  chapters: 1,
  authorStats: { works: 1, followers: 0, reads: 7 },
  ratingBreakdown: [0, 0, 0, 0, 0],
};
const detail = {
  story,
  chapters: [{ id: 'mongo-chapter', title: 'Chương thật', orderKey: 7, locked: false }],
};
function view(path, route, Component) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>
        <Routes>
          <Route path={route} element={<Component />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('catalogue pages preserve their UI with API records', () => {
  it('keeps search results returned for description matches and uses real record links', async () => {
    mocks.apiRequest.mockImplementation((path) =>
      Promise.resolve(
        path === '/catalog/discovery'
          ? {
              categories: [],
              collections: { fantasy: [], romance: [], scifi: [], gems: [] },
              tags: [],
            }
          : { items: [story], total: 1 },
      ),
    );
    view('/search?q=mô+tả', '/search', SearchResultsPage);
    expect((await screen.findAllByText(story.title)).length).toBeGreaterThan(0);
    expect(document.querySelector('a[href="/stories/mongo-story"]')).toBeTruthy();
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/catalog/stories?pageSize=100&q=m%C3%B4%20t%E1%BA%A3',
      expect.any(Object),
    );
  });
  it('renders actual story metadata, zero ratings and actual chapter IDs', async () => {
    mocks.apiRequest.mockResolvedValue(detail);
    view('/stories/mongo-story', '/stories/:storyId', StoryDetailPage);
    expect(await screen.findByRole('heading', { level: 1, name: story.title })).toBeTruthy();
    expect(
      document.querySelector('a[href="/stories/mongo-story/preview/mongo-chapter"]'),
    ).toBeTruthy();
    expect(screen.queryByText('12,450')).toBeNull();
  });
  it('loads the selected MongoDB chapter without falling back to chapter one', async () => {
    mocks.apiRequest.mockImplementation((path) =>
      Promise.resolve(
        path.includes('/chapters/')
          ? {
              chapter: {
                id: 'mongo-chapter',
                title: 'Chương thật',
                blocks: [{ type: 'paragraph', text: 'Nội dung chương lưu trong MongoDB.' }],
              },
            }
          : detail,
      ),
    );
    view(
      '/stories/mongo-story/preview/mongo-chapter',
      '/stories/:storyId/preview/:chapterId',
      GuestReaderPreviewPage,
    );
    expect(await screen.findByText('Nội dung chương lưu trong MongoDB.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Chương 7: Chương thật' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chương trước' }).disabled).toBe(true);
  });
});
