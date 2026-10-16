import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { SubmissionReviewPage } from '../../../src/pages/author/SubmissionReviewPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
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
function Destination() {
  return <p>location{useLocation().pathname}</p>;
}
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
        <Destination />
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('offers specific repair destinations for every failed server check and keeps successful checks free of repair actions', async () => {
  fixture({ ready: false });
  view('?storyId=owned&chapterId=chapter7');
  expect((await screen.findByRole('link', { name: 'Sửa nội dung' })).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/chapter7/edit',
  );
  expect(screen.getByRole('link', { name: 'Chỉnh thể loại truyện' }).getAttribute('href')).toBe(
    '/author/stories/owned?tab=details',
  );
  expect(screen.getByRole('link', { name: 'Xem media của truyện' }).getAttribute('href')).toBe(
    '/author/stories/owned?tab=media',
  );
  expect(
    screen.getByRole('link', { name: 'Hoàn thiện và gửi duyệt truyện cha' }).getAttribute('href'),
  ).toBe('/author/submissions?storyId=owned');
  expect(
    screen.getByRole('link', { name: 'Xem trạng thái và phản hồi' }).getAttribute('href'),
  ).toBe('/author/stories/owned?tab=reviews');
});
it('creates a fresh draft from persisted feedback and navigates to the exact owner work', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST')
      return { revision: { id: 'revision8', storyId: 'owned', chapterId: 'chapter7' } };
    if (path.includes('/prepare?')) return prepared;
    if (path.includes('/workspace')) return { chapters: [] };
    return {
      stories: [],
      page: 1,
      pageCount: 1,
      items: [
        {
          id: 'submission7',
          storyId: 'owned',
          chapterId: 'chapter7',
          title: 'Cần sửa bản thảo',
          status: 'revision-requested',
          version: 4,
          revisionNumber: 7,
          submittedAt: '2026-10-16',
          history: [],
          decisionSummary: 'Làm rõ bối cảnh.',
        },
      ],
    };
  });
  view('');
  await screen.findByText('Làm rõ bối cảnh.');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bản sửa từ phản hồi' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo bản nháp chỉnh sửa' }));
  await screen.findByText('location/author/stories/owned/chapters/chapter7/edit');
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions/submission7/revise', {
    method: 'POST',
    body: { expectedVersion: 4 },
  });
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
