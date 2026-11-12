import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ReportsQueuePage } from '../../../src/pages/moderator/ReportsQueuePage'

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
const vietnamTime = iso =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso))
const report = overrides => ({
  reportId: REPORT_ID,
  version: 2,
  targetType: 'comment',
  targetTitle: 'Bình luận gây hấn',
  reason: 'harassment',
  reporter: { id: 'reader-1', displayName: 'Độc giả A' },
  reportedAt: '2026-10-29T01:00:00Z',
  claimState: 'unclaimed',
  claimExpiresAt: null,
  ...overrides,
})
const feeds = {
  queue: [report({ claimState: 'expired', claimExpiresAt: '2026-10-29T02:45:00Z' })],
  mine: [report({ claimState: 'mine', claimExpiresAt: '2026-10-30T04:20:00Z' })],
}
const view = (entry = '/moderator/reports') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocaleProvider>
        <ReportsQueuePage />
      </LocaleProvider>
    </MemoryRouter>,
  )
const serve = () =>
  mocks.apiRequest.mockImplementation(path => {
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

it('lists the queue with Vietnamese labels, claim expiry with time and a link to the report', async () => {
  serve()
  view()
  expect(await screen.findByText('Bình luận gây hấn')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/reports?view=queue&page=1')
  expect(screen.getAllByText('Bình luận').length).toBeGreaterThan(0)
  expect(screen.getByText('Quấy rối')).toBeTruthy()
  expect(
    screen.getByText('Báo cáo bởi Độc giả A · ' + vietnamTime('2026-10-29T01:00:00Z')),
  ).toBeTruthy()
  expect(vietnamTime('2026-10-29T02:45:00Z')).toContain('09:45')
  expect(
    screen.getByText('Claim đã hết hạn lúc ' + vietnamTime('2026-10-29T02:45:00Z')),
  ).toBeTruthy()
  for (const raw of ['comment', 'harassment', 'expired']) expect(screen.queryByText(raw)).toBeNull()
  expect(screen.getByRole('link', { name: 'Xem báo cáo' }).getAttribute('href')).toBe(
    `/moderator/reports/${REPORT_ID}`,
  )
})

it('filters by target type and switches to my claims', async () => {
  serve()
  view()
  await screen.findByText('Bình luận gây hấn')
  fireEvent.click(screen.getByRole('combobox', { name: 'Loại đối tượng' }))
  fireEvent.click(screen.getByRole('option', { name: 'Chương' }))
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.map(call => call[0])).toContain(
      '/moderator/reports?view=queue&targetType=chapter&page=1',
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đang giữ' }))
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.map(call => call[0])).toContain(
      '/moderator/reports?view=mine&targetType=chapter&page=1',
    ),
  )
  expect(
    await screen.findByText('Bạn đang giữ đến ' + vietnamTime('2026-10-30T04:20:00Z')),
  ).toBeTruthy()
})

it('opens the view named in the URL', async () => {
  serve()
  view('/moderator/reports?view=mine')
  expect(await screen.findByText('Bình luận gây hấn')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/reports?view=mine&page=1')
})

it('shows the empty message when nothing matches', async () => {
  mocks.apiRequest.mockResolvedValue({
    view: 'queue',
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 0,
  })
  view()
  expect(await screen.findByText('Không có báo cáo nào phù hợp với tiêu chí đã chọn.')).toBeTruthy()
})
