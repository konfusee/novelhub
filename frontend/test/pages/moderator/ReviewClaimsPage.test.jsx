import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ReviewClaimsPage } from '../../../src/pages/moderator/ReviewClaimsPage';
import { LocaleProvider } from '../../../src/context/LocaleContext';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}));
const row = {
  id: '6ad1d6b9bec9b0fe6c41226a',
  storyId: '6ad1d6b9bec9b0fe6c41226b',
  version: 2,
  claimVersion: 3,
  submittedAt: '2026-10-18T00:00:00Z',
  expiresAt: null,
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ReviewClaimsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('acquires then releases with server versions and reloads the correct queue', async () => {
  let held = false;
  mocks.apiRequest.mockImplementation((path, options) => {
    if (options?.method === 'POST') {
      held = !path.endsWith('/release');
      return Promise.resolve({
        claim: { id: row.id, claimVersion: options.body.expectedClaimVersion + 1 },
      });
    }
    const mine = path.includes('view=mine');
    return Promise.resolve({
      items:
        mine === held
          ? [
              {
                ...row,
                ...(held ? { version: 3, claimVersion: 4, expiresAt: '2099-01-01T00:00:00Z' } : {}),
              },
            ]
          : [],
      hasMore: false,
    });
  });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Nhận hồ sơ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  await screen.findByText('Không có hồ sơ trong nhóm này.');
  expect(mocks.apiRequest).toHaveBeenCalledWith(`/moderator/review-claims/${row.id}`, {
    method: 'POST',
    body: { expectedVersion: 2, expectedClaimVersion: 3 },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đang giữ' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Trả hồ sơ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  await screen.findByText('Không có hồ sơ trong nhóm này.');
  expect(mocks.apiRequest).toHaveBeenCalledWith(`/moderator/review-claims/${row.id}/release`, {
    method: 'POST',
    body: { expectedVersion: 3, expectedClaimVersion: 4 },
  });
});
it('shows a claim conflict without pretending success or retrying a stale baseline', async () => {
  mocks.apiRequest.mockImplementation((_path, options) =>
    options?.method === 'POST'
      ? Promise.reject(new Error('Hồ sơ đang có người giữ.'))
      : Promise.resolve({ items: [row], hasMore: false }),
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Nhận hồ sơ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  await screen.findByText('Hồ sơ đang có người giữ.');
  expect(screen.getByRole('button', { name: 'Xác nhận' }).disabled).toBe(true);
});
it('supports reloading a failed queue without mock fallback', async () => {
  mocks.apiRequest
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [], hasMore: false });
  view();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
  await screen.findByText('Không có hồ sơ trong nhóm này.');
});
