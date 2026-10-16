import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { ChapterEditorPage } from '../../../src/pages/author/ChapterEditorPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
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
it('keeps unsupported formatting unavailable without inserting rejected Markdown or HTML', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter });
  view();
  const body = await screen.findByRole('textbox', { name: 'Nội dung chương' });
  const original = body.value;
  for (const name of [
    'In đậm',
    'In nghiêng',
    'Gạch chân',
    'Tiêu đề 2',
    'Tiêu đề 3',
    'Trích dẫn',
    'Hình ảnh',
  ]) {
    const button = screen.getByRole('button', { name, exact: true });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('editor-format-support');
    fireEvent.click(button);
  }
  expect(body.value).toBe(original);
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true);
  expect(screen.getByText(/Hiện lưu dưới dạng văn bản thuần/)).toBeTruthy();
});
it('retains supported scene, dialogue and mention edits and persists them as plain paragraphs', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: 10 } } : { chapter },
  );
  view();
  const body = await screen.findByRole('textbox', { name: 'Nội dung chương' });
  fireEvent.change(body, { target: { value: 'Lời thoại' } });
  body.setSelectionRange(0, body.value.length);
  fireEvent.click(screen.getByRole('button', { name: 'Hội thoại', exact: true }));
  expect(body.value).toBe('“Lời thoại”');
  body.setSelectionRange(body.value.length, body.value.length);
  fireEvent.click(screen.getByRole('button', { name: 'Đường phân cách cảnh', exact: true }));
  expect(body.value).toContain('*     *     *');
  body.setSelectionRange(body.value.length, body.value.length);
  fireEvent.click(screen.getByRole('button', { name: 'Đề cập', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: {
        title: 'Chương thật',
        paragraphs: ['“Lời thoại”', '*     *     *', '@'],
        expectedVersion: 9,
      },
    }),
  );
});
it('saves edits beyond 20,000 characters without breaking an emoji', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: 10 } } : { chapter },
  );
  view();
  const text = 'a'.repeat(19999) + '🌸' + 'Nội dung vừa sửa.';
  fireEvent.change(await screen.findByRole('textbox', { name: 'Nội dung chương' }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true),
  );
  const paragraphs = mocks.apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1]
    .body.paragraphs;
  expect(paragraphs.join('')).toBe(text);
  expect(
    paragraphs.every((paragraph) => paragraph.length <= 20000 && paragraph.isWellFormed()),
  ).toBe(true);
});
it('keeps an oversized paragraph count editable and explains how to resolve it before saving', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter });
  view();
  const editor = await screen.findByRole('textbox', { name: 'Nội dung chương' });
  const text = Array(1001).fill('Đoạn').join('\n\n');
  fireEvent.change(editor, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain('tối đa 1.000 đoạn');
  expect(editor.value).toBe(text);
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});
it('explains unsupported content without opening a truncated editable body', async () => {
  mocks.apiRequest.mockRejectedValue(
    Object.assign(new Error('Unsupported'), { code: 'unsupported_editor_format', status: 409 }),
  );
  view();
  await screen.findByText(/Định dạng của bản nội dung này chưa được trình soạn hiện tại hỗ trợ/);
  expect(screen.queryByRole('textbox', { name: 'Nội dung chương' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Về trang quản lý truyện' }).getAttribute('href')).toBe(
    '/author/stories/owned',
  );
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
it('merges a stale draft explicitly and saves only on a separate action against the fetched version', async () => {
  let reads = 0;
  let writes = 0;
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      if (++writes === 1)
        throw Object.assign(new Error('Chương đã thay đổi'), {
          status: 409,
          code: 'stale_content',
        });
      return { chapter: { version: 14 } };
    }
    return {
      chapter:
        ++reads === 1 ? chapter : { ...chapter, version: 13, paragraphs: ['Bản mới ở thẻ khác.'] },
    };
  });
  view();
  const body = await screen.findByRole('textbox', { name: 'Nội dung chương' });
  fireEvent.change(body, { target: { value: 'Bản chưa lưu.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  await screen.findByRole('button', { name: 'So sánh với bản mới' });
  expect(body.value).toBe('Bản chưa lưu.');
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Gửi chương', exact: true }).disabled).toBe(true);
  fireEvent.keyDown(body, { key: 's', ctrlKey: true });
  expect(writes).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'So sánh với bản mới' }));
  await screen.findByRole('textbox', { name: 'Nội dung đã lưu' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Nội dung sau khi gộp' }), {
    target: { value: 'Bản mới ở thẻ khác.\n\nBản chưa lưu.' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }));
  expect(writes).toBe(1);
  expect(body.value).toBe('Bản mới ở thẻ khác.\n\nBản chưa lưu.');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
  await waitFor(() => expect(writes).toBe(2));
  expect(mocks.apiRequest).toHaveBeenLastCalledWith('/author/stories/owned/chapters/seven', {
    method: 'PUT',
    body: {
      title: 'Chương thật',
      paragraphs: ['Bản mới ở thẻ khác.', 'Bản chưa lưu.'],
      expectedVersion: 13,
    },
  });
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
