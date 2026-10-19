import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { CreateStoryPage } from '../../../src/pages/author/CreateStoryPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { name: 'Tác giả đăng nhập' } }),
}));
const categories = { items: [{ id: 'real-category', name: 'Kỳ ảo trong DB' }] };
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <CreateStoryPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('creates a real private draft with the chosen category ID and links the confirmed story', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { story: { id: 'created-real' } } : categories,
  );
  view();
  expect(screen.queryByRole('button', { name: 'Gợi ý trau chuốt bằng AI' })).toBeNull();
  expect(screen.getByRole('textbox', { name: /Tên truyện/ }).value).toBe('');
  fireEvent.change(screen.getByRole('textbox', { name: /Tên truyện/ }), {
    target: { value: 'Truyện mới của tôi' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Kỳ ảo trong DB', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }));
  expect(
    (await screen.findByRole('link', { name: 'Quản lý truyện', exact: true })).getAttribute('href'),
  ).toBe('/author/stories/created-real');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories', {
    method: 'POST',
    body: { title: 'Truyện mới của tôi', description: '', categoryIds: ['real-category'] },
  });
  expect(screen.queryByText('The Whisper of Sunken Stars')).toBeNull();
  expect(screen.queryByText('Mira Lane')).toBeNull();
});
it('does not claim success when persistence fails and retains the entered fields', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') throw new Error('MongoDB tạm thời không phản hồi');
    return categories;
  });
  view();
  fireEvent.change(screen.getByRole('textbox', { name: /Tên truyện/ }), {
    target: { value: 'Bản còn đang viết' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Kỳ ảo trong DB', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'MongoDB tạm thời không phản hồi',
  );
  expect(screen.getByRole('textbox', { name: /Tên truyện/ }).value).toBe('Bản còn đang viết');
  expect(screen.queryByRole('link', { name: 'Quản lý truyện', exact: true })).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }).disabled).toBe(
      false,
    ),
  );
});
it('requires an active category before writing and disables unsupported persistence controls', async () => {
  mocks.apiRequest.mockResolvedValue(categories);
  view();
  await screen.findByRole('button', { name: 'Kỳ ảo trong DB', exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }));
  expect(mocks.apiRequest.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
  expect(screen.getByRole('button', { name: 'Tải ảnh bìa lên', exact: true }).disabled).toBe(true);
  expect(screen.getByRole('combobox', { name: 'Ngôn ngữ bản thảo gốc' }).textContent).toContain(
    'Tiếng Việt',
  );
});
