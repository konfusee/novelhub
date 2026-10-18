import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorBankDetails } from '../../../src/pages/author/AuthorBankDetails';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const view = () =>
  render(
    <LocaleProvider>
      <AuthorBankDetails />
    </LocaleProvider>,
  );
it('saves the displayed version and reloads actual bank data, retaining leading zeros', async () => {
  let data = { version: 2, bank: null };
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') data = { version: 4, bank: options.body.bank };
    return data;
  });
  view();
  fireEvent.change(await screen.findByLabelText('Tên ngân hàng'), {
    target: { value: 'Test bank' },
  });
  fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '00123456' } });
  fireEvent.change(screen.getByLabelText('Tên chủ tài khoản'), { target: { value: 'AUTHOR' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu ngân hàng' }));
  await screen.findByText('Đã lưu thông tin ngân hàng cho kỳ chi trả tiếp theo.');
  expect(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).toEqual({
    expectedVersion: 2,
    bank: { bankName: 'Test bank', accountNumber: '00123456', accountHolder: 'AUTHOR' },
  });
  await waitFor(() => expect(screen.getByLabelText('Số tài khoản').value).toBe('00123456'));
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await waitFor(() =>
    expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1),
  );
});
it('keeps save errors visible without announcing success', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method) throw new Error('Thông tin tài khoản đã thay đổi');
    return {
      version: 2,
      bank: { bankName: 'Bank', accountNumber: '001', accountHolder: 'AUTHOR' },
    };
  });
  view();
  await screen.findByLabelText('Tên ngân hàng');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu ngân hàng' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Thông tin tài khoản đã thay đổi',
  );
  expect(screen.queryByText('Đã lưu thông tin ngân hàng cho kỳ chi trả tiếp theo.')).toBeNull();
});
