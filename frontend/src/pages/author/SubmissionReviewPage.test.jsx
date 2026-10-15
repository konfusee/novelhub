import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { SubmissionReviewPage } from './SubmissionReviewPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../layouts', () => ({ AuthorLayout: ({ children }) => <main>{children}</main> }));
const prepared = {
  story: { id: 'owned', title: 'Truyện từ MongoDB', author: 'Tác giả thật' },
  target: { title: 'Gói bản thảo thật', version: 7, revisionId: 'revision7', revisionNumber: 7 },
  checks: ['editable', 'content', 'categories', 'media', 'parent'].map((code) => ({
    code,
    ok: true,
  })),
  ready: true,
  words: 8,
  requiresRights: true,
};
function fixture({ ready = true, failure = false } = {}) {
  let sent = false;
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      if (failure) throw new Error('Phiên bản đã thay đổi');
      sent = true;
      return { submission: { id: 'stored-submission', status: 'validated' } };
    }
    if (path.includes('/prepare?'))
      return {
        ...prepared,
        ready: ready && !sent,
        checks: prepared.checks.map((row) => ({ ...row, ok: ready && !sent })),
      };
    if (path.includes('/workspace'))
      return { chapters: [{ id: 'chapter7', title: 'Chương thứ bảy' }] };
    return {
      stories: [{ id: 'owned', title: 'Truyện từ MongoDB' }],
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    };
  });
}
const view = (query = '?storyId=owned') =>
  render(
    <MemoryRouter initialEntries={[`/author/submissions${query}`]}>
      <LocaleProvider>
        <SubmissionReviewPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('submits the exact server revision and explicit rights, then waits for real processing', async () => {
  fixture();
  view();
  await screen.findByRole('heading', { name: 'Gói bản thảo thật' });
  const send = screen.getByRole('button', { name: 'Gửi xét duyệt', exact: true });
  expect(send.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByRole('textbox', { name: /Ghi chú nguồn/ }), {
    target: { value: 'Nguồn gốc của tôi' },
  });
  fireEvent.click(send);
  const buttons = screen.getAllByRole('button', { name: 'Gửi xét duyệt', exact: true });
  fireEvent.click(buttons[buttons.length - 1]);
  await screen.findByText('stored-submission');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions', {
    method: 'POST',
    body: {
      storyId: 'owned',
      revisionId: 'revision7',
      expectedVersion: 7,
      rights: { basis: 'original', asserted: true, sourceLicenceNote: 'Nguồn gốc của tôi' },
    },
  });
  expect(screen.queryByText('The Silent Forest')).toBeNull();
  expect(screen.queryByText('14.200 từ')).toBeNull();
});
it('does not let the browser override a failed server checklist', async () => {
  fixture({ ready: false });
  view();
  await screen.findByRole('heading', { name: 'Gói bản thảo thật' });
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Gửi xét duyệt', exact: true }).disabled).toBe(true);
  expect(screen.queryByRole('button', { pressed: false })).toBeNull();
});
it('retains the rights note and error without showing success after a rejected write', async () => {
  fixture({ failure: true });
  view();
  await screen.findByRole('checkbox');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByRole('textbox', { name: /Ghi chú nguồn/ }), {
    target: { value: 'Giữ lại ghi chú' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi xét duyệt', exact: true }));
  const buttons = screen.getAllByRole('button', { name: 'Gửi xét duyệt', exact: true });
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() =>
    expect(screen.getAllByText('Phiên bản đã thay đổi').length).toBeGreaterThan(0),
  );
  expect(screen.getByRole('textbox', { name: /Ghi chú nguồn/ }).value).toBe('Giữ lại ghi chú');
  expect(screen.queryByText('stored-submission')).toBeNull();
});
it('does not silently select the first owned story', async () => {
  fixture();
  view('');
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions?page=1', expect.anything()),
  );
  expect(mocks.apiRequest.mock.calls.some(([path]) => path.includes('/prepare?'))).toBe(false);
});
