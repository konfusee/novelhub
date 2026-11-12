import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { PendingTopUps } from '../../../src/components/reader/PendingTopUps'

const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('warns against a second payment and opens the existing order, including pagination', async () => {
  api.mockImplementation(path =>
    Promise.resolve({
      items: path.includes('page=2')
        ? []
        : [
            {
              id: 'existing-order',
              paymentCode: 'NH12345678',
              priceVnd: 50000,
              status: 'pending',
              reviewState: 'pending-review',
              expiresAt: '2026-11-11T12:00:00Z',
            },
          ],
      hasMore: !path.includes('page=2'),
    }),
  )
  const open = vi.fn()
  render(
    <LocaleProvider>
      <PendingTopUps onOpen={open} />
    </LocaleProvider>,
  )
  expect(await screen.findByText(/Không chuyển lại tiền/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Xem đơn' }))
  expect(open).toHaveBeenCalledWith('existing-order')
  fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
  await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('page=2'))).toBe(true))
  expect(await screen.findByText('Không có đơn nạp đang chờ.')).toBeTruthy()
})
