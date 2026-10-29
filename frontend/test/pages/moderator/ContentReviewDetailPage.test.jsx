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
const base = () => ({
  submission: {
    id: 'sub-1',
    version: 4,
    status: 'decision-pending',
    submittedAt: '2026-10-29T00:00:00Z',
    decisionSummary: '',
    type: 'chapter',
    claim: { ownedByMe: true, expired: false },
  },
  story: { id: 'story-1', title: 'Truyện kiểm duyệt' },
  author: { id: 'author-1', displayName: 'Tác giả A' },
  revision: { id: 'revision-1', number: 2, formatVersion: 'blocks-v3' },
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
})
const serve = (detail, post = () => Promise.resolve({ submission: {} })) =>
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

it('renders the exact package, rights, advisory AI summary and history', async () => {
  serve(base())
  view()
  const article = await screen.findByRole('article')
  expect(article.textContent).toContain('Đoạn văn của gói.')
  expect(screen.getByRole('img', { name: 'Ảnh trong gói' }).getAttribute('src')).toBe(
    '/api/moderator/submissions/sub-1/media/img-1/content',
  )
  for (const text of [
    'Nội dung do tác giả sáng tác',
    'Nhận định AI (tham khảo, có thể bị nội dung tác giả tác động)',
    'AI thấy một đoạn trùng ý.',
    'Kết quả AI chỉ mang tính tham khảo, không phải phán quyết.',
    'Mức rủi ro: Trung bình',
    'Đã gửi duyệt',
  ])
    expect(screen.getByText(text)).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/submissions/sub-1')
})

it('requires feedback to reject and sends the exact versions', async () => {
  serve(base())
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
      body: {
        decision: 'reject',
        feedback: 'Cần sửa đoạn mở đầu.',
        expectedVersion: 4,
        evidenceBatchId: 'batch-1',
        evidenceBatchVersion: 7,
      },
    }),
  )
  expect(await screen.findByText('Đã lưu quyết định và gửi thông báo cho tác giả.')).toBeTruthy()
})

it('approves without feedback', async () => {
  serve(base())
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phê duyệt' }))
  const confirm = screen.getByRole('button', { name: 'Xác nhận' })
  expect(confirm.disabled).toBe(false)
  fireEvent.click(confirm)
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/submissions/sub-1/decision', {
      method: 'POST',
      body: {
        decision: 'approve',
        feedback: '',
        expectedVersion: 4,
        evidenceBatchId: 'batch-1',
        evidenceBatchVersion: 7,
      },
    }),
  )
})

it('shows the failed AI stage and keeps manual review available', async () => {
  const detail = base()
  detail.submission = { ...detail.submission, status: 'pending-review', claim: null }
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
  detail.actions = { canClaim: true, canRelease: false, canDecide: false }
  serve(detail)
  view()
  expect(
    await screen.findByText('Giai đoạn AI thất bại: So sánh tương đồng. Hãy kiểm duyệt thủ công.'),
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Nhận hồ sơ' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Phê duyệt' })).toBeNull()
})

it('keeps the modal open with a reload message on a stale version', async () => {
  serve(base(), () =>
    Promise.reject(Object.assign(new Error('stale'), { status: 409, code: 'evidence_changed' })),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }))
  fireEvent.change(screen.getByLabelText(FEEDBACK_LABEL), {
    target: { value: 'Cần sửa đoạn mở đầu.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  const dialog = screen.getByRole('dialog')
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    'Hồ sơ hoặc bằng chứng AI đã thay đổi. Tải lại trước khi quyết định.',
  )
  expect(screen.getByLabelText(FEEDBACK_LABEL).value).toBe('Cần sửa đoạn mở đầu.')
  expect(screen.queryByText('Đã lưu quyết định và gửi thông báo cho tác giả.')).toBeNull()
})

it('flags partial AI coverage and truncated findings', async () => {
  const detail = base()
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
