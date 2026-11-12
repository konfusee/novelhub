import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ReportReviewDetailPage } from '../../../src/pages/moderator/ReportReviewDetailPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const REPORT_ID = '507f1f77bcf86cd799439011'
const REPORT_PATH = '/moderator/reports/' + REPORT_ID
const CLAIM_TO_VIEW =
  'Nhận báo cáo để so sánh ảnh chụp lúc báo cáo với nội dung hiện tại và xử lý. Xem báo cáo không thay đổi nội dung.'
const vietnamTime = iso =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso))
// Summary every moderator sees before claiming (UC-MOD-05 step 2).
const summary = overrides => ({
  reportId: REPORT_ID,
  version: 2,
  status: 'open',
  targetType: 'comment',
  targetTitle: 'Bình luận gây hấn',
  reason: 'harassment',
  details: 'Lời lẽ xúc phạm tác giả.',
  reporter: { id: 'reader-1', displayName: 'Độc giả A' },
  reportedAt: '2026-10-29T01:00:00Z',
  claimState: 'unclaimed',
  claimExpiresAt: null,
  resolution: null,
  allowedActions: [],
  ...overrides,
})
// Comparison, earlier cases and allowed actions are returned only to the claim holder.
const held = () =>
  summary({
    claimState: 'mine',
    claimExpiresAt: '2026-10-30T04:20:00Z',
    claimToken: 'token-9',
    snapshot: {
      targetType: 'comment',
      title: '',
      excerpt: 'Đồ ngốc, viết dở tệ.',
      capturedAt: '2026-10-29T01:00:00Z',
    },
    current: {
      state: 'changed',
      title: '',
      excerpt: 'Đồ ngốc, viết dở tệ (đã sửa).',
      ownerAccountId: 'commenter-1',
      ownerName: 'Người bình luận B',
      storyId: 'story-1',
      chapterId: 'chapter-1',
    },
    earlierCases: [
      {
        reportId: 'report-old',
        reason: 'spam',
        reportedAt: '2026-10-20T01:00:00Z',
        status: 'resolved',
        action: 'dismiss',
        outcome: 'dismissed',
        contentChanged: false,
        resolvedAt: '2026-10-21T01:00:00Z',
      },
    ],
    openDuplicates: 2,
    // BR-NEW-S02: a comment can only be dismissed or hidden.
    allowedActions: ['dismiss', 'hide-comment'],
  })
const resolved = (action, outcome, contentChanged) =>
  summary({
    status: 'resolved',
    resolution: {
      action,
      outcome,
      contentChanged,
      reason: 'Ngôn từ quấy rối rõ ràng',
      resolvedAt: '2026-10-29T08:00:00Z',
      moderator: { id: 'mod-1', displayName: 'Kiểm duyệt viên M' },
    },
  })
