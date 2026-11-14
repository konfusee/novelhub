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
function setup() {
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
            balances: [{ purpose: 'system-earnings', count: 1, balanceCoins: 8400 }],
            ledger: [
              {
                bucket: '2026-11',
                purpose: 'system-earnings',
                type: 'allocation-credit',
                count: 1,
                creditCoins: 300,
                debitCoins: 0,
                netCoins: 300,
              },
            ],
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
}
it('opens a compact overview and only requests advanced options when needed', async () => {
  setup()
  expect(await screen.findByText('Hoạt động trong kỳ')).toBeTruthy()
  expect(screen.getByRole('table').closest('details').open).toBe(false)
  expect(screen.queryByLabelText('Loại ví')).toBeNull()
  expect(api.mock.calls.some(([path]) => path.includes('report-options'))).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Mua chương', exact: true }))
  expect(await screen.findByText('Chương đã thanh toán')).toBeTruthy()
  expect(screen.queryByLabelText('Tác giả')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Lọc theo tác giả, truyện…' }))
  expect(await screen.findByLabelText('Tác giả')).toBeTruthy()
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('report-options'))).toBe(true),
  )
})
it('uses applied Vietnam date boundaries and renders server grouped totals', async () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Mua chương', exact: true }))
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

it('keeps wallet filters out of purchases and separates current balance from period movements', async () => {
  setup()
  await screen.findByText('Hoạt động trong kỳ')
  fireEvent.click(screen.getByRole('button', { name: 'Ví và biến động', exact: true }))
  fireEvent.click(screen.getByLabelText('Loại ví'))
  fireEvent.click(screen.getByRole('option', { name: 'Ví doanh thu nền tảng', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
  expect(await screen.findByText('8.400')).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Xu vào' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Xu ra' })).toBeTruthy()
  expect(screen.queryByLabelText('Trạng thái ngân hàng')).toBeNull()
  expect(api.mock.calls.at(-1)[0]).toContain('walletPurpose=system-earnings')
  fireEvent.click(screen.getByRole('button', { name: 'Mua chương', exact: true }))
  await screen.findByText('Chương đã thanh toán')
  expect(api.mock.calls.at(-1)[0]).not.toContain('walletPurpose')
  fireEvent.click(screen.getByRole('button', { name: 'Nạp xu', exact: true }))
  expect(screen.getByLabelText('Trạng thái ngân hàng')).toBeTruthy()
  expect(screen.queryByLabelText('Loại ví')).toBeNull()
})
