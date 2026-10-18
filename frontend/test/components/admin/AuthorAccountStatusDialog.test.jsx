import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorAccountStatusDialog } from '../../../src/components/admin/AuthorAccountStatusDialog';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const account = { id: 'author-id', name: 'Tác giả thực', status: 'active', version: 3 };
function view(value = account) {
  const onChanged = vi.fn(),
    onClose = vi.fn();
  render(
    <LocaleProvider>
      <AuthorAccountStatusDialog account={value} onClose={onClose} onChanged={onChanged} />
    </LocaleProvider>,
  );
  return { onChanged, onClose };
}
it.each([
  ['active', 'suspend', 'suspended'],
  ['suspended', 'restore', 'active'],
])('confirms a reason and validates the %s transition', async (status, action, expected) => {
  api.mockResolvedValue({ account: { id: account.id, status: expected, version: 4 } });
  const callbacks = view({ ...account, status });
  const submit = screen.getByRole('button', {
    name: action === 'suspend' ? 'Khóa tài khoản Author' : 'Mở lại tài khoản Author',
  });
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: ' Lý do kiểm tra ' } });
  fireEvent.click(submit);
  await waitFor(() => expect(callbacks.onChanged).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith('/admin/accounts/author-id/status', {
    method: 'POST',
    body: { action, expectedVersion: 3, reason: 'Lý do kiểm tra' },
  });
});
it('keeps the reason and requires reload on an inconsistent response', async () => {
  api.mockResolvedValue({ account: { id: 'wrong-id', status: 'suspended', version: 4 } });
  const callbacks = view();
  fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Lý do giữ nguyên' } });
  fireEvent.click(screen.getByRole('button', { name: 'Khóa tài khoản Author' }));
  expect((await screen.findByRole('alert')).textContent).toContain('tải lại');
  expect(callbacks.onChanged).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Lý do').value).toBe('Lý do giữ nguyên');
  expect(screen.getByRole('button', { name: 'Khóa tài khoản Author' }).disabled).toBe(true);
});
it('requires explicit acknowledgement and a reason before closing permanently', async () => {
  api.mockResolvedValue({ account: { id: account.id, status: 'anonymized', version: 4 } });
  const onChanged = vi.fn();
  render(
    <LocaleProvider>
      <AuthorAccountStatusDialog
        account={account}
        closeAccount
        onClose={vi.fn()}
        onChanged={onChanged}
      />
    </LocaleProvider>,
  );
  const submit = screen.getByRole('button', { name: 'Đóng và ẩn danh tài khoản' });
  fireEvent.change(screen.getByLabelText('Lý do'), {
    target: { value: 'Theo yêu cầu người dùng' },
  });
  expect(submit.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(submit);
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith('/admin/accounts/author-id/status', {
    method: 'POST',
    body: { action: 'close', expectedVersion: 3, reason: 'Theo yêu cầu người dùng' },
  });
});
