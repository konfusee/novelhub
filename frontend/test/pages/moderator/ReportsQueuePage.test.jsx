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
const STORY_ID = '507f1f77bcf86cd799439012'
const feed = {
  items: [
    {
      id: REPORT_ID,
      version: 3,
      targetType: 'comment',
      targetId: '507f1f77bcf86cd799439013',
      reason: 'harassment',
      details: 'Lời lẽ xúc phạm',
      status: 'under-review',
      submittedAt: '2026-10-20T08:00:00.000Z',
      reporter: { displayName: 'Độc giả B' },
      snapshot: { body: 'Bình luận gây hấn', storyId: STORY_ID },
      target: {
        available: true,
        storyId: STORY_ID,
        chapterId: null,
        title: 'Truyện A',
        authorName: 'Tác giả A',
        currentStatus: 'visible',
      },
      sameTargetOpen: 2,
      claim: { mine: true, owner: 'Mod A', expiresAt: '2026-10-21T08:00:00.000Z' },
      resolution: null,
      allowedActions: ['dismiss', 'hide-comment'],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  counts: { open: 4, mine: 1, resolved: 7 },
}
const view = () =>
  render(
    <MemoryRouter initialEntries={['/moderator/reports']}>
      <LocaleProvider>
        <ReportsQueuePage />
      </LocaleProvider>
    </MemoryRouter>,
  )
const serve = post =>
  mocks.apiRequest.mockImplementation((path, options) =>
    options?.method === 'POST' ? post(path, options) : Promise.resolve(feed),
  )
const openResolve = async () => {
  expect(await screen.findByText('Bình luận gây hấn')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Xử lý' }))
  fireEvent.change(screen.getByLabelText('Lý do xử lý'), {
    target: { value: 'Ngôn từ quấy rối rõ ràng' },
  })
}

it('renders live rows and resolves with only the allowed actions', async () => {
  serve(() => Promise.resolve({ report: {} }))
  view()
  await openResolve()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/reports?status=open&page=1')
  for (const text of [
    'Truyện A',
    'Lời lẽ xúc phạm',
    'Đang mở (4)',
    '2 báo cáo mở khác cho cùng đối tượng',
  ])
    expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
  const options = screen.getAllByRole('radio').map(radio => radio.value)
  expect(options).toEqual(['dismiss', 'hide-comment'])
  fireEvent.click(screen.getByRole('radio', { name: 'Ẩn bình luận' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(dialog.querySelector('button[type="submit"]'))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(`/moderator/reports/${REPORT_ID}/resolve`, {
      method: 'POST',
      body: { action: 'hide-comment', reason: 'Ngôn từ quấy rối rõ ràng', expectedVersion: 3 },
    }),
  )
  expect(await screen.findByText('Đã xử lý báo cáo.')).toBeTruthy()
})

it('shows the conflict message on 409', async () => {
  serve(() =>
    Promise.reject(Object.assign(new Error('x'), { status: 409, code: 'report_changed' })),
  )
  view()
  await openResolve()
  fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]'))
  expect(
    await screen.findByText('Báo cáo đã thay đổi. Danh sách đã được tải lại, hãy thử lại.'),
  ).toBeTruthy()
})
