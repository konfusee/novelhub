import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { MediaLibraryPage } from '../../../src/pages/author/MediaLibraryPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
const asset = {
  id: 'abc',
  version: 3,
  name: 'Ảnh lưu thật.webp',
  width: 80,
  height: 120,
  kind: 'cover',
  sizeBytes: 512,
  contentType: 'image/webp',
  createdAt: '2026-10-16T00:00:00Z',
  url: '/author/media/abc/content',
  storyId: 'story',
};
const data = {
  items: [asset],
  stories: [{ id: 'story', title: 'Truyện của tôi' }],
  stats: { bytes: 512, count: 1 },
  nextCursor: null,
};
const view = (entry = '/author/media') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocaleProvider>
        <MediaLibraryPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('shows server images, actual totals, MIME and date without mock quota or assets', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  fireEvent.click(await screen.findByRole('button', { name: `Xem chi tiết ${asset.name}` }));
  const detail = screen.getByRole('complementary', { name: 'Chi tiết tài nguyên' });
  expect(within(detail).getByText('image/webp')).toBeTruthy();
  expect(within(detail).getByText(new Date(asset.createdAt).toLocaleString('vi-VN'))).toBeTruthy();
  expect(within(detail).getByRole('img').src).toContain('/api/author/media/abc/content');
  expect(screen.queryByText(/GB/)).toBeNull();
  expect(screen.getByText('1 ảnh trong thư viện')).toBeTruthy();
  expect(screen.getByText('Đã tải 1 / 1 ảnh. Bộ lọc áp dụng cho các ảnh đã tải.')).toBeTruthy();
  expect(screen.getAllByText('512 B').length).toBeGreaterThan(0);
});
it('keeps failed deletion visible in the dialog and waits for server acceptance', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') throw new Error('Ảnh đang được sử dụng');
    return data;
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: `Xem chi tiết ${asset.name}` }));
  fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi thư viện' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa khỏi thư viện' }));
  expect(await within(dialog).findByRole('alert')).toHaveProperty(
    'textContent',
    'Ảnh đang được sử dụng',
  );
  expect(screen.getByRole('button', { name: `Xem chi tiết ${asset.name}` })).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/media/abc/delete', {
    method: 'POST',
    body: { expectedVersion: 3 },
  });
});
it('uploads the selected binary file, refreshes from server and rejects unsupported files locally', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) =>
    options?.method === 'POST' ? { asset } : data,
  );
  const { container } = view();
  await screen.findByRole('button', { name: `Xem chi tiết ${asset.name}` });
  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, {
    target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] },
  });
  expect(screen.getByRole('status').textContent).toContain('Chọn ảnh PNG');
  const file = new File(['image'], 'photo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('Ảnh đã được lưu trên máy chủ.');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/media?name=photo.png&kind=image', {
    method: 'POST',
    body: file,
    binary: true,
  });
});
it('loads subsequent server pages without losing earlier assets', async () => {
  mocks.apiRequest.mockImplementation(async (path) =>
    path.includes('?cursor=')
      ? { ...data, items: [{ ...asset, id: 'older', name: 'Ảnh cũ.webp' }] }
      : { ...data, stats: { bytes: 1024, count: 2 }, nextCursor: 'abc' },
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Tải thêm ảnh' }));
  await screen.findByRole('button', { name: 'Xem chi tiết Ảnh cũ.webp' });
  expect(screen.getByRole('button', { name: `Xem chi tiết ${asset.name}` })).toBeTruthy();
  expect(mocks.apiRequest.mock.calls.some(([path]) => path === '/author/media?cursor=abc')).toBe(
    true,
  );
});
it('renders API errors and empty state honestly without fallback assets', async () => {
  mocks.apiRequest
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ...data, items: [], stats: { bytes: 0, count: 0 } });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Thư viện media còn trống');
  await waitFor(() => expect(screen.getByText('0 B')).toBeTruthy());
  expect(screen.queryByRole('img')).toBeNull();
});
it('organizes exactly the filtered images and only changes their group after the server accepts', async () => {
  let saved = false;
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path === '/author/media/organize') {
      saved = true;
      return { changed: 1 };
    }
    return {
      ...data,
      items: [
        { ...asset, storyId: saved ? 'story' : null },
        { ...asset, id: 'other', name: 'Khác.webp', storyId: null },
      ],
    };
  });
  view();
  await screen.findByRole('button', { name: `Xem chi tiết ${asset.name}` });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm tài nguyên' }), {
    target: { value: 'Ảnh lưu thật' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp hàng loạt' }));
  const dialog = screen.getByRole('dialog', { name: 'Sắp xếp ảnh theo truyện' });
  expect(within(dialog).getByText(asset.name)).toBeTruthy();
  expect(within(dialog).queryByText('Khác.webp')).toBeNull();
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Truyện nhận ảnh' }));
  fireEvent.click(
    await within(dialog).findByRole('option', { name: 'Truyện của tôi', exact: true }),
  );
  expect(saved).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu sắp xếp' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/media/organize', {
    method: 'POST',
    body: { storyId: 'story', items: [{ id: 'abc', expectedVersion: 3 }] },
  });
  expect(await screen.findByText('Đã cập nhật nhóm cho 1 ảnh.')).toBeTruthy();
});
it('retains the organization dialog and destination on stale-server errors', async () => {
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path.endsWith('/organize')) throw new Error('Ảnh đã thay đổi');
    return data;
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Sắp xếp hàng loạt' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Truyện nhận ảnh' }));
  fireEvent.click(
    await within(dialog).findByRole('option', { name: 'Truyện của tôi', exact: true }),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu sắp xếp' }));
  expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'Ảnh đã thay đổi');
  expect(within(dialog).getByRole('combobox').textContent).toContain('Truyện của tôi');
});
it('preselects only an editable owner story from the manager link and sends that story on upload', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { asset } : data,
  );
  const { container } = view('/author/media?storyId=story');
  expect(
    await screen.findByText(
      'Ảnh tải mới được xếp vào truyện “Truyện của tôi”. Có thể đổi lựa chọn bên dưới.',
    ),
  ).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Sắp xếp theo truyện' }).textContent).toContain(
    'Truyện của tôi',
  );
  const file = new File(['image'], 'photo.png', { type: 'image/png' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  await screen.findByText('Ảnh đã được lưu trên máy chủ.');
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    '/author/media?name=photo.png&kind=image&storyId=story',
    { method: 'POST', body: file, binary: true },
  );
});
it('does not attach unknown story ids from a URL and allows overriding a valid preselection', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { asset } : data,
  );
  view('/author/media?storyId=foreign');
  await screen.findByText(
    'Truyện từ liên kết chưa sẵn sàng để nhận ảnh. Hãy chọn một truyện còn chỉnh sửa được trong tài khoản.',
  );
  expect(screen.getByRole('combobox', { name: 'Sắp xếp theo truyện' }).textContent).toContain(
    'Chưa gán truyện',
  );
  cleanup();
  const result = view('/author/media?storyId=story');
  await screen.findByRole('button', { name: `Xem chi tiết ${asset.name}` });
  fireEvent.click(screen.getByRole('combobox', { name: 'Sắp xếp theo truyện' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Chưa gán truyện', exact: true }));
  const file = new File(['image'], 'photo.png', { type: 'image/png' });
  fireEvent.change(result.container.querySelector('input[type="file"]'), {
    target: { files: [file] },
  });
  await screen.findByText('Ảnh đã được lưu trên máy chủ.');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/media?name=photo.png&kind=image', {
    method: 'POST',
    body: file,
    binary: true,
  });
});
