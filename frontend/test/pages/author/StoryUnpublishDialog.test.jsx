import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { StoryUnpublishDialog } from '../../../src/pages/author/StoryUnpublishDialog';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function view() {
  const changed = vi.fn(),
    close = vi.fn(),
    outer = vi.fn(),
    busy = vi.fn();
  render(
    <LocaleProvider>
      <div onSubmit={outer}>
        <StoryUnpublishDialog
          story={{ id: 'story', title: 'Published story', publishedRevisionId: 'revision' }}
          version={4}
          onChanged={changed}
          onClose={close}
          onBusy={busy}
        />
      </div>
    </LocaleProvider>,
  );
  return { changed, close, outer, busy };
}
function confirm() {
  return screen.getByRole('button', { name: 'Ngừng phát hành truyện' });
}
it('requires a reason and sends exact publication tokens without submitting the surrounding editor', async () => {
  mocks.apiRequest.mockResolvedValue({ story: { id: 'story', status: 'unpublished', version: 5 } });
  const v = view();
  expect(confirm().disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Author reason  ' } });
  fireEvent.click(confirm());
  await waitFor(() => expect(v.changed).toHaveBeenCalledTimes(1));
  expect(v.outer).not.toHaveBeenCalled();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/story/lifecycle', {
    method: 'POST',
    body: {
      action: 'unpublish',
      expectedVersion: 4,
      expectedPublishedRevisionId: 'revision',
      reason: 'Author reason',
    },
  });
});
it('prevents duplicate requests and closing during a pending mutation', async () => {
  let done;
  mocks.apiRequest.mockImplementation(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  const v = view();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Reason' } });
  fireEvent.click(confirm());
  fireEvent.click(screen.getByRole('button', { name: 'Đang ngừng phát hành…' }));
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Hủy' }).disabled).toBe(true);
  done({ story: { id: 'story', status: 'unpublished', version: 5 } });
  await waitFor(() => expect(v.changed).toHaveBeenCalledTimes(1));
  expect(v.busy.mock.calls).toEqual([[true], [false]]);
});
it('retains the reason after uncertainty and requires a reload instead of blind retry', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Stale version'));
  const v = view();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep this reason' } });
  fireEvent.click(confirm());
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox').value).toBe('Keep this reason');
  expect(v.changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái' }));
  expect(v.changed).toHaveBeenCalledTimes(1);
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
});
it.each([
  { id: 'other', status: 'unpublished', version: 5 },
  { id: 'story', status: 'published', version: 5 },
  { id: 'story', status: 'unpublished', version: 4 },
])('rejects an unrelated or stale success response: %j', async (story) => {
  mocks.apiRequest.mockResolvedValue({ story });
  const v = view();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Reason' } });
  fireEvent.click(confirm());
  await screen.findByRole('alert');
  expect(v.changed).not.toHaveBeenCalled();
});
