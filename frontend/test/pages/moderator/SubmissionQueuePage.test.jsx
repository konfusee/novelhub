import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { SubmissionQueuePage } from '../../../src/pages/moderator/SubmissionQueuePage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const SUBMISSION_ID = '507f1f77bcf86cd799439011'
const vietnamTime = iso =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso))
const item = overrides => ({
  submissionId: SUBMISSION_ID,
  version: 3,
  status: 'pending-review',
  targetType: 'chapter',
  title: 'Chương 1',
  storyTitle: 'Truyện A',
  author: { id: 'a1', displayName: 'Tác giả A' },
  submittedAt: '2026-10-29T00:00:00Z',
  waitingSeconds: 93784,
  evidenceStatus: 'ready',
  evidence: {
    batchId: 'b1',
    batchVersion: 5,
    state: 'ready',
    status: 'available-for-human-review',
    stage: 'llm',
    failedStage: null,
    findingsCount: 2,
    maxScore: 0.91,
    llmStatus: 'succeeded',
  },
  claimState: 'unclaimed',
  claimExpiresAt: null,
  ...overrides,
})
const feeds = {
  available: [item({ claimState: 'expired', claimExpiresAt: '2026-10-29T05:15:00Z' })],
  mine: [
    item({
      status: 'decision-pending',
      claimState: 'mine',
      claimExpiresAt: '2026-10-30T03:30:00Z',
      waitingSeconds: 7380,
    }),
  ],
  processing: [
    item({
      status: 'validated',
      evidenceStatus: 'processing',
      evidence: null,
      waitingSeconds: 300,
    }),
  ],
}
function NoticeProbe() {
  return <p>{useLocation().state?.notice}</p>
}
const view = (entry = '/moderator/submissions') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocaleProvider>
        <Routes>
          <Route path="/moderator/submissions" element={<SubmissionQueuePage />} />
          <Route path="/moderator/submissions/:submissionId" element={<NoticeProbe />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const serve = post =>
  mocks.apiRequest.mockImplementation((path, options) => {
    if (options?.method === 'POST') return post(path, options)
    const view = new URLSearchParams(path.split('?')[1]).get('view')
    return Promise.resolve({
      view,
      items: feeds[view],
      page: 1,
      pageSize: 20,
      total: 1,
      pageCount: 1,
    })
  })

it('lists waiting age, evidence state and claim expiry with time, and claims with the version', async () => {
  serve(() =>
    Promise.resolve({
      submission: { claimState: 'mine', claimExpiresAt: '2026-10-30T03:30:00Z' },
      messageId: 'SYS-MSG-MOD-01',
    }),
  )
  view()
  expect(await screen.findByText('Chương 1')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/submissions?view=available&page=1')
  for (const text of [
    'Chương · Truyện A',
    'Tác giả A',
    '2 đoạn tương đồng',
    'Sẵn sàng',
    '1 ngày 2 giờ',
  ])
    expect(screen.getByText(text)).toBeTruthy()
  expect(vietnamTime('2026-10-29T05:15:00Z')).toContain('12:15')
  expect(
    screen.getByText('Claim đã hết hạn lúc ' + vietnamTime('2026-10-29T05:15:00Z')),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Nhận hồ sơ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(`/moderator/submissions/${SUBMISSION_ID}/claim`, {
      method: 'POST',
      body: { expectedVersion: 3 },
    }),
  )
  // SYS-MSG-MOD-01 names the expiry in Vietnam time on the review page.
  expect(
    await screen.findByText(
      `Bạn đã nhận hồ sơ. Claim hết hạn lúc ${vietnamTime('2026-10-30T03:30:00Z')} (giờ Việt Nam, UTC+7).`,
    ),
  ).toBeTruthy()
})

it('shows a claim conflict instead of success', async () => {
  serve(() =>
    Promise.reject(Object.assign(new Error('conflict'), { status: 409, code: 'claim_conflict' })),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Nhận hồ sơ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Hồ sơ đang được kiểm duyệt viên khác xử lý.',
  )
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('lists my claims with their expiry and opens them for review', async () => {
  serve()
  view()
  await screen.findByText('Chương 1')
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đang giữ' }))
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.map(call => call[0])).toContain(
      '/moderator/submissions?view=mine&page=1',
    ),
  )
  expect(
    await screen.findByText('Bạn đang giữ đến ' + vietnamTime('2026-10-30T03:30:00Z')),
  ).toBeTruthy()
  expect(screen.getByText('2 giờ 3 phút')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Mở hồ sơ' }).getAttribute('href')).toBe(
    `/moderator/submissions/${SUBMISSION_ID}`,
  )
  expect(screen.queryByRole('button', { name: 'Nhận hồ sơ' })).toBeNull()
})

it('opens the view named in the URL and keeps processing submissions unopenable', async () => {
  serve()
  view('/moderator/submissions?view=processing')
  expect(await screen.findByText('Chương 1')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/submissions?view=processing&page=1')
  expect(screen.getByText('Đang xử lý')).toBeTruthy()
  expect(screen.getByText('5 phút')).toBeTruthy()
  expect(screen.getByText('Chưa thể mở: AI đang phân tích')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Mở hồ sơ' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Nhận hồ sơ' })).toBeNull()
})
