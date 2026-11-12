import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { SimilarityRiskReviewPage } from '../../../src/pages/moderator/SimilarityRiskReviewPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const finding = (id, score, queryText, sourceText) => ({
  id,
  rank: 1,
  score,
  queryPassageId: `${id}-query`,
  sourcePassageId: `${id}-source`,
  sourceChapterId: 'source-chapter',
  sourceChapterTitle: 'Chương nguồn',
  sourceStoryTitle: 'Truyện nguồn',
  queryText,
  sourceText,
})
const detail = evidence => ({
  submission: {
    id: 'sub-1',
    version: 4,
    status: 'decision-pending',
    submittedAt: '2026-10-29T00:00:00Z',
    decisionSummary: '',
    type: 'chapter',
    claimState: 'mine',
    claimExpiresAt: '2026-10-30T00:00:00Z',
    claimToken: 'token-1',
  },
  title: 'Chương kiểm duyệt',
  story: { id: 'story-1', title: 'Truyện kiểm duyệt' },
  author: { id: 'author-1', displayName: 'Tác giả A', active: true },
  evidenceStatus: 'ready',
  revision: { id: 'revision-1', version: 3, number: 1, formatVersion: 'blocks-v3' },
  packageDigest: 'digest-1',
  rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  media: [],
  chapter: { id: 'chapter-1', document: { title: 'Chương kiểm duyệt', blocks: [] } },
  evidence: {
    batch: {
      id: 'batch-1',
      version: 7,
      status: 'available-for-human-review',
      stage: 'llm',
      failedStage: null,
    },
    findingsCount: 0,
    maxScore: null,
    findingsTruncated: false,
    attempts: [],
    findings: [],
    llmReview: null,
    ...evidence,
  },
  history: [],
  actions: { canClaim: false, canRelease: true, canDecide: true },
})
const view = () =>
  render(
    <MemoryRouter initialEntries={['/moderator/similarity-review/sub-1']}>
      <LocaleProvider>
        <Routes>
          <Route
            path="/moderator/similarity-review/:reviewId"
            element={<SimilarityRiskReviewPage />}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const NO_FINDINGS = 'Không tìm thấy đoạn tương đồng trong NovelHub.'

it('shows each finding next to its source with the AI assessment', async () => {
  mocks.apiRequest.mockResolvedValue(
    detail({
      findingsCount: 2,
      maxScore: 0.87,
      attempts: [{ stage: 'comparison', status: 'succeeded' }],
      findings: [
        finding('f2', 0.62, 'Câu gửi thứ hai.', 'Câu nguồn thứ hai.'),
        finding('f1', 0.87, 'Câu gửi thứ nhất.', 'Câu nguồn thứ nhất.'),
      ],
      llmReview: {
        status: 'succeeded',
        summary: 'Tóm tắt.',
        riskLevel: 'medium',
        riskReasons: [],
        suggestions: [],
        findingAssessments: [{ findingId: 'f1', assessment: 'Đoạn f1 trùng ý với nguồn.' }],
        droppedIneligibleFindings: [],
        reviewedChars: 100,
        totalChars: 100,
      },
    }),
  )
  view()
  expect(await screen.findByText('Câu gửi thứ nhất.')).toBeTruthy()
  for (const text of [
    'Câu nguồn thứ nhất.',
    'Câu gửi thứ hai.',
    'Câu nguồn thứ hai.',
    'Điểm tương đồng 87%',
    'Đoạn f1 trùng ý với nguồn.',
  ])
    expect(screen.getByText(text)).toBeTruthy()
  expect(screen.getAllByText('Đoạn nguồn: Truyện nguồn · Chương nguồn')).toHaveLength(2)
  expect(screen.getAllByText('Nhận định của AI')).toHaveLength(1)
  const scores = screen.getAllByText(/^Điểm tương đồng \d+%$/).map(node => node.textContent)
  expect(scores).toEqual(['Điểm tương đồng 87%', 'Điểm tương đồng 62%'])
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/submissions/sub-1')
})

it('explains an empty discovery only after a succeeded comparison', async () => {
  mocks.apiRequest.mockResolvedValue(
    detail({
      attempts: [
        { stage: 'embedding', status: 'succeeded' },
        { stage: 'comparison', status: 'succeeded' },
        { stage: 'llm', status: 'succeeded' },
      ],
    }),
  )
  view()
  expect(await screen.findByText(NO_FINDINGS)).toBeTruthy()
  cleanup()
  mocks.apiRequest.mockResolvedValue(
    detail({
      batch: {
        id: 'batch-1',
        version: 8,
        status: 'failed',
        stage: 'embedding',
        failedStage: 'embedding',
      },
      attempts: [{ stage: 'embedding', status: 'failed' }],
    }),
  )
  view()
  expect(
    await screen.findByText(
      'Chưa có kết quả so sánh tương đồng; không thể kết luận là không trùng lặp.',
    ),
  ).toBeTruthy()
  expect(screen.queryByText(NO_FINDINGS)).toBeNull()
})

it('asks for a claim before showing evidence to a moderator who does not hold it', async () => {
  const { submission, title, story, author, evidenceStatus } = detail({})
  mocks.apiRequest.mockResolvedValue({
    submission: {
      ...submission,
      claimState: 'unclaimed',
      claimExpiresAt: null,
      claimToken: undefined,
    },
    title,
    story,
    author,
    evidenceStatus,
    actions: { canClaim: true, canRelease: false, canDecide: false },
  })
  view()
  expect(
    await screen.findByText(
      'Nhận hồ sơ để xem đúng phiên bản đã gửi, khai báo quyền và bằng chứng AI đã lưu.',
    ),
  ).toBeTruthy()
  expect(screen.getByText('Chương kiểm duyệt')).toBeTruthy()
  expect(screen.queryByText(NO_FINDINGS)).toBeNull()
})
