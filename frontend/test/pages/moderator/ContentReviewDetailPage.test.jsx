import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ContentReviewDetailPage } from '../../../src/pages/moderator/ContentReviewDetailPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const FEEDBACK_LABEL = 'Phản hồi cho tác giả (bắt buộc khi từ chối, tối đa 4000 ký tự)'
const CLAIM_TO_VIEW =
  'Nhận hồ sơ để xem đúng phiên bản đã gửi, khai báo quyền và bằng chứng AI đã lưu.'
const vietnamTime = iso =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso))
const finding = index => ({
  id: `f${index}`,
  rank: index,
  score: 0.87,
  queryPassageId: `q${index}`,
  sourcePassageId: `s${index}`,
  sourceChapterId: 'source-chapter',
  sourceChapterTitle: 'Chương nguồn',
  sourceStoryTitle: 'Truyện nguồn',
  queryText: `Đoạn gửi ${index}`,
  sourceText: `Đoạn nguồn ${index}`,
})
// Summary every moderator sees (UC-MOD-02 step 2).
const summary = () => ({
  submission: {
    id: 'sub-1',
    version: 4,
    status: 'pending-review',
    submittedAt: '2026-10-29T00:00:00Z',
    decisionSummary: '',
    type: 'chapter',
    claimState: 'unclaimed',
    claimExpiresAt: null,
  },
  title: 'Chương kiểm duyệt',
  story: { id: 'story-1', title: 'Truyện kiểm duyệt' },
  author: { id: 'author-1', displayName: 'Tác giả A', active: true },
  evidenceStatus: 'ready',
  actions: { canClaim: true, canRelease: false, canDecide: false },
})
// Full package returned only to the holder of the live claim (SDS decision 4).
const held = () => {
  const base = summary()
  return {
    ...base,
    submission: {
      ...base.submission,
      status: 'decision-pending',
      claimState: 'mine',
      claimExpiresAt: '2026-10-30T03:30:00Z',
      claimToken: 'token-1',
    },
    revision: { id: 'revision-1', version: 3, number: 2, formatVersion: 'blocks-v3' },
    packageDigest: 'digest-1',
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
    media: [{ mediaId: 'img-1' }],
    chapter: {
      id: 'chapter-1',
      document: {
        title: 'Chương kiểm duyệt',
        blocks: [
          { type: 'paragraph', inlines: [{ text: 'Đoạn văn của gói.', marks: [] }] },
          { type: 'image', mediaId: 'img-1', alt: 'Ảnh trong gói', caption: '' },
        ],
      },
    },
    evidence: {
      batch: {
        id: 'batch-1',
        version: 7,
        status: 'available-for-human-review',
        stage: 'llm',
        failedStage: null,
      },
      findingsCount: 1,
      maxScore: 0.87,
      findingsTruncated: false,
      attempts: [
        { stage: 'embedding', status: 'succeeded' },
        { stage: 'comparison', status: 'succeeded' },
        { stage: 'llm', status: 'succeeded' },
      ],
      findings: [finding(1)],
      llmReview: {
        status: 'succeeded',
        summary: 'AI thấy một đoạn trùng ý.',
        riskLevel: 'medium',
        riskReasons: ['Một đoạn gần giống truyện nguồn.'],
        suggestions: ['Viết lại đoạn mở đầu.'],
        findingAssessments: [],
        droppedIneligibleFindings: [],
        reviewedChars: 1200,
        totalChars: 1200,
        criteriaVersion: 'v1',
        completedAt: '2026-10-29T01:00:00Z',
      },
    },
    history: [{ action: 'submitted', occurredAt: '2026-10-29T00:00:00Z' }],
    actions: { canClaim: false, canRelease: true, canDecide: true },
  }
}
const serve = (detail, post = () => Promise.resolve({})) =>
  mocks.apiRequest.mockImplementation((path, options) =>
    options?.method === 'POST' ? post(path, options) : Promise.resolve(detail),
  )
