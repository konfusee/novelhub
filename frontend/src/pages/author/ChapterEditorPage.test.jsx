import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { ChapterEditorPage } from './ChapterEditorPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ AuthorLayout: ({ children }) => <main>{children}</main> }));
const chapter = {
  id: 'seven',
  storyId: 'owned',
  storyTitle: 'Truyện của tôi',
  number: 7,
  title: 'Chương thật',
  paragraphs: ['Đoạn được lưu trong MongoDB.'],
  version: 9,
  canEdit: true,
  canCreate: true,
  outline: [
    { id: 'seven', number: 7, title: 'Chương thật' },
    { id: 'thirteen', number: 13, title: 'Chương sau' },
  ],
};
function SubmissionDestination() {
  return <p>submission-destination{useLocation().search}</p>;
}
const view = () =>
  render(
    <MemoryRouter initialEntries={['/author/stories/owned/chapters/seven/edit']}>
      <LocaleProvider>
        <Routes>
          <Route path="/author/submissions" element={<SubmissionDestination />} />
          <Route
            path="/author/stories/:storyId/chapters/:chapterId/edit"
            element={<ChapterEditorPage />}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('saves dirty paragraphs before opening the exact chapter submission package', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: 10 } } : { chapter },
  );
  view();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Nội dung chương' }), {
    target: { value: 'Bản cần lưu trước khi gửi' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi chương', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu và kiểm tra gửi duyệt' }));
  await screen.findByText('submission-destination?storyId=owned&chapterId=seven');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
    method: 'PUT',
    body: { title: 'Chương thật', paragraphs: ['Bản cần lưu trước khi gửi'], expectedVersion: 9 },
  });
});
it('loads actual paragraphs and uses the next stored chapter ID, then saves successive versions', async () => {
  let version = 9;
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: ++version } } : { chapter },
  );
  view();
  const body = await screen.findByRole('textbox', { name: 'Nội dung chương' });
  expect(body.value).toBe(chapter.paragraphs[0]);
  expect(screen.getByRole('link', { name: /Tiếp tục đến Chương 13/ }).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/thirteen/edit',
  );
  fireEvent.change(body, { target: { value: 'Nội dung sửa.\n\nĐoạn thứ hai.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: {
        title: 'Chương thật',
        paragraphs: ['Nội dung sửa.', 'Đoạn thứ hai.'],
        expectedVersion: 9,
      },
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true),
  );
  fireEvent.change(body, { target: { value: 'Lần sửa kế tiếp.' } });
  fireEvent.keyDown(body, { key: 's', ctrlKey: true });
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: { title: 'Chương thật', paragraphs: ['Lần sửa kế tiếp.'], expectedVersion: 10 },
    }),
  );
});
it('retains unsaved text on a conflict instead of reporting a successful save', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') throw new Error('Phiên bản đã thay đổi');
    return { chapter };
  });
  view();
  const body = await screen.findByRole('textbox', { name: 'Nội dung chương' });
  fireEvent.change(body, { target: { value: 'Bản chưa được lưu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Phiên bản đã thay đổi');
  expect(body.value).toBe('Bản chưa được lưu');
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(false);
});
it('opens published chapters read-only and never fabricates a missing chapter', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter: { ...chapter, canEdit: false, canCreate: false } });
  view();
  expect((await screen.findByRole('textbox', { name: 'Nội dung chương' })).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true);
  cleanup();
  mocks.apiRequest.mockResolvedValue({ chapter: null });
  view();
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Nội dung chương' })).toBeNull(),
  );
  expect(await screen.findByRole('link', { name: 'Về trang quản lý truyện' })).toBeTruthy();
});
