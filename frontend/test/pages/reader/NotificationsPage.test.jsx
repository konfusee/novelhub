import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { NotificationsPage } from '../../../src/pages/reader/NotificationsPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  ReaderLayout: ({ children }) => <main>{children}</main>,
}));
const notification = {
  id: 'mongo-notification',
  title: 'Thông báo lưu trong MongoDB',
  body: 'Nội dung từ database',
  type: 'author',
  label: 'Tác giả',
  unread: true,
  href: '/author/apply',
  action: 'Xem kết quả',
  createdAt: '2026-10-15T00:00:00Z',
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <NotificationsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('notifications from MongoDB', () => {
  it('marks, deletes and restores by calling the API and reloading server state', async () => {
    let read = false;
    let deleted = false;
    mocks.apiRequest.mockImplementation((path, options) => {
      if (!options?.method)
        return Promise.resolve({
          items: deleted ? [] : [{ ...notification, unread: !read }],
          hasMore: false,
          unreadCount: read || deleted ? 0 : 1,
        });
      if (options.method === 'PUT') read = options.body.read;
      if (options.method === 'DELETE') deleted = true;
      if (path.endsWith('/restore')) deleted = false;
      return Promise.resolve({ ok: true });
    });
    view();
    expect(await screen.findByText(notification.body)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem kết quả' }).getAttribute('href')).toBe(
      '/author/apply',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }));
    await screen.findByRole('button', { name: 'Đánh dấu chưa đọc', exact: true });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: `Xóa thông báo: ${notification.title}` }).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: `Xóa thông báo: ${notification.title}` }));
    await waitFor(() => expect(screen.queryByText(notification.title)).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hoàn tác' }).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    expect(await screen.findByText(notification.title)).toBeTruthy();
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/reader/notifications/mongo-notification/restore',
      { method: 'POST', body: {} },
    );
  });
  it('retains unread state and displays the actual error if a write fails', async () => {
    mocks.apiRequest.mockImplementation((_path, options) =>
      options?.method
        ? Promise.reject(new Error('Không thể lưu thay đổi'))
        : Promise.resolve({ items: [notification], hasMore: false, unreadCount: 1 }),
    );
    view();
    await screen.findByText(notification.title);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true })).toBeTruthy();
  });
  it('loads older notifications through real pagination and stops when the API reports no more', async () => {
    mocks.apiRequest.mockImplementation((path) =>
      Promise.resolve(
        path.endsWith('page=2')
          ? {
              items: [{ ...notification, id: 'older', title: 'Thông báo cũ' }],
              hasMore: false,
              unreadCount: 2,
            }
          : { items: [notification], hasMore: true, unreadCount: 2 },
      ),
    );
    view();
    await screen.findByText(notification.title);
    fireEvent.click(screen.getByRole('button', { name: 'Tải thông báo trước đó' }));
    expect(await screen.findByText('Thông báo cũ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải thông báo trước đó' }).disabled).toBe(true);
    expect(screen.getByText(notification.title)).toBeTruthy();
  });
});
