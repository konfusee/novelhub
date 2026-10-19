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
  const location = useLocation();
  return (
    <p>
      location{location.pathname}
      {location.search}
    </p>
  );
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
it.each(['blocks-v1', 'blocks-v2', 'blocks-v3'])(
  'opens the correct editor for a revised %s draft',
  async (formatVersion) => {
    mocks.apiRequest.mockImplementation(async (path, options) => {
      if (options?.method === 'POST')
        return {
          revision: { id: 'revision8', storyId: 'owned', chapterId: 'chapter7', formatVersion },
        };
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
    await screen.findByText(
      `location/author/stories/owned/chapters/chapter7/edit${formatVersion === 'blocks-v1' ? '' : '?mode=rich'}`,
    );
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions/submission7/revise', {
      method: 'POST',
      body: { expectedVersion: 4 },
    });
  },
);
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
it('links illustrated drafts back to rich editing instead of an unrelated library destination', async () => {
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path.includes('/prepare?'))
      return {
        ...prepared,
        target: { ...prepared.target, formatVersion: 'blocks-v3' },
        ready: false,
        requiresRights: false,
        checks: prepared.checks.map((row) => ({
          ...row,
          ok: row.code !== 'media' && row.code !== 'content',
        })),
      };
    if (path.includes('/workspace'))
      return { chapters: [{ id: 'chapter7', title: 'Chương có ảnh' }] };
    return {
      stories: [{ id: 'owned', title: 'Truyện' }],
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    };
  });
  view('?storyId=owned&chapterId=chapter7');
  expect(
    (await screen.findByRole('link', { name: 'Chỉnh ảnh trong bản nháp' })).getAttribute('href'),
  ).toBe('/author/stories/owned/chapters/chapter7/edit?mode=rich');
  expect(screen.getByRole('link', { name: 'Sửa nội dung' }).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/chapter7/edit?mode=rich',
  );
});
it('binds image rights to the exact manifest and requires a licence note before submitting', async () => {
  const digest = 'a'.repeat(64);
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') return { submission: { id: 'image-submission' } };
    if (path.includes('/prepare?'))
      return {
        ...prepared,
        target: { ...prepared.target, formatVersion: 'blocks-v3' },
        imageRights: { count: 2, mediaDigest: digest },
      };
    if (path.includes('/workspace')) return { chapters: [{ id: 'chapter7', title: 'Chương' }] };
    return {
      stories: [{ id: 'owned', title: 'Truyện' }],
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    };
  });
  view('?storyId=owned&chapterId=chapter7');
  await screen.findByText(/nội dung chương và 2 ảnh/);
  const send = screen.getByRole('button', { name: 'Gửi xét duyệt', exact: true });
  expect(send.disabled).toBe(true);
  fireEvent.click(screen.getByRole('combobox', { name: 'Cơ sở quyền nội dung' }));
  fireEvent.click(screen.getByRole('option', { name: 'Được cấp quyền sử dụng' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /toàn bộ ảnh/ }));
  expect(send.disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: /Nguồn và phạm vi cấp phép/ }), {
    target: { value: 'Nguồn ảnh và giấy phép.' },
  });
  expect(send.disabled).toBe(false);
  fireEvent.click(send);
  const sends = screen.getAllByRole('button', { name: 'Gửi xét duyệt', exact: true });
  fireEvent.click(sends[sends.length - 1]);
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/submissions',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          chapterId: 'chapter7',
          revisionId: 'revision7',
          imageManifestDigest: digest,
          rights: {
            basis: 'licensed',
            asserted: true,
            sourceLicenceNote: 'Nguồn ảnh và giấy phép.',
          },
        }),
      }),
    ),
  );
});
it('requires a fresh rights confirmation when rechecking finds a different revision', async () => {
  let revisionId = 'revision7';
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path.includes('/workspace')) return { chapters: [] };
    if (path.includes('/prepare?'))
      return { ...prepared, target: { ...prepared.target, revisionId } };
    return {
      stories: [{ id: 'owned', title: 'Truyện' }],
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    };
  });
  view();
  fireEvent.click(await screen.findByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Gửi xét duyệt', exact: true }).disabled).toBe(false);
  revisionId = 'revision8';
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại bản nháp' }));
  await screen.findByText('revision8');
  expect(screen.getByRole('checkbox').checked).toBe(false);
  expect(screen.getByRole('button', { name: 'Gửi xét duyệt', exact: true }).disabled).toBe(true);
});
it('shows the saved immutable image rights after reload instead of editable defaults', async () => {
  mocks.apiRequest.mockImplementation(async (path) => {
    if (path.includes('/workspace')) return { chapters: [{ id: 'chapter7', title: 'Chương' }] };
    if (path.includes('/prepare?'))
      return {
        ...prepared,
        ready: false,
        target: { ...prepared.target, formatVersion: 'blocks-v3' },
        imageRights: { count: 1, mediaDigest: 'a'.repeat(64) },
        frozenRights: {
          basis: 'licensed',
          asserted: true,
          sourceLicenceNote: 'Quyền đã lưu trên máy chủ.',
        },
        checks: prepared.checks.map((row) => ({ ...row, ok: row.code !== 'editable' })),
      };
    return {
      stories: [{ id: 'owned', title: 'Truyện' }],
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    };
  });
  view('?storyId=owned&chapterId=chapter7');
  const note = await screen.findByRole('textbox', { name: /Nguồn và phạm vi cấp phép/ });
  expect(note.value).toBe('Quyền đã lưu trên máy chủ.');
  expect(note.closest('fieldset').disabled).toBe(true);
  expect(screen.getByRole('checkbox').checked).toBe(true);
  expect(screen.getByRole('combobox', { name: 'Cơ sở quyền nội dung' }).textContent).toContain(
    'Được cấp quyền sử dụng',
  );
});
it.each([false, true])(
  'uses server eligibility for revising an approved unpublished chapter: %s',
  async (canRevise) => {
    mocks.apiRequest.mockImplementation(async (_path, options) =>
      options?.method === 'POST'
        ? {
            revision: {
              id: 'fresh',
              storyId: 'owned',
              chapterId: 'chapter7',
              formatVersion: 'blocks-v3',
            },
          }
        : {
            stories: [],
            page: 1,
            pageCount: 1,
            total: 1,
            items: [
              {
                id: 'approved-source',
                storyId: 'owned',
                chapterId: 'chapter7',
                title: 'Chương đã gỡ',
                status: 'approved',
                canRevise,
                version: 8,
                history: [],
              },
            ],
          },
    );
    view('');
    await screen.findByText('Chương đã gỡ');
    const action = screen.queryByRole('button', { name: 'Tạo bản sửa chương', exact: true });
    expect(Boolean(action)).toBe(canRevise);
    if (canRevise) {
      fireEvent.click(action);
      fireEvent.click(
        await screen.findByRole('button', { name: 'Tạo bản nháp chỉnh sửa', exact: true }),
      );
      await screen.findByText('location/author/stories/owned/chapters/chapter7/edit?mode=rich');
      expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions/approved-source/revise', {
        method: 'POST',
        body: { expectedVersion: 8 },
      });
    }
  },
);