const view = () =>
  render(
    <MemoryRouter initialEntries={['/moderator/submissions/sub-1']}>
      <LocaleProvider>
        <Routes>
          <Route
            path="/moderator/submissions/:submissionId"
            element={<ContentReviewDetailPage />}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const decisionBody = (outcome, feedback) => ({
  outcome,
  feedback,
  expectedVersion: 4,
  revisionId: 'revision-1',
  revisionVersion: 3,
  evidenceBatchId: 'batch-1',
  evidenceVersion: 7,
  claimToken: 'token-1',
})

it('shows only the summary before a claim, then claims with the expiry in Vietnam time', async () => {
  let detail = summary()
  mocks.apiRequest.mockImplementation((path, options) => {
    if (options?.method !== 'POST') return Promise.resolve(detail)
    detail = held()
    return Promise.resolve({ ...held(), messageId: 'SYS-MSG-MOD-01' })
  })
  view()
  expect(await screen.findByText(CLAIM_TO_VIEW)).toBeTruthy()
  for (const text of ['Chương kiểm duyệt', 'Truyện kiểm duyệt', 'Tác giả A', 'Sẵn sàng'])
    expect(screen.getByText(text)).toBeTruthy()
  expect(screen.getByText('Chưa có người nhận')).toBeTruthy()
  expect(screen.queryByRole('article')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Phê duyệt' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Nhận hồ sơ' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/submissions/sub-1/claim', {
      method: 'POST',
      body: { expectedVersion: 4 },
    }),
  )
  expect(
    await screen.findByText(
      `Bạn đã nhận hồ sơ. Claim hết hạn lúc ${vietnamTime('2026-10-30T03:30:00Z')} (giờ Việt Nam, UTC+7).`,
    ),
  ).toBeTruthy()
  expect(await screen.findByRole('article')).toBeTruthy()
})

it('resumes a live claim recorded before claim tokens before offering release or a decision', async () => {
  const base = summary()
  let detail = {
    ...base,
    submission: {
      ...base.submission,
      status: 'decision-pending',
      claimState: 'mine',
      claimExpiresAt: '2026-10-30T03:30:00Z',
      claimResumeRequired: true,
    },
    actions: { canClaim: false, canRelease: false, canDecide: false },
  }
  mocks.apiRequest.mockImplementation((path, options) => {
    if (options?.method !== 'POST') return Promise.resolve(detail)
    detail = held()
    return Promise.resolve({ ...held(), messageId: 'SYS-MSG-MOD-01' })
  })
  view()
  expect(
    await screen.findByText(
      'Bạn đang giữ claim của hồ sơ này từ trước khi hệ thống dùng mã claim. Bấm Tiếp tục claim để xem gói nội dung và ra quyết định; thời hạn claim giữ nguyên.',
    ),
  ).toBeTruthy()
  expect(screen.getByText('Bạn đang giữ đến ' + vietnamTime('2026-10-30T03:30:00Z'))).toBeTruthy()
  for (const name of ['Trả hồ sơ', 'Phê duyệt', 'Từ chối', 'Nhận hồ sơ'])
    expect(screen.queryByRole('button', { name }), name).toBeNull()
  expect(screen.queryByRole('article')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục claim' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/submissions/sub-1/claim', {
      method: 'POST',
      body: { expectedVersion: 4 },
    }),
  )
  expect(await screen.findByRole('article')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Phê duyệt' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Trả hồ sơ' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Tiếp tục claim' })).toBeNull()
})

it('renders the exact package, rights, advisory AI summary and history to the holder', async () => {
  serve(held())
  view()
  const article = await screen.findByRole('article')
  expect(article.textContent).toContain('Đoạn văn của gói.')
  expect(screen.getByRole('img', { name: 'Ảnh trong gói' }).getAttribute('src')).toBe(
    '/api/moderator/submissions/sub-1/images/img-1',
  )
  for (const text of [
    'Nội dung do tác giả sáng tác',
    'Nhận định AI (tham khảo, có thể bị nội dung tác giả tác động)',
    'AI thấy một đoạn trùng ý.',
    'Kết quả AI chỉ mang tính tham khảo, không phải phán quyết.',
    'Mức rủi ro: Trung bình',
    'Đã gửi duyệt',
    'Bạn đang giữ đến ' + vietnamTime('2026-10-30T03:30:00Z'),
  ])
    expect(screen.getByText(text)).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/submissions/sub-1')
})