// Serves `first` until a POST succeeds, then serves what that POST produced.
const serve = (first, post) => {
  let detail = first
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method !== 'POST') return detail
    const { body, next } = await post(path, options)
    detail = next
    return body
  })
}
const view = () =>
  render(
    <MemoryRouter initialEntries={[REPORT_PATH]}>
      <LocaleProvider>
        <Routes>
          <Route path="/moderator/reports/:reportId" element={<ReportReviewDetailPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const fillResolution = async (action, reason = 'Ngôn từ quấy rối rõ ràng') => {
  fireEvent.click(await screen.findByRole('radio', { name: action }))
  fireEvent.change(screen.getByLabelText('Lý do xử lý'), { target: { value: reason } })
  fireEvent.click(screen.getByRole('button', { name: 'Xử lý báo cáo' }))
}
const posts = () => mocks.apiRequest.mock.calls.filter(call => call[1]?.method === 'POST')

it('shows only the summary before a claim and claims with the expiry in Vietnam time', async () => {
  serve(summary(), () => ({ body: { ...held(), messageId: 'SYS-MSG-MOD-01' }, next: held() }))
  view()
  expect(await screen.findByText(CLAIM_TO_VIEW)).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe(REPORT_PATH)
  for (const text of [
    'Đang mở',
    'Bình luận',
    'Quấy rối',
    'Bình luận gây hấn',
    'Độc giả A',
    vietnamTime('2026-10-29T01:00:00Z'),
    'Lời lẽ xúc phạm tác giả.',
    'Chưa có người nhận',
  ])
    expect(screen.getByText(text)).toBeTruthy()
  expect(screen.queryByText('Ảnh chụp lúc báo cáo')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Xử lý báo cáo' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Nhận báo cáo' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(REPORT_PATH + '/claim', {
      method: 'POST',
      body: { expectedVersion: 2 },
    }),
  )
  expect(
    await screen.findByText(
      `Bạn đã nhận báo cáo. Claim hết hạn lúc ${vietnamTime('2026-10-30T04:20:00Z')} (giờ Việt Nam, UTC+7).`,
    ),
  ).toBeTruthy()
  expect(await screen.findByText('Ảnh chụp lúc báo cáo')).toBeTruthy()
})

it('compares the snapshot with the current target and lists earlier cases to the holder', async () => {
  serve(held())
  view()
  expect(await screen.findByText('Đồ ngốc, viết dở tệ.')).toBeTruthy()
  for (const text of [
    'Đồ ngốc, viết dở tệ (đã sửa).',
    'Đang hiển thị, đã khác ảnh chụp',
    'Tác giả: Người bình luận B',
    '2 báo cáo khác đang mở cho cùng đối tượng',
    'Spam',
    'Bạn đang giữ đến ' + vietnamTime('2026-10-30T04:20:00Z'),
  ])
    expect(screen.getByText(text)).toBeTruthy()
  expect(screen.getByText(/Đã bác bỏ báo cáo · Nội dung không thay đổi/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Mở nội dung' }).getAttribute('href')).toBe(
    '/read/story-1/chapter-1',
  )
  const actions = screen.getAllByRole('radio').map(radio => radio.parentElement.textContent)
  expect(actions).toEqual(['Bác bỏ báo cáo', 'Ẩn bình luận'])
  expect(screen.queryByRole('radio', { name: 'Gỡ xuất bản truyện' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Trả báo cáo' })).toBeTruthy()
})

it('dismisses without a second confirmation and shows the recorded outcome', async () => {
  serve(held(), () => ({
    body: {
      status: 'resolved',
      outcome: 'dismissed',
      contentChanged: false,
      messageId: 'SYS-MSG-RPT-02',
    },
    next: resolved('dismiss', 'dismissed', false),
  }))
  view()
  await fillResolution('Bác bỏ báo cáo')
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(REPORT_PATH + '/resolution', {
      method: 'POST',
      body: {
        action: 'dismiss',
        reason: 'Ngôn từ quấy rối rõ ràng',
        expectedVersion: 2,
        claimToken: 'token-9',
      },
    }),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(await screen.findByText('Đã ghi nhận kết quả xử lý báo cáo.')).toBeTruthy()
  for (const text of [
    'Đã xử lý',
    'Kết quả xử lý',
    'Đã bác bỏ báo cáo',
    'Nội dung không thay đổi',
    'Xử lý bởi Kiểm duyệt viên M · ' + vietnamTime('2026-10-29T08:00:00Z'),
  ])
    expect(await screen.findByText(text)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nhận báo cáo' })).toBeNull()
})

it('names the target and restriction in a second confirmation; going back records nothing', async () => {
  serve(held(), () => ({
    body: { status: 'resolved', outcome: 'comment-hidden', contentChanged: true },
    next: resolved('hide-comment', 'comment-hidden', true),
  }))
  view()
  await fillResolution('Ẩn bình luận')
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getByText('Bạn sắp ẩn khỏi độc giả bình luận «Bình luận gây hấn».'),
  ).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts()).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Trả báo cáo' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Xử lý báo cáo' }))
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận' }),
  )
  await waitFor(() => expect(posts()).toHaveLength(1))
  expect(posts()[0]).toEqual([
    REPORT_PATH + '/resolution',
    {
      method: 'POST',
      body: {
        action: 'hide-comment',
        reason: 'Ngôn từ quấy rối rõ ràng',
        expectedVersion: 2,
        claimToken: 'token-9',
      },
    },
  ])
  expect(await screen.findByText('Đã ẩn bình luận')).toBeTruthy()
  expect(screen.getByText('Nội dung đã thay đổi')).toBeTruthy()
})

it('keeps the resolve button disabled until the reason has five characters', async () => {
  serve(held())
  view()
  fireEvent.click(await screen.findByRole('radio', { name: 'Bác bỏ báo cáo' }))
  fireEvent.change(screen.getByLabelText('Lý do xử lý'), { target: { value: '  ab  ' } })
  expect(screen.getByText('2/2000 ký tự (tối thiểu 5)')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Xử lý báo cáo' }).disabled).toBe(true)
})

it('reports a lost claim and reloads the report', async () => {
  serve(held(), () =>
    Promise.reject(Object.assign(new Error('lost'), { status: 409, code: 'claim_not_held' })),
  )
  view()
  await fillResolution('Bác bỏ báo cáo')
  expect(
    await screen.findByText(
      'Claim của bạn đã hết hạn hoặc không còn được giữ. Hãy nhận lại báo cáo trước khi tiếp tục.',
    ),
  ).toBeTruthy()
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.filter(call => call[0] === REPORT_PATH)).toHaveLength(2),
  )
})

