import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { PlatformFinanceReport } from '../../../src/components/admin/PlatformFinanceReport'

const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('uses applied Vietnam date boundaries and renders server grouped totals', async () => {
  api.mockImplementation(path =>
    Promise.resolve(
      path.includes('report-options')
        ? { authors: [], stories: [], chapters: [], policies: [] }
        : {
            summary: {
              registeredAccounts: 2,
              purchasedChapters: 1,
              unlockCoins: 1000,
              topUpCoins: 50000,
              authorCoins: 700,
              platformCoins: 300,
            },
            registrations: [{ bucket: '2026-11', status: 'active', count: 2 }],
            balances: [],
            bank: [],
            payouts: [],
            unlocks: [{ id: 'chapter', label: 'Chương đã thanh toán', count: 1, coins: 1000 }],
            hasMore: false,
            totalGroups: 1,
          },
    ),
  )
  render(
    <LocaleProvider>
      <PlatformFinanceReport />
    </LocaleProvider>,
  )
  expect(await screen.findByText('Chương đã thanh toán')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } })
  fireEvent.change(screen.getByLabelText('Đến hết ngày'), { target: { value: '2026-10-31' } })
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
  await waitFor(() =>
    expect(
      api.mock.calls.some(([path]) => {
        const query = new URLSearchParams(path.split('?')[1])
        return (
          query.get('from') === '2026-09-30T17:00:00.000Z' &&
          query.get('to') === '2026-10-31T17:00:00.000Z'
        )
      }),
    ).toBe(true),
  )
})
