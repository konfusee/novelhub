import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { StoryCommunity } from '../../../src/components/story/StoryCommunity';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), authenticated: true }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mocks.authenticated }),
}));
const root = {
  id: 'root-id',
  body: 'Bình luận trong MongoDB',
  author: 'Độc giả thật',
  replyCount: 1,
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <StoryCommunity storyId="story-id" />
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  mocks.authenticated = true;
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('renders persisted ratings without a sample review and updates stars through the API', async () => {
  let rating = 3;
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      rating = options.body.value;
      return { ok: true };
    }
    return {
      items: [{ id: 'rating-id', author: 'Người chấm thật', rating }],
      total: 1,
      pageSize: 5,
    };
  });
  view();
  expect(await screen.findByText('Người chấm thật')).toBeTruthy();
  expect(screen.queryByText('Kaelen_Reader')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '5 sao' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  expect(await screen.findByText('Đã lưu nội dung của bạn.')).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/community/stories/story-id/rating', {
    method: 'PUT',
    body: { value: 5 },
  });
  await waitFor(() => expect(screen.getByLabelText('5 sao', { selector: 'p' })).toBeTruthy());
});
it('reads replies from MongoDB, preserves failed text and persists replies under the selected root', async () => {
  let fail = true;
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      if (fail) throw new Error('offline');
      return { ok: true };
    }
    if (path.includes('parentId='))
      return {
        items: [{ id: 'reply-id', author: 'Người trả lời', body: 'Phản hồi thật' }],
        total: 1,
        pageSize: 20,
      };
    if (path.includes('/ratings')) return { items: [], total: 0, pageSize: 5 };
    return { items: [root], total: 1, pageSize: 5 };
  });
  view();
  fireEvent.click(screen.getByRole('button', { name: 'Thảo luận', exact: true }));
  expect(await screen.findByText('Bình luận trong MongoDB')).toBeTruthy();
  expect(await screen.findByText('Phản hồi thật')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trả lời', exact: true }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Câu trả lời của tôi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi thảo luận' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('textbox').value).toBe('Câu trả lời của tôi');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Gửi thảo luận' }));
  expect(await screen.findByText('Đã lưu nội dung của bạn.')).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith('/community/stories/story-id/comments', {
    method: 'POST',
    body: { body: 'Câu trả lời của tôi', parentId: 'root-id' },
  });
  expect(screen.getByRole('textbox').value).toBe('');
});
it('shows retry and actual empty states for guests with no fixture fallback', async () => {
  mocks.authenticated = false;
  mocks.apiRequest.mockRejectedValue(new Error('offline'));
  view();
  expect(await screen.findByText('Không tải được nội dung cộng đồng.')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeTruthy();
  mocks.apiRequest.mockResolvedValue({ items: [], total: 0, pageSize: 5 });
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Chưa có đánh giá')).toBeTruthy();
  expect(screen.queryByText('Kaelen_Reader')).toBeNull();
});
