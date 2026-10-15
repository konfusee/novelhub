import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { FullChapterReaderPage } from './FullChapterReaderPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ ReaderLayout: ({ children }) => <main>{children}</main> }));
const chapters = [
  { id: 'mongo-chapter-a', orderKey: 7, title: 'Chương thứ bảy', locked: false },
  { id: 'mongo-chapter-b', orderKey: 13, title: 'Chương thứ mười ba', locked: false },
];
const view = (chapter = 'mongo-chapter-a') =>
  render(
    <MemoryRouter initialEntries={[`/read/mongo-story/${chapter}`]}>
      <LocaleProvider>
        <Routes>
          <Route path="/read/:storyId/:chapterId" element={<FullChapterReaderPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('novelhub.reader.settings.v2', JSON.stringify({ chapterMode: 'button' }));
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
  vi.stubGlobal('scrollTo', vi.fn());
  mocks.apiRequest.mockImplementation((path) => {
    if (path.includes('/progress/')) return Promise.resolve({ position: 0, revisionId: null });
    if (path.includes('/follows/')) return Promise.resolve({ following: false });
    if (path.includes('/chapters/'))
      return Promise.resolve({
        chapter: {
          title: 'Nội dung từ database',
          revisionId: 'real-revision',
          blocks: [
            {
              type: 'paragraph',
              text: path.endsWith('mongo-chapter-a')
                ? 'Văn bản chương bảy từ MongoDB.'
                : 'Văn bản chương mười ba từ MongoDB.',
            },
          ],
        },
      });
    return Promise.resolve({
      story: { id: 'mongo-story', title: 'Truyện thật', author: 'Tác giả thật' },
      chapters,
    });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('full reader uses persisted chapters while retaining its controls', () => {
  it('renders real prose and navigates to the next existing chapter even with gaps in numbering', async () => {
    view();
    expect(await screen.findByText('Văn bản chương bảy từ MongoDB.')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Chương 7: Chương thứ bảy' }),
    ).toBeTruthy();
    const next = screen.getByRole('link', { name: 'Chương sau' });
    expect(next.getAttribute('href')).toBe('/read/mongo-story/mongo-chapter-b');
    fireEvent.click(next);
    expect(await screen.findByText('Văn bản chương mười ba từ MongoDB.')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Chương 13: Chương thứ mười ba' }),
    ).toBeTruthy();
    expect(screen.queryByText(/148/)).toBeNull();
  });
  it('does not silently display chapter one for an unknown chapter', async () => {
    view('missing');
    expect(await screen.findByText('Không tìm thấy chương')).toBeTruthy();
    expect(mocks.apiRequest.mock.calls.some(([path]) => path.includes('/chapters/'))).toBe(false);
  });
  it('saves progress with the exact revision returned by the chapter API', async () => {
    view();
    await screen.findByText('Văn bản chương bảy từ MongoDB.');
    await waitFor(
      () =>
        expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/progress/mongo-chapter-a', {
          method: 'PUT',
          body: { position: expect.any(Number), revisionId: 'real-revision' },
        }),
      { timeout: 2500 },
    );
  });
});
