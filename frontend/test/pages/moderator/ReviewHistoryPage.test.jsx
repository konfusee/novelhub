import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { ReviewHistoryPage } from '../../../src/pages/moderator/ReviewHistoryPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}));
const row = {
  id: 'history',
  submissionId: 'submission',
  revisionId: 'revision',
  outcome: 'approved',
  reason: 'Phản hồi đã lưu trong MongoDB',
  occurredAt: '2026-10-18T00:00:00Z',
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ReviewHistoryPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('reads stored feedback and filters server history with links to the exact submission', async () => {
  mocks.apiRequest.mockImplementation((path) =>
    Promise.resolve({ items: path.includes('outcome=rejected') ? [] : [row], hasMore: false }),
  );
  view();
  await screen.findByText(row.reason);
  expect(screen.getByRole('link', { name: 'Xem gói duyệt' }).getAttribute('href')).toBe(
    '/moderator/manual-reviews/submission',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
  await screen.findByText('Chưa có quyết định trong nhóm này.');
  expect(
    mocks.apiRequest.mock.calls.some(
      ([path]) => path === '/moderator/manual-reviews/history?page=1&outcome=rejected',
    ),
  ).toBe(true);
});
it('shows a read error and retries without invented history', async () => {
  mocks.apiRequest
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [], hasMore: false });
  view();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Chưa có quyết định trong nhóm này.');
});
