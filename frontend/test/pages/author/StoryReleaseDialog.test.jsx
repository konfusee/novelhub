import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { StoryReleaseDialog } from '../../../src/pages/author/StoryReleaseDialog';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const prepared = {
  target: {
    storyId: 'story',
    version: 5,
    revisionId: 'approved-revision',
    submissionId: 'approved-submission',
    title: 'Thông tin đã duyệt',
  },
  ready: true,
  checks: ['approval', 'integrity', 'evidence', 'rights', 'categories', 'media', 'editable'].map(
    (code) => ({ code, ok: true }),
  ),
};
function view(onReleased = vi.fn()) {
  render(
    <MemoryRouter>
      <LocaleProvider>
        <StoryReleaseDialog storyId="story" onClose={vi.fn()} onReleased={onReleased} />
      </LocaleProvider>
    </MemoryRouter>,
  );
  return onReleased;
}
it('publishes only after explicit confirmation using the exact prepared approval and version', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { story: { id: 'story', status: 'published' } } : prepared,
  );
  const released = view();
  await screen.findByRole('heading', { name: 'Thông tin đã duyệt' });
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  expect(screen.getByText(/Các chương vẫn cần được duyệt và phát hành riêng/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Xem gói đã gửi' }).getAttribute('href')).toBe(
    '/author/submissions/approved-submission/preview',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành ngay' }));
  await waitFor(() => expect(released).toHaveBeenCalledTimes(1));
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/story/release', {
    method: 'POST',
    body: {
      revisionId: 'approved-revision',
      submissionId: 'approved-submission',
      expectedVersion: 5,
    },
  });
});
it('cannot override a failed server gate and retries only the readiness check', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...prepared,
    ready: false,
    checks: prepared.checks.map((check) => ({ ...check, ok: check.code !== 'evidence' })),
  });
  view();
  await screen.findByRole('heading', { name: 'Thông tin đã duyệt' });
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true);
  expect(screen.getByText('Chưa đạt')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại điều kiện' }));
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledTimes(2));
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it('keeps stale publication errors visible and never reports success', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') throw new Error('Truyện đã thay đổi.');
    return prepared;
  });
  const released = view();
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }));
  await screen.findByText('Truyện đã thay đổi.');
  expect(released).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
});
it('shows recoverable load errors without offering publication', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Không tải được điều kiện phát hành.'));
  view();
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true);
});

it('labels restoration explicitly while retaining every server release gate', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...prepared,
    target: { ...prepared.target, restoring: true },
  });
  view();
  expect(
    await screen.findByRole('heading', { name: 'Phát hành lại thông tin truyện' }),
  ).toBeTruthy();
  expect(screen.getByText(/Những chương đã phát hành sẽ hiển thị lại/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(false);
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
