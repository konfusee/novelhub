import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { UsersManagementPage } from '../../../src/pages/admin/UsersManagementPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
vi.mock('../../../src/components/admin/AuthorApplications', () => ({
  AuthorApplications: () => null,
}));
vi.mock('../../../src/components/admin/AuthorRoleManagement', () => ({
  AuthorRoleManagement: () => null,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const author = {
  id: 'author',
  name: 'Tác giả từ MongoDB',
  roles: ['author'],
  status: 'active',
  createdAt: '2026-10-01T00:00:00Z',
  storyCount: 2,
  readerBalance: 13,
};
const feed = {
  items: [author],
  total: 12,
  summary: { accounts: 12, authors: 1, readers: 10, moderators: 0, admins: 1 },
};
function view() {
  render(
    <LocaleProvider>
      <UsersManagementPage />
    </LocaleProvider>,
  );
}
it('renders actual counts and values without legacy accounts or fake action success', async () => {
  mocks.apiRequest.mockResolvedValue(feed);
  view();
  await screen.findByText(author.name);
  expect(screen.getByText('12 tài khoản · 1 tác giả · 1 nhân viên/kiểm duyệt viên')).toBeTruthy();
  expect(screen.queryByText('Elena Rostova')).toBeNull();
  expect(screen.getByText('13 xu')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xuất danh bạ' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Mời nhân viên' }).disabled).toBe(true);
});
it('requests server-side search and pagination', async () => {
  mocks.apiRequest.mockResolvedValue(feed);
  view();
  await screen.findByText(author.name);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.some(([path]) => path.includes('page=2'))).toBe(true),
  );
  fireEvent.change(screen.getByLabelText('Tìm tên, email hoặc mã tài khoản'), {
    target: { value: 'Linh' },
  });
  await waitFor(() =>
    expect(
      mocks.apiRequest.mock.calls.some(
        ([path]) => path.includes('query=Linh') && path.includes('page=1'),
      ),
    ).toBe(true),
  );
});
it('loads actual account details without invented finance, stories or audit', async () => {
  mocks.apiRequest.mockImplementation(async (path) =>
    path.endsWith('/author')
      ? {
          account: { id: 'author', email: 'author@example.test', createdAt: author.createdAt },
          wallets: [
            { purpose: 'reader-coins', balance: 13 },
            { purpose: 'author-earnings', balance: 99 },
          ],
          stories: [{ id: 'story', title: 'Tác phẩm thực tế' }],
          audit: [
            {
              id: 'audit',
              action: 'account.actual-event',
              result: 'accepted',
              occurredAt: author.createdAt,
            },
          ],
        }
      : feed,
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Kiểm tra' }));
  await screen.findByText('author@example.test');
  expect(screen.getByText('99 xu')).toBeTruthy();
  expect(screen.getByText('Tác phẩm thực tế')).toBeTruthy();
  expect(screen.getByText('account.actual-event')).toBeTruthy();
  expect(screen.queryByText(/Stripe/)).toBeNull();
  expect(screen.queryByText('The Silent Forest')).toBeNull();
  expect(screen.getByRole('button', { name: 'Điều chỉnh xu' }).disabled).toBe(true);
});
it('shows recoverable list errors without falling back to samples', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('Không kết nối được.')).mockResolvedValue(feed);
  view();
  await screen.findByText('Không tải được dữ liệu tài khoản');
  expect(screen.queryByText('Mira Lane')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
  await screen.findByText(author.name);
});
