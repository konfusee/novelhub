import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../context/LocaleContext';
import { ChapterOrderDialog } from './ChapterOrderDialog';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
const chapters = [
  { id: 'one', title: 'Chương đầu', number: 1, version: 3 },
  { id: 'two', title: 'Chương sau', number: 2, version: 8 },
];
function view() {
  const callbacks = { onSaved: vi.fn(), onClose: vi.fn(), onReload: vi.fn() };
  render(
    <LocaleProvider>
      <ChapterOrderDialog story={{ id: 'owned', version: 7 }} chapters={chapters} {...callbacks} />
    </LocaleProvider>,
  );
  return callbacks;
}
const rows = () =>
  within(screen.getByRole('list', { name: 'Thứ tự chương dự kiến' }))
    .getAllByRole('listitem')
    .map((row) => row.textContent);
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('previews the complete order and saves the actual IDs and baseline versions only on confirmation', async () => {
  mocks.apiRequest.mockResolvedValue({});
  const callbacks = view();
  expect(screen.getByRole('button', { name: 'Lưu thứ tự', exact: true }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Đưa chương 2 lên: Chương sau' }));
  expect(rows()).toEqual(['1Chương sau', '2Chương đầu']);
  expect(mocks.apiRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự', exact: true }));
  await screen.findByRole('button', { name: 'Lưu thứ tự', exact: true });
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/reorder', {
    method: 'POST',
    body: {
      expectedVersion: 7,
      chapters: [
        { id: 'two', expectedVersion: 8 },
        { id: 'one', expectedVersion: 3 },
      ],
    },
  });
  expect(callbacks.onSaved).toHaveBeenCalledOnce();
});
it('retains staged order when persistence fails and allows a deliberate retry', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('MongoDB chưa phản hồi'));
  const callbacks = view();
  fireEvent.click(screen.getByRole('button', { name: 'Đưa chương 1 xuống: Chương đầu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toBe('MongoDB chưa phản hồi');
  expect(rows()).toEqual(['1Chương sau', '2Chương đầu']);
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Lưu thứ tự', exact: true }).disabled).toBe(false);
});
it('blocks stale writes and reloads only when the author chooses to discard the staged order', async () => {
  mocks.apiRequest.mockRejectedValue(
    Object.assign(new Error('Danh sách đã thay đổi'), { status: 409 }),
  );
  const callbacks = view();
  fireEvent.click(screen.getByRole('button', { name: 'Đưa chương 2 lên: Chương sau' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự', exact: true }));
  const reload = await screen.findByRole('button', { name: 'Bỏ thay đổi và tải lại' });
  expect(rows()).toEqual(['1Chương sau', '2Chương đầu']);
  expect(screen.getByRole('button', { name: 'Đưa chương 1 xuống: Chương sau' }).disabled).toBe(
    true,
  );
  expect(callbacks.onReload).not.toHaveBeenCalled();
  fireEvent.click(reload);
  expect(callbacks.onReload).toHaveBeenCalledOnce();
});
it('cancels the staged order without writing', () => {
  const callbacks = view();
  fireEvent.click(screen.getByRole('button', { name: 'Đưa chương 2 lên: Chương sau' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hủy', exact: true }));
  expect(callbacks.onClose).toHaveBeenCalledOnce();
  expect(mocks.apiRequest).not.toHaveBeenCalled();
});
