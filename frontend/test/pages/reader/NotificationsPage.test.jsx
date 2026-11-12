import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { NotificationsPage } from '../../../src/pages/reader/NotificationsPage'
import { NOTIFICATIONS_CHANGED } from '../../../src/api/notificationEvents'

const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
vi.mock('../../../src/layouts', () => ({ ReaderLayout: ({ children }) => <main>{children}</main> }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const notice = {
  id: 'topup-notice',
  title: 'Nạp xu thành công',
  body: 'Đã cộng 50.000 xu vào ví của bạn.',
  href: '/reader/wallet',
  action: 'Xem ví',
  createdAt: '2026-11-12T10:00:00Z',
  type: 'system',
  label: 'Ví & giao dịch',
  unread: true,
  read: false,
}
function view() {
  render(
    <LocaleProvider>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </LocaleProvider>,
  )
}

it('renders the financial notice and refreshes the bell when marking it read', async () => {
  api.mockResolvedValue({ items: [notice], unreadCount: 1, hasMore: false })
  const changed = vi.fn()
  window.addEventListener(NOTIFICATIONS_CHANGED, changed)
  try {
    view()
    expect(await screen.findByText('Đã cộng 50.000 xu vào ví của bạn.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem ví' }).getAttribute('href')).toBe('/reader/wallet')
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
    expect(screen.getByText('Bạn đã đọc hết thông báo.')).toBeTruthy()
  } finally {
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed)
  }
})

it('loads notifications arriving while the page is open when focus returns', async () => {
  api
    .mockResolvedValueOnce({ items: [], unreadCount: 0, hasMore: false })
    .mockResolvedValue({ items: [notice], unreadCount: 1, hasMore: false })
  view()
  await screen.findByText('Bạn đã đọc hết thông báo.')
  fireEvent.focus(window)
  expect(await screen.findByText('Nạp xu thành công')).toBeTruthy()
})

it.each([
  ['Đã duyệt: Hành trình dưới ánh sao', 'Nội dung đủ điều kiện.'],
  ['Cần chỉnh sửa: Hành trình dưới ánh sao', 'Cần làm rõ phần mô tả trước khi gửi lại.'],
])('shows publication decision %s in the Author workspace', async (title, feedback) => {
  api.mockResolvedValue({
    items: [
      {
        ...notice,
        id: 'publication-decision',
        title,
        body: feedback,
        type: 'author',
        label: 'Tác giả',
        href: '/author/submissions',
        action: 'Xem kết quả',
      },
    ],
    unreadCount: 1,
    hasMore: false,
  })
  render(
    <LocaleProvider>
      <MemoryRouter>
        <NotificationsPage embedded workspace="author" />
      </MemoryRouter>
    </LocaleProvider>,
  )
  expect(await screen.findByText(title)).toBeTruthy()
  expect(screen.getByText(feedback)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Xem kết quả' }).getAttribute('href')).toBe(
    '/author/submissions',
  )
})
