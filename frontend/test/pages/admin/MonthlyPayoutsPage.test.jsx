import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { MonthlyPayoutsPage } from '../../../src/pages/admin/MonthlyPayoutsPage'

const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }))
vi.mock('../../../src/components/admin/AuthorRevenuePanel', () => ({
  AuthorRevenuePanel: () => null,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('shows automatic runs and simulated outcomes without any manual payout commands', async () => {
  api.mockImplementation(path =>
    Promise.resolve(
      path.includes('/runs')
        ? {
            items: [
              {
                id: 'run',
                periodId: '2026-11',
                status: 'completed',
                totalCount: 1,
                paidCount: 1,
                pendingCount: 0,
                totalCoins: 150000,
              },
            ],
            hasMore: false,
          }
        : {
            items: [
              {
                withdrawalId: 'withdrawal',
                displayName: 'Nguyễn Văn An',
                periodId: '2026-11',
                amountCoins: 150000,
                payoutSlipAmountVnd: 150000,
                status: 'paid',
                bankDetails: null,
                latestResult: {
                  result: 'Paid',
                  executionMode: 'simulation',
                  transferReference: 'SIM-AUTO-123',
                },
              },
            ],
            hasMore: false,
            totalItems: 1,
          },
    ),
  )
  render(
    <LocaleProvider>
      <MonthlyPayoutsPage />
    </LocaleProvider>,
  )
  expect(await screen.findByText('Nguyễn Văn An')).toBeTruthy()
  expect(await screen.findByText('Kết quả thanh toán giả lập')).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: /Lập danh sách|Ghi nhận đã chuyển|Ghi nhận thất bại/ }),
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '2026-11' }))
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('periodId=2026-11'))).toBe(true),
  )
  expect(api.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(
    true,
  )
})
