import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { ChapterLifecycleDialog } from '../../../src/pages/author/ChapterLifecycleDialog';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
function view(action = 'archive') {
  const callbacks = { onClose: vi.fn(), onSaved: vi.fn(), onReload: vi.fn() };
  render(
    <LocaleProvider>
      <ChapterLifecycleDialog
        story={{ id: 'story', version: 8 }}
        chapter={{
          id: 'chapter',
          title: 'Chương được giữ lại',
          version: 3,
          reviseSource: { id: 'submission', version: 9 },
        }}
        action={action}
        {...callbacks}
      />
    </LocaleProvider>,
  );
  return callbacks;
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it.each(['archive', 'restore', 'delete'])(
  'only persists %s after confirmation with both captured versions',
  async (action) => {
    mocks.apiRequest.mockResolvedValue({});
    const callbacks = view(action);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
    await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce());
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/stories/story/chapters/chapter/lifecycle',
      {
        method: 'POST',
        body: { action, expectedVersion: 3, expectedStoryVersion: 8 },
      },
    );
  },
);
it('cancels without a write and prevents duplicate confirmation or closing during persistence', async () => {
  const callbacks = view();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy', exact: true }));
  expect(callbacks.onClose).toHaveBeenCalledOnce();
  expect(mocks.apiRequest).not.toHaveBeenCalled();
  mocks.apiRequest.mockReturnValue(new Promise(() => {}));
  const confirm = screen.getByRole('button', { name: 'Xác nhận', exact: true });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(mocks.apiRequest).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Hủy', exact: true }).disabled).toBe(true);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(callbacks.onClose).toHaveBeenCalledOnce();
});
it('keeps the dialog on errors and requires explicit refresh for a stale version', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('Mất kết nối'));
  const callbacks = view();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toBe('Mất kết nối');
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  mocks.apiRequest.mockRejectedValueOnce(
    Object.assign(new Error('Chương đã thay đổi'), { status: 409 }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  const reload = await screen.findByRole('button', { name: 'Tải lại trạng thái' });
  expect(screen.queryByRole('button', { name: 'Xác nhận', exact: true })).toBeNull();
  expect(callbacks.onReload).not.toHaveBeenCalled();
  fireEvent.click(reload);
  expect(callbacks.onReload).toHaveBeenCalledOnce();
});
it('confirms unpublishing with a clear preservation notice and the actual unpublished result', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter: { id: 'chapter', status: 'unpublished' } });
  const callbacks = view('unpublish');
  expect(screen.getByText(/không hoàn xu hay thay đổi quyền đọc đã mua/)).toBeTruthy();
  expect(mocks.apiRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce());
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    '/author/stories/story/chapters/chapter/lifecycle',
    { method: 'POST', body: { action: 'unpublish', expectedVersion: 3, expectedStoryVersion: 8 } },
  );
});
it('does not claim unpublishing when the server returns an unexpected state', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter: { id: 'chapter', status: 'published' } });
  const callbacks = view('unpublish');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await screen.findByRole('alert');
  expect(callbacks.onSaved).not.toHaveBeenCalled();
});
it('creates an unpublished correction from the exact server submission version after confirmation', async () => {
  const revision = {
    id: 'fresh',
    storyId: 'story',
    chapterId: 'chapter',
    formatVersion: 'blocks-v3',
  };
  mocks.apiRequest.mockResolvedValue({ revision });
  const callbacks = view('reviseUnpublished');
  expect(mocks.apiRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledWith({ revision }));
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions/submission/revise', {
    method: 'POST',
    body: { expectedVersion: 9 },
  });
});
it('retains a correction error when the returned revision belongs to another chapter', async () => {
  mocks.apiRequest.mockResolvedValue({
    revision: { id: 'fresh', storyId: 'story', chapterId: 'other' },
  });
  const callbacks = view('reviseUnpublished');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await screen.findByRole('alert');
  expect(callbacks.onSaved).not.toHaveBeenCalled();
});
