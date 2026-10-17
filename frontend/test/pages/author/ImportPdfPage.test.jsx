import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { ImportPdfPage } from '../../../src/pages/author/ImportPdfPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
const text = 'Đoạn đầu tiên.\n\nĐoạn tiếp theo.';
function view({ saveError = false, previewText = text, headings, numberedHeadings } = {}) {
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path === '/author/imports/targets')
      return { items: [{ id: 'real-story', title: 'Truyện từ MongoDB', version: 3 }] };
    if (path.startsWith('/author/imports/preview'))
      return {
        text: previewText,
        format: 'md',
        receipt: 'signed-receipt',
        headings,
        numberedHeadings,
      };
    if (saveError) throw new Error('Không lưu được MongoDB');
    return { storyId: 'real-story', chapterIds: ['chapter-one', 'chapter-two'] };
  });
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <ImportPdfPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
}
async function choose(container) {
  const file = new File(['# Văn bản'], 'ban-thao.md', { type: 'text/markdown' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  await screen.findByRole('textbox', { name: 'ban-thao' });
  return file;
}
async function destination() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Truyện nhận bản nháp' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Truyện từ MongoDB' }));
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('keeps extracted code examples intact when the server marks no numbered chapter titles', async () => {
  const source = 'Chương 1\nVí dụ mã đầu.\nChương 2\nVí dụ mã sau.';
  const { container } = view({ previewText: source, headings: [], numberedHeadings: [] });
  await choose(container);
  fireEvent.click(screen.getByRole('button', { name: 'Gợi ý tách theo tiêu đề' }));
  expect(screen.getAllByRole('textbox', { name: /Tiêu đề chương/ })).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'ban-thao' }).value).toBe(source);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(mocks.apiRequest.mock.calls.some(([path]) => path === '/author/imports')).toBe(false);
});
it('reviews Markdown headings explicitly and persists all sections through the existing API', async () => {
  const source =
    'Tên sách\n\nLời tựa của tác giả.\n\nMở đầu\n\nNội dung thứ nhất.\nCảnh nhỏ\nChi tiết.\nKết thúc\n\nNội dung thứ hai.';
  const { container } = view({
    previewText: source,
    headings: [
      { level: 1, title: 'Tên sách' },
      { level: 2, title: 'Mở đầu' },
      { level: 3, title: 'Cảnh nhỏ' },
      { level: 2, title: 'Kết thúc' },
    ],
  });
  await choose(container);
  fireEvent.click(screen.getByRole('button', { name: 'Gợi ý tách theo tiêu đề' }));
  expect(
    screen.getAllByRole('textbox', { name: /Tiêu đề chương/ }).map((input) => input.value),
  ).toEqual(['Phần mở đầu', 'Mở đầu', 'Kết thúc']);
  expect(mocks.apiRequest.mock.calls.some(([path]) => path === '/author/imports')).toBe(false);
  await destination();
  fireEvent.click(screen.getByRole('button', { name: 'Nhập thành bản nháp' }));
  await screen.findByText(/Đã lưu .* chương nháp/);
  const body = mocks.apiRequest.mock.calls.find(([path]) => path === '/author/imports')[1].body;
  expect(body.receipt).toBe('signed-receipt');
  expect(body.chapters.map((chapter) => chapter.title)).toEqual([
    'Phần mở đầu',
    'Mở đầu',
    'Kết thúc',
  ]);
  expect(
    body.chapters
      .flatMap((chapter) => chapter.paragraphs)
      .join('')
      .replace(/\s/g, ''),
  ).toBe(source.replace(/\s/g, ''));
});
it('imports a long paragraph with its complete emoji instead of two broken surrogate halves', async () => {
  const source = 'a'.repeat(19999) + '🌸 Kết thúc.';
  const { container } = view({ previewText: source });
  await choose(container);
  await destination();
  fireEvent.click(screen.getByRole('button', { name: 'Nhập thành bản nháp' }));
  await screen.findByText(/Đã lưu .* chương nháp/);
  const paragraphs = mocks.apiRequest.mock.calls.find(([path]) => path === '/author/imports')[1]
    .body.chapters[0].paragraphs;
  expect(paragraphs.join('')).toBe(source);
  expect(
    paragraphs.every((paragraph) => paragraph.length <= 20000 && paragraph.isWellFormed()),
  ).toBe(true);
});
it('explains paragraph limits without posting or discarding reviewed text', async () => {
  const source = Array(1001).fill('Đoạn').join('\n\n');
  const { container } = view({ previewText: source });
  await choose(container);
  await destination();
  fireEvent.click(screen.getByRole('button', { name: 'Nhập thành bản nháp' }));
  expect((await screen.findByRole('alert')).textContent).toContain('tối đa 1.000 đoạn');
  expect(screen.getByRole('textbox', { name: 'ban-thao' }).value).toBe(source);
  expect(mocks.apiRequest.mock.calls.some(([path]) => path === '/author/imports')).toBe(false);
});
it('suggests chapters from current edits only after an explicit action and keeps the preamble', async () => {
  const source =
    'Lời tựa của tác giả.\n\nChương 1: Mở đầu\nNội dung thứ nhất.\n\nChương 2: Tiếp theo\nNội dung thứ hai.';
  const { container } = view({ previewText: source });
  await choose(container);
  expect(screen.getAllByRole('textbox', { name: /Tiêu đề chương/ })).toHaveLength(1);
  const edited = source + '\nĐoạn tác giả vừa sửa.';
  fireEvent.change(screen.getByRole('textbox', { name: 'ban-thao' }), {
    target: { value: edited },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gợi ý tách theo tiêu đề' }));
  expect(
    screen.getAllByRole('textbox', { name: /Tiêu đề chương/ }).map((input) => input.value),
  ).toEqual(['Phần mở đầu', 'Chương 1: Mở đầu', 'Chương 2: Tiếp theo']);
  await destination();
  fireEvent.click(screen.getByRole('button', { name: 'Nhập thành bản nháp' }));
  await screen.findByText(/Đã lưu .* chương nháp/);
  const body = mocks.apiRequest.mock.calls.find(([path]) => path === '/author/imports')[1].body;
  expect(body.chapters).toHaveLength(3);
  expect(
    body.chapters
      .flatMap((chapter) => chapter.paragraphs)
      .join('')
      .replace(/\s/g, ''),
  ).toBe(edited.replace(/\s/g, ''));
});
it('keeps the reviewed text intact when chapter headings are ambiguous', async () => {
  const { container } = view();
  await choose(container);
  fireEvent.click(screen.getByRole('button', { name: 'Gợi ý tách theo tiêu đề' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Nội dung được giữ nguyên');
  expect(screen.getByRole('textbox', { name: 'ban-thao' }).value).toBe(text);
  expect(screen.getAllByRole('textbox', { name: /Tiêu đề chương/ })).toHaveLength(1);
});
it('uploads the actual file, reviews real text and waits for persistence before reporting success', async () => {
  const { container } = view();
  expect(screen.queryByText(/Chronicles/)).toBeNull();
  const file = await choose(container);
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    '/author/imports/preview?format=md',
    expect.objectContaining({ body: file, binary: true, method: 'POST' }),
  );
  expect(screen.getByRole('textbox', { name: 'ban-thao' }).value).toBe(text);
  const editor = screen.getByRole('textbox', { name: 'ban-thao' });
  editor.setSelectionRange(16, 16);
  fireEvent.select(editor);
  fireEvent.click(screen.getByRole('button', { name: 'Tách tại con trỏ' }));
  const titles = screen.getAllByRole('textbox', { name: /Tiêu đề chương/ });
  expect(titles).toHaveLength(2);
  await destination();
  fireEvent.click(screen.getByRole('button', { name: 'Nhập thành bản nháp' }));
  expect(await screen.findByText('Đã lưu 2 chương nháp')).toBeTruthy();
  const body = mocks.apiRequest.mock.calls.find(([path]) => path === '/author/imports')[1].body;
  expect(body).toMatchObject({
    receipt: 'signed-receipt',
    storyId: 'real-story',
    expectedVersion: 3,
  });
  expect(body.chapters.map((chapter) => chapter.paragraphs.join('')).join('')).toBe(
    text.replace(/\n/g, ''),
  );
});
it('retains edited content and never shows success when saving fails', async () => {
  const { container } = view({ saveError: true });
  await choose(container);
  await destination();
  fireEvent.change(screen.getByRole('textbox', { name: 'ban-thao' }), {
    target: { value: 'Tác giả đã sửa.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Nhập thành bản nháp' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Không lưu được MongoDB');
  expect(screen.getByRole('textbox', { name: 'ban-thao' }).value).toBe('Tác giả đã sửa.');
  expect(screen.queryByText(/Đã lưu .* chương nháp/)).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Nhập thành bản nháp' }).disabled).toBe(false),
  );
});
it('merges actual text without fabricated words and rejects unsupported files before uploading', async () => {
  const { container } = view();
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['bad'], 'image.png')] },
  });
  expect((await screen.findByRole('alert')).textContent).toContain('PDF, DOC, DOCX, TXT hoặc MD');
  expect(mocks.apiRequest.mock.calls.some(([path]) => path.includes('/preview'))).toBe(false);
  await choose(container);
  const editor = screen.getByRole('textbox', { name: 'ban-thao' });
  editor.setSelectionRange(16, 16);
  fireEvent.select(editor);
  fireEvent.click(screen.getByRole('button', { name: 'Tách tại con trỏ' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Gộp chương tiếp' })[0]);
  expect(screen.getAllByRole('textbox', { name: /Tiêu đề chương/ })).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'ban-thao' }).value.replace(/\s/g, '')).toBe(
    text.replace(/\s/g, ''),
  );
});
