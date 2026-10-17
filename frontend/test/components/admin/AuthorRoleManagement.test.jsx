import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import {
  AuthorRoleManagement,
  RevokeAuthorDialog,
} from '../../../src/components/admin/AuthorRoleManagement';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const role = {
  accountId: 'author',
  displayName: 'Tác giả thật',
  status: 'active',
  accountVersion: 8,
  role: { id: 'role', version: 3 },
};
const result = {
  accountId: 'author',
  roleId: 'role',
  status: 'revoked',
  frozenStories: 2,
  cancelledChapters: 3,
  cancelledSubmissions: 1,
};
function view() {
  const revoked = vi.fn();
  render(
    <LocaleProvider>
      <RevokeAuthorDialog accountId="author" onClose={vi.fn()} onRevoked={revoked} />
    </LocaleProvider>,
  );
  return revoked;
}
async function confirmFields() {
  await screen.findByText('Tác giả thật');
  fireEvent.change(screen.getByLabelText('Lý do thu hồi quyền (bắt buộc)'), {
    target: { value: '  Vi phạm điều khoản tác giả  ' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}
it('requires a reason and explicit acknowledgement, then sends exact prepared versions', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options.method === 'POST' ? result : role,
  );
  const revoked = view();
  await screen.findByText('Tác giả thật');
  expect(screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }).disabled).toBe(
    true,
  );
  expect(screen.getByText(/Truyện và chương đã công khai vẫn được giữ lại/)).toBeTruthy();
  await confirmFields();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }));
  await waitFor(() => expect(revoked).toHaveBeenCalledWith(result));
  expect(mocks.apiRequest).toHaveBeenCalledWith('/admin/authors/author/revoke', {
    method: 'POST',
    body: {
      roleId: 'role',
      expectedRoleVersion: 3,
      expectedAccountVersion: 8,
      reason: 'Vi phạm điều khoản tác giả',
    },
  });
});
it.each([401, 403, 409])(
  'requires reloading and fresh acknowledgement after status %s',
  async (status) => {
    mocks.apiRequest.mockImplementation(async (_path, options) => {
      if (options.method === 'POST')
        throw Object.assign(new Error('Quyền đã thay đổi.'), { status });
      return role;
    });
    const revoked = view();
    await confirmFields();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }));
    await screen.findByText('Quyền đã thay đổi.');
    expect(
      screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }).disabled,
    ).toBe(true);
    expect(screen.getByRole('checkbox').checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại quyền' }));
    await screen.findByText('Tác giả thật');
    expect(screen.getByLabelText('Lý do thu hồi quyền (bắt buộc)').value).toBe(
      '  Vi phạm điều khoản tác giả  ',
    );
    expect(screen.getByRole('checkbox').checked).toBe(false);
    expect(revoked).not.toHaveBeenCalled();
  },
);
it('disables confirmation when the server reports no active author assignment', async () => {
  mocks.apiRequest.mockResolvedValue({ ...role, role: null });
  view();
  await screen.findByText('Tài khoản không còn quyền tác giả có thể thu hồi.');
  expect(screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }).disabled).toBe(
    true,
  );
});
it.each([
  { ...result, accountId: 'other' },
  { ...result, status: 'active' },
  { ...result, cancelledChapters: -1 },
])('does not accept a malformed mutation response', async (response) => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options.method === 'POST' ? response : role,
  );
  const revoked = view();
  await confirmFields();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }));
  await screen.findByRole('alert');
  expect(revoked).not.toHaveBeenCalled();
});
it('loads and searches real authors, then refreshes the list after confirmed revocation', async () => {
  const changed = vi.fn();
  let removed = false;
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options.method === 'POST') {
      removed = true;
      return result;
    }
    if (path.endsWith('/role')) return role;
    return {
      items: removed
        ? []
        : [{ accountId: 'author', displayName: 'Tác giả thật', status: 'active' }],
      total: removed ? 0 : 1,
    };
  });
  render(
    <LocaleProvider>
      <AuthorRoleManagement onChanged={changed} />
    </LocaleProvider>,
  );
  await screen.findByText('Tác giả thật');
  fireEvent.change(screen.getByLabelText('Tìm tác giả theo tên hoặc email'), {
    target: { value: 'Linh' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm tác giả', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.some(([path]) => path.includes('query=Linh'))).toBe(true),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Thu hồi quyền Author', exact: true }));
  await screen.findByRole('heading', { name: 'Tác giả thật' });
  fireEvent.change(screen.getByLabelText('Lý do thu hồi quyền (bắt buộc)'), {
    target: { value: 'Lý do có thật' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi quyền', exact: true }));
  await screen.findByText(/Đã thu hồi quyền: đóng băng 2 truyện/);
  await screen.findByText('Không có tác giả phù hợp với bộ lọc.');
  expect(changed).toHaveBeenCalledTimes(1);
});
it('offers reload after a failed role preparation and never posts automatically', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('Mất kết nối.')).mockResolvedValue(role);
  view();
  await screen.findByText('Mất kết nối.');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại quyền' }));
  await screen.findByText('Tác giả thật');
  expect(mocks.apiRequest.mock.calls.every(([, options]) => options.method !== 'POST')).toBe(true);
});
