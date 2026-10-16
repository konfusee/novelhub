import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChapterSegment } from '../../../src/components/reader/ChapterSegment';
import { ChapterInlineText } from '../../../src/components/reader/ChapterInlineText';
import {
  PublishedChapterImage,
  PrivateChapterImage,
} from '../../../src/components/story/PrivateChapterImage';
import { LocaleProvider } from '../../../src/context/LocaleContext';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ API_BASE: '/api', apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const block = {
  type: 'image',
  mediaId: 'image',
  alt: 'Khu rừng đầy nắng',
  caption: 'Minh họa chương',
};
const target = { storyId: 'story', chapterId: 'chapter', revisionId: 'approved' };
function segment() {
  return render(
    <LocaleProvider>
      <ChapterSegment
        storyId="story"
        number={1}
        chapters={[{ id: 'chapter', title: 'Chương minh họa', orderKey: 1 }]}
        settings={{
          fontFamily: 'sans-serif',
          fontSize: 18,
          lineHeight: 1.8,
          paragraphGap: 22,
          align: 'left',
        }}
        renderParagraph={(_text, _index, _key, inlines) => <ChapterInlineText inlines={inlines} />}
      />
    </LocaleProvider>,
  );
}
it('keeps text formatting and image order in the existing reading canvas using the published revision URL', async () => {
  mocks.apiRequest.mockResolvedValue({
    chapter: {
      title: 'Chương minh họa',
      revisionId: 'approved',
      blocks: [
        { type: 'paragraph', inlines: [{ text: 'Văn bản đậm', marks: ['bold'] }] },
        block,
        { type: 'heading', level: 2, inlines: [{ text: 'Sau ảnh', marks: [] }] },
      ],
    },
  });
  segment();
  const img = await screen.findByRole('img', { name: block.alt });
  expect(img.getAttribute('src')).toBe(
    '/api/catalog/stories/story/chapters/chapter/revisions/approved/media/image',
  );
  expect(img.getAttribute('crossorigin')).toBe('use-credentials');
  expect(screen.getByText('Văn bản đậm').tagName).toBe('STRONG');
  expect(screen.getByRole('heading', { name: 'Sau ảnh' })).toBeTruthy();
  expect([...document.querySelector('article').children].map((node) => node.tagName)).toEqual([
    'P',
    'FIGURE',
    'H2',
  ]);
  expect(screen.getByText(block.caption)).toBeTruthy();
});
it('keeps unavailable images as a readable error without hiding the chapter prose', async () => {
  mocks.apiRequest.mockResolvedValue({
    chapter: {
      title: 'Chương minh họa',
      revisionId: 'approved',
      blocks: [
        { type: 'paragraph', inlines: [{ text: 'Văn bản còn đọc được', marks: [] }] },
        block,
      ],
    },
  });
  segment();
  fireEvent.error(await screen.findByRole('img', { name: block.alt }));
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('Ảnh chưa sẵn sàng hoặc không còn truy cập được.')).toBeTruthy();
  expect(screen.getByText('Văn bản còn đọc được')).toBeTruthy();
});
it('resets an image error for a different published revision without falling back to a private URL', () => {
  const view = render(
    <LocaleProvider>
      <PublishedChapterImage block={block} target={target} />
    </LocaleProvider>,
  );
  fireEvent.error(screen.getByRole('img'));
  view.rerender(
    <LocaleProvider>
      <PublishedChapterImage block={block} target={{ ...target, revisionId: 'new-approved' }} />
    </LocaleProvider>,
  );
  expect(screen.getByRole('img').getAttribute('src')).toContain(
    '/revisions/new-approved/media/image',
  );
  expect(screen.getByRole('img').getAttribute('src')).not.toContain('/author/');
});
it('preserves private draft and exact submission image URLs', () => {
  const view = render(
    <LocaleProvider>
      <PrivateChapterImage block={block} />
    </LocaleProvider>,
  );
  expect(screen.getByRole('img').getAttribute('src')).toBe('/api/author/media/image/content');
  view.rerender(
    <LocaleProvider>
      <PrivateChapterImage block={block} submissionId="submitted" />
    </LocaleProvider>,
  );
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    '/api/author/submissions/submitted/media/image/content',
  );
});
