import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { PersonalLibraryPage } from '../../../src/pages/reader/PersonalLibraryPage';
import { ReadingHistoryPage } from '../../../src/pages/reader/ReadingHistoryPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  ReaderLayout: ({ children }) => <main>{children}</main>,
}));
const item = {
  id: 'database-story',
  historyId: 'progress-id',
  title: 'Truyện trong MongoDB',
  author: 'Tác giả',
  genres: ['Kỳ ảo'],
  type: 'story',
  chapterId: 'database-chapter',
  progress: 65,
  status: 'reading',
  detail: 'Chương 7',
  activity: 'Hôm nay',
  when: '2026-10-15T00:00:00Z',
  duration: 'Chưa ghi nhận thời lượng',
  offline: false,
};
const stats = {
  activeStories: 1,
  monthCompleted: 0,
  weekly: { week: [0, 0, 0, 0, 0, 0, 0], last: [0, 0, 0, 0, 0, 0, 0] },
  genres: [{ name: 'Kỳ ảo', percent: 100 }],
  monthlyTarget: null,
};
const view = (Component) =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <Component />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('reader collections with real API records', () => {
  it('keeps the story visible when the server rejects removal', async () => {
    mocks.apiRequest.mockImplementation((_path, options) =>
      options?.method === 'PUT'
        ? Promise.reject(new Error('Không thể lưu thay đổi'))
        : Promise.resolve({ items: [item], activeThisWeek: 1 }),
    );
    view(PersonalLibraryPage);
    await screen.findAllByText(item.title);
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Xóa khỏi/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getAllByText(item.title).length).toBeGreaterThan(0);
  });
  it('keeps library cards and resume links and persists removal before refreshing', async () => {
    let removed = false;
    mocks.apiRequest.mockImplementation((path, options) => {
      if (options?.method === 'PUT') {
        removed = true;
        return Promise.resolve({ following: false });
      }
      return Promise.resolve({ items: removed ? [] : [item], activeThisWeek: removed ? 0 : 1 });
    });
    view(PersonalLibraryPage);
    expect((await screen.findAllByText(item.title)).length).toBeGreaterThan(0);
    expect(document.querySelector('a[href="/read/database-story/database-chapter"]')).toBeTruthy();
    expect(screen.queryByText('2.4 GB / 10 GB')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Xóa khỏi/ }));
    await waitFor(() => expect(screen.getByText('Thư viện của bạn đang trống')).toBeTruthy());
    expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/follows/database-story', {
      method: 'PUT',
      body: { following: false },
    });
  });
  it('uses real history counts and devices and clears through the server', async () => {
    let cleared = false;
    mocks.apiRequest.mockImplementation((path, options) => {
      if (path === '/auth/sessions')
        return Promise.resolve({
          items: [
            {
              id: 'session-id',
              current: true,
              client: { os: 'Windows', browser: 'Chrome', deviceType: 'desktop' },
              lastSeenAt: item.when,
            },
          ],
        });
      if (options?.method === 'DELETE') {
        cleared = true;
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ items: cleared ? [] : [item], stats });
    });
    view(ReadingHistoryPage);
    expect((await screen.findAllByText(item.title)).length).toBeGreaterThan(0);
    expect(screen.getByText('Windows · Chrome')).toBeTruthy();
    expect(screen.getByText('Lịch sử đọc · 1')).toBeTruthy();
    expect(document.querySelector('a[href="/read/database-story/database-chapter"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa lịch sử' }));
    const buttons = screen.getAllByRole('button', { name: 'Xóa lịch sử' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(screen.queryAllByText(item.title)).toHaveLength(0));
    expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/history', { method: 'DELETE' });
  });
});
