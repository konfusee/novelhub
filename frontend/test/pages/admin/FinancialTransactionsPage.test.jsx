import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { FinancialTransactionsPage } from '../../../src/pages/admin/FinancialTransactionsPage'

const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const stats = {
  registeredAccounts: 25,
  purchasedChapters: 10,
  unlockCoins: 10000,
  unresolvedPayments: 1,
}
function view() {
  render(
    <LocaleProvider>
      <FinancialTransactionsPage />
    </LocaleProvider>,
  )
}

it('renders backend ledger and applies Vietnam date boundaries to the API', async () => {
  api.mockImplementation(path =>
    Promise.resolve(
      path.includes('/statistics')
        ? stats
        : {
            items: [
              {
                id: 'entry',
                owner: 'Tác giả thật',
                type: 'allocation-credit',
                direction: 'credit',
                amount: 700,
                purpose: 'author-earnings',
                walletId: 'wallet',
                occurredAt: '2026-11-10T00:00:00Z',
              },
            ],
            hasMore: false,
          },
    ),
  )
  view()
  expect(await screen.findByText('Tác giả thật')).toBeTruthy()
  expect(await screen.findByText('25')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Đến hết ngày'), { target: { value: '2026-11-10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
  await waitFor(() =>
    expect(
      api.mock.calls.some(([path]) => {
        const params = new URLSearchParams(path.split('?')[1])
        return (
          params.get('from') === '2026-10-31T17:00:00.000Z' &&
          params.get('to') === '2026-11-10T17:00:00.000Z'
        )
      }),
    ).toBe(true),
  )
})

it('does not replace failed backend calls with fake rows or counts', async () => {
  api.mockResolvedValue({ items: 'invalid' })
  view()
  expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0)
  expect(screen.queryByText('Tác giả thật')).toBeNull()
})
