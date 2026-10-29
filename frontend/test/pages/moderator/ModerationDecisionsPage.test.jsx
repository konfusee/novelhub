import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ModerationDecisionsPage } from '../../../src/pages/moderator/ModerationDecisionsPage'

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
const feed = {
  items: [
    {
      id: 'h1',
      submissionId: SUBMISSION_ID,
      revisionId: 'r1',
      title: 'Thông tin truyện A',
      type: 'story',
      outcome: 'rejected',
      feedback: 'Cần sửa phần tóm tắt.',
      occurredAt: '2026-10-29T00:00:00Z',
      moderator: { id: 'm1', displayName: 'Kiểm duyệt viên A' },
      mine: false,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  pageCount: 1,
}
const requested = () => mocks.apiRequest.mock.calls.map(call => call[0])

it('lists all decisions and filters mine and rejected outcomes', async () => {
  mocks.apiRequest.mockResolvedValue(feed)
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ModerationDecisionsPage />
      </LocaleProvider>
    </MemoryRouter>,
  )
  expect(await screen.findByText('Cần sửa phần tóm tắt.')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe(
    '/moderator/decisions?outcome=all&scope=all&page=1',
  )
  expect(screen.getByRole('link', { name: 'Xem gói duyệt' }).getAttribute('href')).toBe(
    `/moderator/submissions/${SUBMISSION_ID}`,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Quyết định của tôi' }))
  await waitFor(() =>
    expect(requested()).toContain('/moderator/decisions?outcome=all&scope=mine&page=1'),
  )
  await screen.findByText('Cần sửa phần tóm tắt.')
  fireEvent.click(screen.getByRole('combobox', { name: 'Kết quả' }))
  fireEvent.click(screen.getByRole('option', { name: 'Từ chối' }))
  await waitFor(() =>
    expect(requested()).toContain('/moderator/decisions?outcome=rejected&scope=mine&page=1'),
  )
})
