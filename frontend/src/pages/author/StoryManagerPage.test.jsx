import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { StoryManagerPage } from './StoryManagerPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ AuthorLayout: ({ children }) => <main>{children}</main> }));
const workspace = {
  story: {
    id: 'owned',
    title: 'Truyện thuộc tài khoản',
    description: 'Tóm tắt được lưu thực tế và đủ dài để kiểm tra việc sửa thông tin.',
    genres: ['Kỳ ảo'],
    author: 'Tác giả thật',
    status: 'published',
    version: 7,
    canEdit: true,
  },
  chapters: [
    {
      id: 'seven',
      number: 7,
      title: 'Chương bảy thật',
      status: 'draft',
      words: 23,
      reads: 0,
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ],
  stats: { availableWords: 23, publishedChapters: 0, reads: 0, rating: '—', ratings: 0 },
};
const view = () =>
  render(
    <MemoryRouter initialEntries={['/author/stories/owned']}>
      <LocaleProvider>
        <Routes>
          <Route path="/author/stories/:storyId" element={<StoryManagerPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('confirms archive and restore using persisted versions without deleting the work', async () => {
  let archived = false;
  let version = 7;
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories') return { items: [] };
    if (options?.method === 'POST') {
      archived = options.body.action === 'archive';
      version++;
      return { story: { id: 'owned', status: archived ? 'archived' : 'draft', version } };
    }
    return {
      ...workspace,
      story: {
        ...workspace.story,
        status: archived ? 'archived' : 'draft',
        version,
        canEdit: !archived,
        canArchive: !archived,
        canRestore: archived,
      },
    };
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu trữ bản nháp', exact: true }));
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận', exact: true }));
  const restore = await screen.findByRole('button', { name: 'Khôi phục bản nháp', exact: true });
  expect(screen.getByRole('textbox', { name: 'Tên truyện' }).disabled).toBe(true);
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/lifecycle', {
    method: 'POST',
    body: { action: 'archive', expectedVersion: 7 },
  });
  fireEvent.click(restore);
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận', exact: true }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Tên truyện' }).disabled).toBe(false),
  );
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/lifecycle', {
    method: 'POST',
    body: { action: 'restore', expectedVersion: 8 },
  });
});
it('prevents archiving unsaved edits and retains the form when archive conflicts', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories') return { items: [] };
    if (options?.method === 'POST') throw new Error('Truyện đã thay đổi');
    return { ...workspace, story: { ...workspace.story, status: 'draft', canArchive: true } };
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
  const title = screen.getByRole('textbox', { name: 'Tên truyện' });
  fireEvent.change(title, { target: { value: 'Chưa lưu' } });
  expect(screen.getByRole('button', { name: 'Lưu trữ bản nháp', exact: true }).disabled).toBe(true);
  fireEvent.change(title, { target: { value: workspace.story.title } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ bản nháp', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận', exact: true }));
  await screen.findByText('Truyện đã thay đổi');
  expect(title.value).toBe(workspace.story.title);
  expect(screen.queryByRole('button', { name: 'Khôi phục bản nháp', exact: true })).toBeNull();
});
it('loads real categories and saves the selected IDs in the next draft revision', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories')
      return {
        items: [
          { id: 'fantasy', name: 'Kỳ ảo' },
          { id: 'mystery', name: 'Bí ẩn' },
        ],
      };
    if (options?.method === 'PUT')
      return { story: { ...workspace.story, categoryIds: options.body.categoryIds, version: 8 } };
    return { ...workspace, story: { ...workspace.story, categoryIds: ['fantasy'] } };
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
  const mystery = await screen.findByRole('checkbox', { name: 'Bí ẩn', exact: true });
  fireEvent.click(mystery);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Kỳ ảo', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
  await screen.findByText('Đã lưu thông tin truyện.');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned', {
    method: 'PUT',
    body: {
      title: workspace.story.title,
      description: workspace.story.description,
      expectedVersion: 7,
      categoryIds: ['mystery'],
    },
  });
});
it('reads owned chapters with exact IDs and saves versioned metadata from the existing form', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? {
          story: {
            ...workspace.story,
            title: options.body.title,
            description: options.body.description,
            version: 8,
          },
        }
      : workspace,
  );
  view();
  expect(await screen.findByText('Chương 7: Chương bảy thật')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Viết tiếp' }).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/seven/edit',
  );
  expect(screen.queryByText('184.200')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên truyện' }), {
    target: { value: 'Tên bản nháp mới' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
  expect(await screen.findByText('Đã lưu thông tin truyện.')).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tên bản nháp mới');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned', {
    method: 'PUT',
    body: {
      title: 'Tên bản nháp mới',
      description: workspace.story.description,
      expectedVersion: 7,
    },
  });
});
it('creates a real chapter draft and reloads the server list', async () => {
  let created = false;
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      created = true;
      return { chapter: { id: 'new-real' } };
    }
    return created
      ? {
          ...workspace,
          chapters: [
            ...workspace.chapters,
            {
              id: 'new-real',
              number: 8,
              title: 'Chương mới thật',
              status: 'draft',
              words: 0,
              reads: 0,
            },
          ],
        }
      : workspace;
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm chương mới' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên chương' }), {
    target: { value: 'Chương mới thật' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }));
  expect(await screen.findByText('Chương 8: Chương mới thật')).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters', {
    method: 'POST',
    body: { title: 'Chương mới thật', paragraphs: [''] },
  });
});
it('keeps unsaved metadata after a conflict and never claims a successful save', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') throw new Error('Phiên bản đã thay đổi');
    return workspace;
  });
  view();
  await screen.findByText('Chương 7: Chương bảy thật');
  fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên truyện' }), {
    target: { value: 'Chưa lưu' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));
  expect(await screen.findByText('Phiên bản đã thay đổi')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Tên truyện' }).value).toBe('Chưa lưu');
  expect(screen.queryByText('Đã lưu thông tin truyện.')).toBeNull();
});
it('shows an error instead of exposing a fallback story and disables creation for locked works', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  view();
  expect(await screen.findByText('Không tải được thông tin quản lý truyện')).toBeTruthy();
  expect(screen.queryByText('The Silent Forest')).toBeNull();
  mocks.apiRequest.mockResolvedValue({
    ...workspace,
    story: { ...workspace.story, canEdit: false },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Thêm chương mới' }).disabled).toBe(true),
  );
});