it('requires feedback to reject and sends the exact versions and claim token', async () => {
  serve(held(), () => Promise.resolve({ status: 'rejected', messageId: 'SYS-MSG-PUB-08' }))
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }))
  expect(screen.getByRole('button', { name: 'Xác nhận' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText(FEEDBACK_LABEL), {
    target: { value: 'Cần sửa đoạn mở đầu.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/submissions/sub-1/decision', {
      method: 'POST',
      body: decisionBody('reject', 'Cần sửa đoạn mở đầu.'),
    }),
  )
  expect(await screen.findByText('Đã ghi nhận từ chối và phản hồi cho tác giả.')).toBeTruthy()
})

it('approves without feedback and shows the approval message', async () => {
  serve(held(), () => Promise.resolve({ status: 'approved', messageId: 'SYS-MSG-PUB-07' }))
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phê duyệt' }))
  const confirm = screen.getByRole('button', { name: 'Xác nhận' })
  expect(confirm.disabled).toBe(false)
  fireEvent.click(confirm)
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/submissions/sub-1/decision', {
      method: 'POST',
      body: decisionBody('approve', ''),
    }),
  )
  expect(await screen.findByText('Đã ghi nhận phê duyệt xuất bản.')).toBeTruthy()
})

it('releases the claim with its token', async () => {
  serve(held(), () => Promise.resolve({ ...summary(), messageId: 'SYS-MSG-MOD-03' }))
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Trả hồ sơ' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/submissions/sub-1/release', {
      method: 'POST',
      body: { expectedVersion: 4, claimToken: 'token-1' },
    }),
  )
  expect(await screen.findByText('Đã trả claim của bạn.')).toBeTruthy()
})

it('shows the failed AI stage and keeps the manual decision available', async () => {
  const detail = held()
  detail.evidenceStatus = 'failed'
  detail.evidence = {
    ...detail.evidence,
    batch: { ...detail.evidence.batch, status: 'failed', failedStage: 'comparison' },
    findingsCount: 0,
    maxScore: null,
    attempts: [
      { stage: 'embedding', status: 'succeeded' },
      { stage: 'comparison', status: 'failed' },
    ],
    findings: [],
    llmReview: null,
  }
  serve(detail)
  view()
  expect(
    await screen.findByText('Giai đoạn AI thất bại: So sánh tương đồng. Hãy kiểm duyệt thủ công.'),
  ).toBeTruthy()
  expect(screen.getByText('Thất bại')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Phê duyệt' })).toBeTruthy()
})

it('keeps the modal open with a reload message when the submission changed', async () => {
  serve(held(), () =>
    Promise.reject(Object.assign(new Error('stale'), { status: 409, code: 'submission_changed' })),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }))
  fireEvent.change(screen.getByLabelText(FEEDBACK_LABEL), {
    target: { value: 'Cần sửa đoạn mở đầu.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  const dialog = screen.getByRole('dialog')
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    'Hồ sơ đã thay đổi hoặc không còn đủ điều kiện. Hãy tải lại trước khi quyết định.',
  )
  expect(screen.getByLabelText(FEEDBACK_LABEL).value).toBe('Cần sửa đoạn mở đầu.')
  expect(screen.queryByText('Đã ghi nhận từ chối và phản hồi cho tác giả.')).toBeNull()
})

it('asks to claim again when the claim expired before the decision', async () => {
  serve(held(), () =>
    Promise.reject(Object.assign(new Error('expired'), { status: 409, code: 'claim_not_held' })),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phê duyệt' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  expect((await within(screen.getByRole('dialog')).findByRole('alert')).textContent).toBe(
    'Claim của bạn đã hết hạn hoặc không còn được giữ. Hãy nhận lại hồ sơ trước khi tiếp tục.',
  )
})

it('shows a not-found message for a missing submission', async () => {
  mocks.apiRequest.mockRejectedValue(
    Object.assign(new Error('missing'), { status: 404, code: 'not_found' }),
  )
  view()
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Mục đã chọn không còn tồn tại hoặc không thể truy cập.',
  )
})

