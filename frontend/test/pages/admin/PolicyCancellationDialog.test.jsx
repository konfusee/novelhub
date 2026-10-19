import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { PolicyCancellationDialog } from '../../../src/pages/admin/PolicyCancellationDialog'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const policy = { id: '111111111111111111111111', version: 4, future: true }
function view(item = policy) {
  const callbacks = { onSaved: vi.fn(), onClose: vi.fn(), onReload: vi.fn() }
  render(
    <LocaleProvider>
      <PolicyCancellationDialog policy={item} {...callbacks} />
    </LocaleProvider>,
  )
  return callbacks
}
const fill = () =>
  fireEvent.change(screen.getByLabelText('Lý do hủy lịch (bắt buộc)'), {
    target: { value: '  Không còn áp dụng lịch này  ' },
  })
const confirm = () => screen.getByRole('button', { name: 'Xác nhận hủy lịch', exact: true })
it('requires a reason and confirms the exact record/version without deleting it', async () => {
  mocks.apiRequest.mockResolvedValue({ policyId: policy.id, version: 5 })
  const callbacks = view()
  expect(confirm().disabled).toBe(true)
  fill()
  fireEvent.click(confirm())
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
  expect(mocks.apiRequest).toHaveBeenCalledWith(`/admin/policy/${policy.id}/cancel`, {
    method: 'POST',
    body: { expectedVersion: 4, reason: 'Không còn áp dụng lịch này' },
  })
})
it('prevents duplicate submissions and closing while a request is pending', async () => {
  let resolve
  mocks.apiRequest.mockReturnValue(
    new Promise(done => {
      resolve = done
    }),
  )
  const callbacks = view()
  fill()
  fireEvent.click(confirm())
  fireEvent.click(screen.getByRole('button', { name: 'Đang hủy lịch…' }))
  for (const close of screen.getAllByRole('button', { name: 'Đóng', exact: true }))
    fireEvent.click(close)
  expect(mocks.apiRequest).toHaveBeenCalledOnce()
  expect(callbacks.onClose).not.toHaveBeenCalled()
  resolve({ policyId: policy.id, version: 5 })
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
})
it('requires closing/reloading after an uncertain response and retains the entered reason', async () => {
  mocks.apiRequest.mockResolvedValue({ policyId: policy.id, version: 4 })
  const callbacks = view()
  fill()
  fireEvent.click(confirm())
  await screen.findByRole('alert')
  expect(callbacks.onSaved).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Lý do hủy lịch (bắt buộc)').value).toBe(
    '  Không còn áp dụng lịch này  ',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Đóng và tải lại lịch sử' }))
  expect(callbacks.onReload).toHaveBeenCalledOnce()
})
it('cannot submit a current/nonfuture policy even if called with forged form events', () => {
  view({ ...policy, future: false })
  fill()
  expect(confirm().disabled).toBe(true)
  fireEvent.submit(screen.getByLabelText('Lý do hủy lịch (bắt buộc)').closest('form'))
  expect(mocks.apiRequest).not.toHaveBeenCalled()
})