it('names the parent story, not the chapter, when unpublishing the story of a chapter report', async () => {
  serve({
    ...held(),
    targetType: 'chapter',
    targetTitle: 'Chương 3: Hồi kết',
    current: {
      state: 'visible',
      title: 'Chương 3: Hồi kết',
      excerpt: 'Đoạn kết.',
      ownerAccountId: 'author-1',
      ownerName: 'Tác giả A',
      storyId: 'story-1',
      chapterId: 'chapter-3',
    },
    parentStory: { id: 'story-1', title: 'Truyện Mây Trắng' },
    allowedActions: ['dismiss', 'unpublish-chapter', 'unpublish-story', 'warn-author'],
  })
  view()
  await fillResolution('Gỡ xuất bản truyện')
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Bạn sắp gỡ xuất bản truyện «Truyện Mây Trắng».')).toBeTruthy()
  expect(
    within(dialog).getByText(
      'Toàn bộ truyện ngừng phát hành: mọi chương của truyện sẽ không còn hiển thị với độc giả.',
    ),
  ).toBeTruthy()
  expect(dialog.textContent).not.toContain('Chương 3: Hồi kết')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts()).toHaveLength(0)

  fireEvent.click(screen.getByRole('radio', { name: 'Gỡ xuất bản chương' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xử lý báo cáo' }))
  const chapterDialog = await screen.findByRole('dialog')
  expect(
    within(chapterDialog).getByText('Bạn sắp gỡ xuất bản chương «Chương 3: Hồi kết».'),
  ).toBeTruthy()
  expect(chapterDialog.textContent).not.toContain('Toàn bộ truyện ngừng phát hành')
  expect(posts()).toHaveLength(0)
})

it('resumes a live claim recorded before claim tokens before offering release or resolution', async () => {
  const legacy = summary({
    status: 'open',
    claimState: 'mine',
    claimExpiresAt: '2026-10-30T04:20:00Z',
    claimResumeRequired: true,
  })
  serve(legacy, () => ({ body: { ...held(), messageId: 'SYS-MSG-MOD-01' }, next: held() }))
  view()
  expect(
    await screen.findByText(
      'Bạn đang giữ claim của báo cáo này từ trước khi hệ thống dùng mã claim. Bấm Tiếp tục claim để so sánh nội dung và xử lý; thời hạn claim giữ nguyên.',
    ),
  ).toBeTruthy()
  expect(screen.getByText('Bạn đang giữ đến ' + vietnamTime('2026-10-30T04:20:00Z'))).toBeTruthy()
  for (const name of ['Trả báo cáo', 'Xử lý báo cáo', 'Nhận báo cáo'])
    expect(screen.queryByRole('button', { name }), name).toBeNull()
  expect(screen.queryByText('Ảnh chụp lúc báo cáo')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục claim' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(REPORT_PATH + '/claim', {
      method: 'POST',
      body: { expectedVersion: 2 },
    }),
  )
  expect(await screen.findByText('Ảnh chụp lúc báo cáo')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Trả báo cáo' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Xử lý báo cáo' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Tiếp tục claim' })).toBeNull()
})

it('tells the moderator when another moderator holds the report', async () => {
  serve(summary({ claimState: 'other', claimExpiresAt: '2026-10-30T02:00:00Z' }))
  view()
  expect(await screen.findByText('Báo cáo đang được kiểm duyệt viên khác xử lý.')).toBeTruthy()
  expect(
    screen.getByText('Kiểm duyệt viên khác đang giữ đến ' + vietnamTime('2026-10-30T02:00:00Z')),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nhận báo cáo' })).toBeNull()
})

it('shows a not-found message for a missing report', async () => {
  mocks.apiRequest.mockRejectedValue(
    Object.assign(new Error('missing'), { status: 404, code: 'not_found' }),
  )
  view()
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Mục đã chọn không còn tồn tại hoặc không thể truy cập.',
  )
})
