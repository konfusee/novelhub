import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { UnlockChapterCard } from '../../../src/components/reader/UnlockChapterCard';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
const quote = {
  chapterId: 'chapter',
  publishedRevisionId: '6ad1d6b9bec9b0fe6c41226a',
  priceCoins: 201,
  balance: 500,
  free: false,
  entitled: false,
};
const done = vi.fn();
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <UnlockChapterCard storyId="story" chapterId="chapter" onUnlocked={done} />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('requires confirmation and sends the published revision and quoted price before refreshing prose', async () => {
  mocks.apiRequest.mockImplementation((_path, options) =>
    Promise.resolve(
      options?.method === 'POST' ? { entitlementId: '6ad1d6b9bec9b0fe6c41226b' } : quote,
    ),
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Mở khóa bằng xu' }));
  expect(done).not.toHaveBeenCalled();
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận trừ xu' }));
  await screen.findByRole('button', { name: 'Mở khóa bằng xu' });
  expect(mocks.apiRequest).toHaveBeenCalledWith('/reader/stories/story/chapters/chapter/unlock', {
    method: 'POST',
    body: {
      publishedRevisionId: quote.publishedRevisionId,
      expectedPriceCoins: 201,
      idempotencyKey: expect.any(String),
    },
  });
  expect(done).toHaveBeenCalledTimes(1);
});
it('does not charge if balance is insufficient or access already exists', async () => {
  mocks.apiRequest.mockResolvedValueOnce({ ...quote, balance: 100 });
  const mounted = view();
  expect((await screen.findByRole('button', { name: 'Mở khóa bằng xu' })).disabled).toBe(true);
  expect(screen.getByRole('link', { name: 'Đến ví xu' }).getAttribute('href')).toBe(
    '/reader/wallet',
  );
  mounted.unmount();
  mocks.apiRequest.mockResolvedValue({ ...quote, entitled: true });
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục đọc' }));
  expect(done).toHaveBeenCalledTimes(1);
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
it('keeps financial errors visible and prevents a stale retry or false access', async () => {
  mocks.apiRequest.mockImplementation((_path, options) =>
    options?.method === 'POST'
      ? Promise.reject(new Error('Giá đã thay đổi.'))
      : Promise.resolve(quote),
  );
  view();
  fireEvent.click(await screen.findByRole('button', { name: 'Mở khóa bằng xu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận trừ xu' }));
  await screen.findByText('Giá đã thay đổi.');
  expect(screen.getByRole('button', { name: 'Xác nhận trừ xu' }).disabled).toBe(true);
  expect(done).not.toHaveBeenCalled();
});
