import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { DraftsPage } from './DraftsPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ AuthorLayout: ({ children }) => <main>{children}</main> }));
const draft = {
  id: 'seven',
  storyId: 'owned',
  title: 'Bản thảo trong DB',
  story: 'Truyện của tôi',
  words: 3,
  excerpt: 'Một hai ba',
  updatedAt: '2026-10-15T00:00:00Z',
  version: 4,
  order: 0,
  type: 'Chapter Draft',
  meta: 'Stored',
  tone: 'green',
};
const data = {
  items: [draft],
  stories: [{ id: 'owned', title: 'Truyện của tôi' }],
  history: [
    {
      id: 'rev4',
      storyId: 'owned',
      chapterId: 'seven',
      title: 'Bản thảo trong DB',
      number: 4,
      createdAt: '2026-10-15T00:00:00Z',
    },
  ],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <DraftsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('loads real draft metrics and history with exact editor links', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  expect(
    (await screen.findByRole('link', { name: 'Tiếp tục chỉnh sửa', exact: true })).getAttribute(
      'href',
    ),
  ).toBe('/author/stories/owned/chapters/seven/edit');
  expect(screen.getByText('3 từ')).toBeTruthy();
  expect(screen.getByText('Phiên bản 4')).toBeTruthy();
  expect(screen.queryByText('14,2 MB / 500 MB')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Khôi phục bản lưu' })).toBeNull();
});
it('creates a chapter in the selected owned story and reloads persisted drafts', async () => {
  let created = false;
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      created = true;
      return { chapter: { id: 'new' } };
    }
    return created
      ? { ...data, items: [...data.items, { ...draft, id: 'new', title: 'Bản mới' }] }
      : data;
  });
  view();
  await screen.findByText('3 từ');
  fireEvent.click(screen.getByRole('button', { name: 'Bản nháp mới', exact: true }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Truyện của bạn' }));
  fireEvent.click(screen.getByRole('option', { name: 'Truyện của tôi', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên bản nháp' }), {
    target: { value: 'Bản mới' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Bản mới', exact: true })).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters', {
    method: 'POST',
    body: { title: 'Bản mới', paragraphs: [''] },
  });
});
it('copies complete server paragraphs instead of the card excerpt and rejects stale source versions', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) =>
    options?.method === 'POST'
      ? { chapter: { id: 'copy' } }
      : path === '/author/drafts'
        ? data
        : {
            chapter: {
              title: draft.title,
              version: 4,
              canEdit: true,
              paragraphs: ['Nội dung đầy đủ khác với trích đoạn.'],
            },
          },
  );
  view();
  fireEvent.click(
    await screen.findByRole('button', { name: `Nhân bản ${draft.title}`, exact: true }),
  );
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters', {
      method: 'POST',
      body: {
        title: 'Bản thảo trong DB (bản sao)',
        paragraphs: ['Nội dung đầy đủ khác với trích đoạn.'],
      },
    }),
  );
  cleanup();
  mocks.apiRequest.mockClear();
  mocks.apiRequest.mockImplementation(async (path) =>
    path === '/author/drafts' ? data : { chapter: { version: 5, canEdit: true } },
  );
  view();
  fireEvent.click(
    await screen.findByRole('button', { name: `Nhân bản ${draft.title}`, exact: true }),
  );
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Bản nháp đã thay đổi hoặc bị khóa. Hãy tải lại trước khi nhân bản.',
  );
  expect(mocks.apiRequest.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
});
