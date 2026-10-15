import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { AuthorWorksPage } from './AuthorWorksPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ AuthorLayout: ({ children }) => <main>{children}</main> }));
const story = {
  id: 'owned',
  title: 'Truyện trong MongoDB',
  description: 'Nội dung thật',
  status: 'published',
};
const view = (editor = false) =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorWorksPage editor={editor} />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('opens the selected owner chapter using its exact database ID', async () => {
  mocks.apiRequest.mockImplementation(async (path) =>
    path.endsWith('/workspace')
      ? {
          chapters: [
            { id: 'chapter-thirteen', number: 13, title: 'Chương mười ba', status: 'draft' },
          ],
        }
      : { items: [story] },
  );
  view(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn chương' }));
  expect((await screen.findByRole('link', { name: 'Soạn chương' })).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/chapter-thirteen/edit',
  );
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    '/author/stories/owned/workspace',
    expect.any(Object),
  );
});
it('filters the actual owner list without substituting demo works', async () => {
  mocks.apiRequest.mockResolvedValue({ items: [story] });
  view();
  expect((await screen.findByRole('link', { name: 'Quản lý truyện' })).getAttribute('href')).toBe(
    '/author/stories/owned',
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm truyện của tôi' }), {
    target: { value: 'không tồn tại' },
  });
  expect(screen.getByText('Không tìm thấy truyện phù hợp')).toBeTruthy();
  expect(screen.queryByText('The Silent Forest')).toBeNull();
});
