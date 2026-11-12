import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ModerationStatisticsPage } from '../../../src/pages/moderator/ModerationStatisticsPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const MODERATOR_ID = '507f1f77bcf86cd799439011'
// Vietnam days 10 and 11 November 2026 start at 17:00 UTC of the previous day.
const DAY_10 = '2026-11-09T17:00:00.000Z'
const DAY_11 = '2026-11-10T17:00:00.000Z'
const statistics = {
  period: {
    from: DAY_10,
    to: '2026-11-11T05:00:00.000Z',
    bucket: 'day',
    buckets: [DAY_10, DAY_11],
  },
  queueAge: { count: 4, oldest: 36000, median: 9000, p90: 36000 },
  decisionBuckets: [
    {
      start: DAY_10,
      group: null,
      approved: 2,
      rejected: 1,
      approvedRate: 66.7,
      rejectedRate: 33.3,
    },
    {
      start: DAY_11,
      group: null,
      approved: 0,
      rejected: 0,
      approvedRate: null,
      rejectedRate: null,
    },
  ],
  moderatorDecisions: [
    {
      moderator: { id: MODERATOR_ID, displayName: 'Kiểm duyệt viên A' },
      decisions: 3,
      medianClaimToDecision: 1200,
    },
  ],
  reportBuckets: [
    { start: DAY_11, targetType: 'comment', reason: 'harassment', received: 2 },
    { start: DAY_11, targetType: 'story', reason: 'spam', received: 1 },
  ],
  resolutionBuckets: [{ start: DAY_11, outcome: 'comment-hidden', resolved: 2 }],
  aiAgreement: {
    overall: 66.7,
    byRiskLevel: { low: 100, medium: null, high: 100 },
    qualifying: 3,
    agreeing: 2,
    succeededWithoutRiskLevel: 1,
    withoutLlmReview: 1,
  },
  definitions: {
    queueAge: 'Định nghĩa tuổi hàng đợi.',
    decisionBuckets: 'Định nghĩa quyết định.',
    moderatorDecisions: 'Định nghĩa theo kiểm duyệt viên.',
    reportBuckets: 'Định nghĩa báo cáo nhận được.',
    resolutionBuckets: 'Định nghĩa báo cáo đã xử lý.',
    aiAgreement: 'Định nghĩa đồng thuận AI.',
  },
}
const requested = () => mocks.apiRequest.mock.calls.map(call => call[0])
const choose = (field, option) => {
  fireEvent.click(screen.getByRole('combobox', { name: field }))
  fireEvent.click(screen.getByRole('option', { name: option }))
}
const renderPage = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ModerationStatisticsPage />
      </LocaleProvider>
    </MemoryRouter>,
  )
const section = name => screen.getByRole('heading', { name }).closest('section')

it('shows every figure of the period with its definition', async () => {
  mocks.apiRequest.mockResolvedValue(statistics)
  renderPage()
  await screen.findByRole('heading', { name: 'Tuổi hàng đợi' })
  expect(requested()).toEqual(['/moderator/statistics?period=last30&bucket=day&moderator=all'])
  const queue = section('Tuổi hàng đợi')
  for (const text of ['4', '2 giờ 30 phút', 'Định nghĩa tuổi hàng đợi.'])
    expect(within(queue).getByText(text)).toBeTruthy()
  // The oldest age and the 90th percentile are both 10 hours.
  expect(within(queue).getAllByText('10 giờ')).toHaveLength(2)
  const decisions = section('Quyết định xuất bản')
  expect(within(decisions).getByText('Tổng trong kỳ: 2 phê duyệt, 1 từ chối.')).toBeTruthy()
  expect(within(decisions).getByText('66,7%')).toBeTruthy()
  // A bucket without decisions shows zero and an unavailable rate (AF2).
  expect(within(decisions).getAllByText('Không có dữ liệu')).toHaveLength(2)
  const moderators = section('Quyết định theo kiểm duyệt viên')
  expect(within(moderators).getByText('Kiểm duyệt viên A')).toBeTruthy()
  expect(within(moderators).getByText('20 phút')).toBeTruthy()
  const reports = section('Báo cáo nhận được')
  const byTarget = within(reports).getByRole('table', { name: 'Theo loại nội dung' })
  const rows = within(byTarget).getAllByRole('row')
  expect(rows).toHaveLength(3)
  const cells = row =>
    within(row)
      .getAllByRole('cell')
      .map(cell => cell.textContent)
  expect(cells(rows[1]).slice(1)).toEqual(['0', '0', '0', '0'])
  expect(cells(rows[2])).toEqual([expect.stringContaining('11'), '1', '0', '2', '3'])
  const resolutions = section('Báo cáo đã xử lý theo kết quả')
  expect(within(resolutions).getByText('Đã ẩn bình luận')).toBeTruthy()
  const ai = section('Đồng thuận giữa quyết định và AI')
  expect(within(ai).getByText('66,7%')).toBeTruthy()
  expect(within(ai).getByText('Rủi ro: Trung bình').nextElementSibling.textContent).toBe(
    'Không có dữ liệu',
  )
  const figure = label => within(ai).getByText(label).nextElementSibling.textContent
  expect(figure('Quyết định có đánh giá LLM thành công')).toBe('3')
  expect(figure('Đánh giá LLM thành công nhưng không có mức rủi ro')).toBe('1')
  expect(figure('Quyết định không có đánh giá LLM thành công')).toBe('1')
  expect(within(ai).getByText('Định nghĩa đồng thuận AI.')).toBeTruthy()
})

