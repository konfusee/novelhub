import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { PolicyReschedulingDialog } from '../../../src/pages/admin/PolicyReschedulingDialog'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const policy = {
  id: '111111111111111111111111',
  version: 4,
  future: true,
  effectiveAt: new Date('2099-01-01T07:00').toISOString(),
}
const localTime = '2099-02-01T07:00'
const response = {
  policyId: '222222222222222222222222',
  version: 0,
  effectiveAt: new Date(localTime).toISOString(),
  previousPolicyId: policy.id,
  previousVersion: 5,
}
function view(item = policy) {
  const callbacks = { onSaved: vi.fn(), onClose: vi.fn(), onReload: vi.fn() }
  render(
    <LocaleProvider>
      <PolicyReschedulingDialog policy={item} {...callbacks} />
    </LocaleProvider>,
  )
  return callbacks
}
const confirm = () => screen.getByRole('button', { name: 'Xác nhận đổi lịch', exact: true })
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
function validInput() {
  fill('Ngày và giờ hiệu lực mới', localTime)
  fill('Lý do đổi lịch (bắt buộc)', '  Đổi ngày áp dụng  ')
}
it('sends only exact schedule/version and trimmed reason, verifies both old and new identities', async () => {
  mocks.apiRequest.mockResolvedValue(response)
  const callbacks = view()
  expect(confirm().disabled).toBe(true)
  validInput()
  fireEvent.click(confirm())
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
  expect(mocks.apiRequest).toHaveBeenCalledWith(`/admin/policy/${policy.id}/reschedule`, {
    method: 'POST',
    body: {
      expectedVersion: 4,
      effectiveAt: new Date(localTime).toISOString(),
      reason: 'Đổi ngày áp dụng',
    },
  })
})
it('blocks empty, past, unchanged times and a nonfuture policy', () => {
  view()
  fill('Lý do đổi lịch (bắt buộc)', 'Lịch mới')
  expect(confirm().disabled).toBe(true)
  for (const time of ['2020-01-01T07:00', '2099-01-01T07:00']) {
    fill('Ngày và giờ hiệu lực mới', time)
    expect(confirm().disabled).toBe(true)
    fireEvent.submit(screen.getByLabelText('Ngày và giờ hiệu lực mới').closest('form'))
  }
  expect(mocks.apiRequest).not.toHaveBeenCalled()
  cleanup()
  view({ ...policy, future: false })
  validInput()
  expect(confirm().disabled).toBe(true)
  fireEvent.submit(screen.getByLabelText('Ngày và giờ hiệu lực mới').closest('form'))
  expect(mocks.apiRequest).not.toHaveBeenCalled()
})
it('prevents duplicate writes and closing while saving', async () => {
  let resolve
  mocks.apiRequest.mockReturnValue(
    new Promise(done => {
      resolve = done
    }),
  )
  const callbacks = view()
  validInput()
  fireEvent.click(confirm())
  fireEvent.click(screen.getByRole('button', { name: 'Đang đổi lịch…' }))
  for (const close of screen.getAllByRole('button', { name: 'Đóng', exact: true }))
    fireEvent.click(close)
  expect(mocks.apiRequest).toHaveBeenCalledOnce()
  expect(callbacks.onClose).not.toHaveBeenCalled()
  resolve(response)
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
})
it('keeps entered data and requires reload after an uncertain response', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('network unavailable'))
  const callbacks = view()
  validInput()
  fireEvent.click(confirm())
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Ngày và giờ hiệu lực mới').value).toBe(localTime)
  expect(screen.getByLabelText('Lý do đổi lịch (bắt buộc)').value).toBe('  Đổi ngày áp dụng  ')
  expect(callbacks.onSaved).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Đóng và tải lại lịch sử' }))
  expect(callbacks.onReload).toHaveBeenCalledOnce()
})
it('rejects mismatched new identity, time and cancellation version in successful HTTP responses', async () => {
  for (const patch of [
    { policyId: policy.id },
    { previousPolicyId: response.policyId },
    { previousVersion: 4 },
    { effectiveAt: policy.effectiveAt },
    { version: -1 },
  ]) {
    mocks.apiRequest.mockResolvedValue({ ...response, ...patch })
    const callbacks = view()
    validInput()
    fireEvent.click(confirm())
    await screen.findByRole('alert')
    expect(callbacks.onSaved).not.toHaveBeenCalled()
    cleanup()
  }
})
it('rechecks current time immediately before submitting', () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(new Date('2098-01-01').getTime())
  try {
    view()
    validInput()
    clock.mockReturnValue(new Date('2100-01-01').getTime())
    fireEvent.click(confirm())
    expect(mocks.apiRequest).not.toHaveBeenCalled()
    expect(confirm().disabled).toBe(true)
  } finally {
    clock.mockRestore()
  }
})
