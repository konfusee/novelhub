import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ModeratorOverviewPage } from '../../../src/pages/moderator/ModeratorOverviewPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const MINE_ID = '507f1f77bcf86cd799439011'
const OLDEST_ID = '507f1f77bcf86cd799439012'
const item = (submissionId, title, extra) => ({
  submissionId,
  version: 3,
  targetType: 'chapter',
  title,
  storyTitle: 'Truyện chờ',
  author: { id: 'a1', displayName: 'Tác giả A' },
  submittedAt: '2026-11-10T00:00:00Z',
  waitingSeconds: 10800,
  evidenceStatus: 'ready',
  claimState: 'unclaimed',
  claimExpiresAt: null,
  ...extra,
})
const overview = {
  counters: { claimable: 3, mine: 1, processing: 2, decidedToday: 4, claimableReports: 5 },
  oldestWaiting: [item(OLDEST_ID, 'Chương chờ lâu', { waitingSeconds: 93600 })],
  nextItems: [
    item(MINE_ID, 'Chương tôi giữ', {
      claimState: 'mine',
      claimExpiresAt: '2026-11-11T10:00:00Z',
    }),
    item(OLDEST_ID, 'Chương chờ lâu', { waitingSeconds: 93600 }),
  ],
  recentDecisions: [
    {
      historyId: 'h1',
      occurredAt: '2026-11-11T03:00:00Z',
      outcome: 'approved',
      targetTitle: 'Chương đã duyệt',
    },
  ],
  computedAt: '2026-11-11T05:00:00Z',
}
const renderPage = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ModeratorOverviewPage />
      </LocaleProvider>
    </MemoryRouter>,
  )

it('shows every live counter, including claimable reports, with a link to its queue view', async () => {
  mocks.apiRequest.mockResolvedValue(overview)
  renderPage()
  const counters = await screen.findByRole('list', { name: 'Bộ đếm kiểm duyệt' })
  for (const [label, value, href] of [
    ['Hồ sơ có thể nhận', '3', '/moderator/submissions?view=available'],
    ['Tôi đang giữ', '1', '/moderator/submissions?view=mine'],
    ['Đang chờ AI', '2', '/moderator/submissions?view=processing'],
    ['Báo cáo có thể nhận', '5', '/moderator/reports?view=queue'],
  ]) {
    const link = within(counters).getByRole('link', { name: new RegExp(label) })
    expect(link.getAttribute('href')).toBe(href)
    expect(within(link).getByText(value)).toBeTruthy()
  }
  const decided = within(counters).getByRole('link', { name: /Tôi đã quyết định hôm nay/ })
  expect(within(decided).getByText('4')).toBeTruthy()
  expect(decided.getAttribute('href')).toMatch(
    /^\/moderator\/history\?scope=mine&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/,
  )
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/overview')
})

it('lists my live claims first, the waiting age and my recent decisions', async () => {
  mocks.apiRequest.mockResolvedValue(overview)
  renderPage()
  const next = (await screen.findByRole('heading', { name: 'Việc tiếp theo' })).closest('section')
  const titles = within(next)
    .getAllByRole('link')
    .filter(link => link.getAttribute('href').startsWith('/moderator/submissions/'))
  expect(titles.map(link => link.textContent)).toEqual(['Chương tôi giữ', 'Chương chờ lâu'])
  expect(titles[0].getAttribute('href')).toBe(`/moderator/submissions/${MINE_ID}`)
  expect(within(next).getByText(/^Tôi giữ đến /)).toBeTruthy()
  const oldest = screen.getByRole('heading', { name: 'Hồ sơ chờ lâu nhất' }).closest('section')
  expect(within(oldest).getByText('Đã chờ 1 ngày 2 giờ')).toBeTruthy()
  expect(within(oldest).getByText('Chưa có người nhận')).toBeTruthy()
  const recent = screen
    .getByRole('heading', { name: 'Quyết định gần đây của tôi' })
    .closest('section')
  expect(within(recent).getByText('Chương đã duyệt')).toBeTruthy()
  expect(within(recent).getByText('Đã phê duyệt')).toBeTruthy()
})

it('shows zero counters and empty lists as a valid result (AF1)', async () => {
  mocks.apiRequest.mockResolvedValue({
    counters: { claimable: 0, mine: 0, processing: 0, decidedToday: 0, claimableReports: 0 },
    oldestWaiting: [],
    nextItems: [],
    recentDecisions: [],
    computedAt: '2026-11-11T05:00:00Z',
  })
  renderPage()
  const counters = await screen.findByRole('list', { name: 'Bộ đếm kiểm duyệt' })
  expect(within(counters).getAllByText('0')).toHaveLength(5)
  expect(screen.getAllByText('Không có bản ghi nào phù hợp với tiêu chí đã chọn.')).toHaveLength(3)
})

it('shows no partial counters when the overview cannot be computed (EX1)', async () => {
  mocks.apiRequest.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
  renderPage()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText('Không thể hoàn tất thao tác. Vui lòng thử lại.')).toBeTruthy()
  expect(screen.queryByRole('list', { name: 'Bộ đếm kiểm duyệt' })).toBeNull()
})