it('flags partial AI coverage and truncated findings', async () => {
  const detail = held()
  detail.evidence = {
    ...detail.evidence,
    findingsCount: 75,
    findingsTruncated: true,
    findings: Array.from({ length: 50 }, (_, index) => finding(index + 1)),
    llmReview: { ...detail.evidence.llmReview, reviewedChars: 60000, totalChars: 61000 },
  }
  serve(detail)
  view()
  expect(await screen.findByText('AI chỉ đọc 60.000/61.000 ký tự')).toBeTruthy()
  expect(screen.getByText('Chưa đủ dữ liệu')).toBeTruthy()
  expect(screen.getByText('Đang hiển thị 50 / 75 đoạn tương đồng')).toBeTruthy()
  expect(screen.queryByText('Mức rủi ro: Trung bình')).toBeNull()
})

// A story package: metadata carries the submitted cover and banner (T32, UC-MOD-02).
const storyHeld = images => {
  const base = held()
  delete base.chapter
  return {
    ...base,
    submission: { ...base.submission, type: 'story' },
    title: 'Truyện kiểm duyệt',
    revision: { ...base.revision, formatVersion: 'story-v1' },
    media: [],
    metadata: {
      title: 'Truyện kiểm duyệt',
      description: 'Tóm tắt của gói truyện.',
      categoryId: 'category-1',
      tags: [],
      category: { id: 'category-1', name: 'Kỳ ảo', status: 'active' },
      cover: null,
      banner: null,
      ...images,
    },
  }
}

it('renders the exact submitted cover and banner in the story card', async () => {
  serve(
    storyHeld({
      cover: { mediaId: 'cover-a', url: '/moderator/submissions/sub-1/images/cover-a' },
      banner: { mediaId: 'banner-a', url: '/moderator/submissions/sub-1/images/banner-a' },
    }),
  )
  view()
  const cover = await screen.findByRole('img', {
    name: 'Ảnh bìa đã gửi của truyện Truyện kiểm duyệt',
  })
  expect(cover.getAttribute('src')).toBe('/api/moderator/submissions/sub-1/images/cover-a')
  expect(cover.getAttribute('crossorigin')).toBe('use-credentials')
  expect(
    screen
      .getByRole('img', { name: 'Banner đã gửi của truyện Truyện kiểm duyệt' })
      .getAttribute('src'),
  ).toBe('/api/moderator/submissions/sub-1/images/banner-a')
  expect(screen.getByText('Ảnh bìa đã gửi')).toBeTruthy()
  expect(screen.getByText('Banner đã gửi')).toBeTruthy()
  fireEvent.error(cover)
  expect(
    screen.getByText(
      'Không tải được ảnh đã gửi. Ảnh có thể không còn khớp gói hoặc claim đã hết hạn; hãy tải lại hồ sơ.',
    ),
  ).toBeTruthy()
})

it('states when the story package has no cover or banner, or only an undigested legacy one', async () => {
  serve(storyHeld())
  view()
  expect(await screen.findByText('Gói gửi không có ảnh bìa.')).toBeTruthy()
  expect(screen.getByText('Gói gửi không có banner.')).toBeTruthy()
  expect(screen.queryByRole('img')).toBeNull()
  cleanup()

  serve(storyHeld({ cover: { mediaId: 'legacy-cover', url: null } }))
  view()
  expect(
    await screen.findByText(
      'Gói này được gửi trước khi ảnh được lưu kèm dấu kiểm tra, nên không thể hiển thị đúng ảnh đã gửi.',
    ),
  ).toBeTruthy()
  expect(screen.getByText('Gói gửi không có banner.')).toBeTruthy()
  expect(screen.queryByRole('img')).toBeNull()
})