it('offers exactly the groupings the API accepts and totals only the filtered outcome', async () => {
  mocks.apiRequest.mockResolvedValue(statistics)
  renderPage()
  await screen.findByRole('heading', { name: 'Tuổi hàng đợi' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Nhóm quyết định theo' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
    'Không nhóm',
    'Kết quả',
    'Kiểm duyệt viên',
    'Loại nội dung',
    'Mức rủi ro AI',
  ])
  fireEvent.click(screen.getByRole('option', { name: 'Không nhóm' }))
  choose('Kết quả quyết định', 'Đã phê duyệt')
  await waitFor(() =>
    expect(requested()).toContain(
      '/moderator/statistics?period=last30&bucket=day&outcome=approved&moderator=all',
    ),
  )
  expect(await screen.findByText('Tổng trong kỳ (Đã phê duyệt): 2.')).toBeTruthy()
})

it('recomputes when the bucket, grouping or moderator changes (AF1)', async () => {
  mocks.apiRequest.mockResolvedValue(statistics)
  renderPage()
  await screen.findByRole('heading', { name: 'Tuổi hàng đợi' })
  choose('Đơn vị thời gian', 'Tuần')
  await waitFor(() =>
    expect(requested()).toContain('/moderator/statistics?period=last30&bucket=week&moderator=all'),
  )
  choose('Nhóm quyết định theo', 'Mức rủi ro AI')
  await waitFor(() =>
    expect(requested()).toContain(
      '/moderator/statistics?period=last30&bucket=week&groupBy=riskLevel&moderator=all',
    ),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Chỉ xem người này' }))
  await waitFor(() =>
    expect(requested()).toContain(
      `/moderator/statistics?period=last30&bucket=week&groupBy=riskLevel&moderator=one&moderatorId=${MODERATOR_ID}`,
    ),
  )
  expect(screen.getByRole('combobox', { name: 'Kiểm duyệt viên' }).textContent).toContain(
    'Kiểm duyệt viên A',
  )
})

it('asks for both custom dates before computing, then sends them', async () => {
  mocks.apiRequest.mockResolvedValue(statistics)
  renderPage()
  await screen.findByRole('heading', { name: 'Tuổi hàng đợi' })
  choose('Kỳ thống kê', 'Khoảng ngày tùy chọn')
  expect(
    await screen.findByText('Hãy chọn đủ ngày bắt đầu và ngày kết thúc trước khi tiếp tục.'),
  ).toBeTruthy()
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-03' } })
  await waitFor(() =>
    expect(requested()).toContain(
      '/moderator/statistics?period=custom&bucket=day&from=2026-11-01&to=2026-11-03&moderator=all',
    ),
  )
})

it('computes nothing for an invalid period (EX1) and no partial figures on failure (EX2)', async () => {
  mocks.apiRequest.mockRejectedValueOnce(
    Object.assign(new Error('invalid'), { status: 422, code: 'invalid_period' }),
  )
  renderPage()
  expect(
    await screen.findByText(
      'Một số giá trị không hợp lệ: ngày bắt đầu sau ngày kết thúc hoặc ngày kết thúc ở tương lai. Không có số liệu nào được tính.',
    ),
  ).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Tuổi hàng đợi' })).toBeNull()
  mocks.apiRequest.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }))
  expect(await screen.findByText('Không thể hoàn tất thao tác. Vui lòng thử lại.')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Tuổi hàng đợi' })).toBeNull()
})
