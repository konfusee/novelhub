import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { AuthorBankDetailsForm } from '../../../src/components/author/AuthorBankDetailsForm'
import { PayoutBankCorrectionForm } from '../../../src/components/admin/PayoutBankCorrectionForm'

const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('shows a masked account as a placeholder and submits only the re-entered number', async () => {
  api.mockResolvedValue({
    bankDetails: { bankName: 'TPBank', accountNumber: '••••6789', accountHolder: 'AUTHOR' },
  })
  render(
    <LocaleProvider>
      <AuthorBankDetailsForm />
    </LocaleProvider>,
  )
  const number = await screen.findByPlaceholderText('••••6789')
  expect(number.value).toBe('')
  fireEvent.change(number, { target: { value: '00123456789' } })
  fireEvent.submit(number.closest('form'))
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/author/bank-details',
      expect.objectContaining({
        method: 'PUT',
        body: { bankName: 'TPBank', accountNumber: '00123456789', accountHolder: 'AUTHOR' },
      }),
    ),
  )
})

it('sends the reviewed version and support reason when correcting a payout bank', async () => {
  const onSaved = vi.fn()
  api.mockResolvedValue({ retryState: 'queued' })
  render(
    <LocaleProvider>
      <PayoutBankCorrectionForm withdrawalId="payout-id" version={7} onSaved={onSaved} />
    </LocaleProvider>,
  )
  const inputs = screen.getAllByRole('textbox')
  for (const [index, value] of [
    'TPBank',
    '00123456789',
    'AUTHOR',
    'Verified support request',
  ].entries())
    fireEvent.change(inputs[index], { target: { value } })
  fireEvent.submit(inputs[0].closest('form'))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(api).toHaveBeenCalledWith('/admin/monthly-payouts/payout-id/payment-details', {
    method: 'PUT',
    body: {
      expectedVersion: 7,
      reason: 'Verified support request',
      bankDetails: { bankName: 'TPBank', accountNumber: '00123456789', accountHolder: 'AUTHOR' },
    },
  })
})
