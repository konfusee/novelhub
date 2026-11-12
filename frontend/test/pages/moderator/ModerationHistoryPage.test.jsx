import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ModerationHistoryPage } from '../../../src/pages/moderator/ModerationHistoryPage'

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
const moderator = { id: 'm1', displayName: 'Kiểm duyệt viên A' }
const page = {
  items: [
    {
      historyId: 'h-report',
      occurredAt: '2026-11-10T17:00:00Z',
      moderator,
      caseType: 'report',
      targetType: 'comment',
      targetTitle: 'Bình luận xấu',
      outcome: 'comment-hidden',
      feedbackOrReason: 'Ngôn từ quấy rối.',
    },
    {
      historyId: 'h-rejected',
      occurredAt: '2026-11-10T10:00:00Z',
      moderator,
      caseType: 'publication',
      targetType: 'story',
      targetTitle: 'Truyện A',
      outcome: 'rejected',
      feedbackOrReason: 'Cần sửa phần tóm tắt.',
    },
    {
      historyId: 'h-cancelled',
      occurredAt: '2026-11-09T10:00:00Z',
      moderator: { id: 'admin', displayName: 'Quản trị viên' },
      caseType: 'publication',
      targetType: 'chapter',
      targetTitle: 'Chương 2',
      outcome: 'cancelled',
      feedbackOrReason: 'account-deleted',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 3,
}
const reportDetail = {
  ...page.items[0],
  publication: null,
  report: {
    reportId: REPORT_ID,
    reason: 'harassment',
    details: 'Lời lẽ xúc phạm',
    snapshot: { body: 'Bình luận xấu' },
    action: 'hide-comment',
    contentChanged: true,
  },
}
const requested = () => mocks.apiRequest.mock.calls.map(call => call[0])
const choose = (field, option) => {
  fireEvent.click(screen.getByRole('combobox', { name: field }))
  fireEvent.click(screen.getByRole('option', { name: option }))
}
const renderPage = (entry = '/moderator/history') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocaleProvider>
        <ModerationHistoryPage />
      </LocaleProvider>
    </MemoryRouter>,
  )

it('lists publication decisions, cancellations and report resolutions with their reasons', async () => {
  mocks.apiRequest.mockResolvedValue(page)
  renderPage()
  expect(await screen.findByText('Bình luận xấu')).toBeTruthy()
  expect(requested()).toEqual(['/moderator/history?scope=all&page=1'])
  for (const text of [
    'Đã ẩn bình luận',
    'Ngôn từ quấy rối.',
    'Đã từ chối',
    'Cần sửa phần tóm tắt.',
    'Đã hủy',
    'Tài khoản tác giả đã bị xóa.',
    'Quản trị viên',
  ])
    expect(within(screen.getByRole('table')).getByText(text)).toBeTruthy()
})

it('filters by scope, case type, matching outcome and date range', async () => {
  mocks.apiRequest.mockResolvedValue(page)
  renderPage()
  await screen.findByText('Bình luận xấu')
  fireEvent.click(screen.getByRole('button', { name: 'Của tôi' }))
  await waitFor(() => expect(requested()).toContain('/moderator/history?scope=mine&page=1'))
  choose('Loại hồ sơ', 'Báo cáo')
  await waitFor(() =>
    expect(requested()).toContain('/moderator/history?scope=mine&caseType=report&page=1'),
  )
  fireEvent.click(screen.getByRole('combobox', { name: 'Kết quả' }))
  // Only report outcomes are offered for the report case type.
  expect(screen.queryByRole('option', { name: 'Đã phê duyệt' })).toBeNull()
  fireEvent.click(screen.getByRole('option', { name: 'Đã gỡ xuất bản chương' }))
  await waitFor(() =>
    expect(requested()).toContain(
      '/moderator/history?scope=mine&caseType=report&outcome=chapter-unpublished&page=1',
    ),
  )
  // A publication case type drops the report outcome.
  choose('Loại hồ sơ', 'Xuất bản')
  await waitFor(() =>
    expect(requested()).toContain('/moderator/history?scope=mine&caseType=publication&page=1'),
  )
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-10' } })
  await waitFor(() =>
    expect(requested()).toContain(
      '/moderator/history?scope=mine&caseType=publication&from=2026-11-01&to=2026-11-10&page=1',
    ),
  )
})

it('starts from the filters in the link, as the overview counter sends them', async () => {
  mocks.apiRequest.mockResolvedValue(page)
  renderPage('/moderator/history?scope=mine&from=2026-11-11&to=2026-11-11')
  await screen.findByText('Bình luận xấu')
  expect(requested()).toEqual([
    '/moderator/history?scope=mine&from=2026-11-11&to=2026-11-11&page=1',
  ])
})

it('opens an entry with its reported snapshot, action and content change', async () => {
  mocks.apiRequest.mockImplementation(path =>
    Promise.resolve(path.startsWith('/moderator/history/') ? reportDetail : page),
  )
  renderPage()
  await screen.findByText('Bình luận xấu')
  fireEvent.click(screen.getAllByRole('button', { name: 'Xem chi tiết' })[0])
  const dialog = await screen.findByRole('dialog', { name: 'Chi tiết lịch sử kiểm duyệt' })
  await within(dialog).findByText('Lời lẽ xúc phạm')
  expect(requested()).toContain('/moderator/history/h-report')
  for (const text of ['Quấy rối hoặc xúc phạm', 'Ẩn bình luận', 'Có, nội dung đã bị hạn chế.'])
    expect(within(dialog).getByText(text)).toBeTruthy()
  expect(within(dialog).getByRole('link', { name: 'Mở báo cáo' }).getAttribute('href')).toBe(
    `/moderator/reports/${REPORT_ID}`,
  )
})

it('shows the empty-result message (AF1) and the invalid-filter message (EX1)', async () => {
  mocks.apiRequest.mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0 })
  renderPage()
  expect(await screen.findByText('Không có bản ghi nào phù hợp với tiêu chí đã chọn.')).toBeTruthy()
  mocks.apiRequest.mockRejectedValueOnce(
    Object.assign(new Error('invalid'), { status: 422, code: 'validation_error' }),
  )
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-10' } })
  expect(
    await screen.findByText(
      'Một số giá trị không hợp lệ. Hãy kiểm tra lại bộ lọc, ví dụ ngày bắt đầu không được sau ngày kết thúc.',
    ),
  ).toBeTruthy()
})
