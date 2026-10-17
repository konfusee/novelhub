import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { PolicySettingsForm } from '../../../src/pages/admin/PolicySettingsForm'
const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))
vi.mock('../../../src/api/client', () => ({
  apiRequest: mocks.apiRequest,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const policy = {
  id: '111111111111111111111111',
  version: 7,
  priceMinCoins: 200,
  priceMaxCoins: 5000,
  durationMinDays: 1,
  durationMaxDays: 14,
  orderExpiryHours: 12,
  claimExpiryHours: 48,
}
function view(current = policy) {
  const onSaved = vi.fn()
  const onBusy = vi.fn()
  render(
    <LocaleProvider>
      <PolicySettingsForm policy={current} onSaved={onSaved} onBusy={onBusy} />
    </LocaleProvider>,
  )
  return {
    onSaved,
    onBusy,
  }
}
function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), {
    target: {
      value,
    },
  })
}
const button = () =>
  screen.getByRole('button', {
    name: 'Lưu và kích hoạt chính sách',
  })
it('requires a changed bound and reason, sends exact policy tokens and accepts a real new identity', async () => {
  mocks.apiRequest.mockResolvedValue({
    policyId: '222222222222222222222222',
    version: 0,
  })
  const callbacks = view()
  expect(button().disabled).toBe(true)
  fill('Giá tối thiểu (xu)', '300')
  expect(button().disabled).toBe(true)
  fill('Lý do thay đổi (bắt buộc)', '  Điều chỉnh mới  ')
  fireEvent.click(button())
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
  expect(mocks.apiRequest).toHaveBeenCalledWith('/admin/policy', {
    method: 'POST',
    body: {
      priceMinCoins: 300,
      priceMaxCoins: 5000,
      durationMinDays: 1,
      durationMaxDays: 14,
      orderExpiryHours: 12,
      claimExpiryHours: 48,
      reason: 'Điều chỉnh mới',
      expectedPolicyId: policy.id,
      expectedPolicyVersion: 7,
    },
  })
})
it('initializes with explicit bounds, null tokens and disclosed default terms', async () => {
  mocks.apiRequest.mockResolvedValue({
    policyId: '000000000000000000000001',
    version: 0,
  })
  const callbacks = view(null)
  expect(screen.getByLabelText('Thời hạn đơn nạp (giờ)').value).toBe('24')
  expect(screen.getByLabelText('Thời hạn nhận xử lý (giờ)').value).toBe('24')
  for (const [label, value] of [
    ['Giá tối thiểu (xu)', '0'],
    ['Giá tối đa (xu)', '900'],
    ['Thời hạn tối thiểu (ngày)', '2'],
    ['Thời hạn tối đa (ngày)', '8'],
    ['Lý do thay đổi (bắt buộc)', 'Khởi tạo'],
  ])
    fill(label, value)
  fireEvent.click(button())
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
  expect(mocks.apiRequest.mock.calls[0][1].body).toMatchObject({
    expectedPolicyId: null,
    expectedPolicyVersion: null,
    priceMinCoins: 0,
  })
})
it('rejects inverted bounds and fractional durations before any write', () => {
  view()
  fill('Lý do thay đổi (bắt buộc)', 'Điều chỉnh')
  fill('Giá tối thiểu (xu)', '6000')
  expect(button().disabled).toBe(true)
  expect(screen.getByRole('alert')).toBeTruthy()
  fill('Giá tối thiểu (xu)', '300')
  fill('Thời hạn tối đa (ngày)', '1.5')
  expect(button().disabled).toBe(true)
  expect(mocks.apiRequest).not.toHaveBeenCalled()
})
it('blocks duplicate submissions and requires reload after uncertain failure', async () => {
  let reject
  mocks.apiRequest.mockReturnValue(
    new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise
    }),
  )
  const callbacks = view()
  fill('Giá tối thiểu (xu)', '300')
  fill('Lý do thay đổi (bắt buộc)', 'Điều chỉnh')
  fireEvent.click(button())
  const busyButton = screen.getByRole('button', {
    name: 'Đang lưu chính sách…',
  })
  fireEvent.click(busyButton)
  expect(mocks.apiRequest).toHaveBeenCalledOnce()
  reject(new Error('network'))
  await screen.findByRole('alert')
  expect(button().disabled).toBe(true)
  expect(callbacks.onSaved).not.toHaveBeenCalled()
  expect(callbacks.onBusy.mock.calls).toEqual([[true], [false]])
})
it('does not accept a successful HTTP response that returns the old policy identity', async () => {
  mocks.apiRequest.mockResolvedValue({
    policyId: policy.id,
    version: 8,
  })
  const callbacks = view()
  fill('Giá tối thiểu (xu)', '300')
  fill('Lý do thay đổi (bắt buộc)', 'Điều chỉnh')
  fireEvent.click(button())
  await screen.findByRole('alert')
  expect(callbacks.onSaved).not.toHaveBeenCalled()
  expect(button().disabled).toBe(true)
})
it('schedules a future local time as UTC without changing current terms', async () => {
  const local = '2099-01-01T07:00'
  const utc = new Date(local).toISOString()
  mocks.apiRequest.mockResolvedValue({
    policyId: '444444444444444444444444',
    version: 0,
    effectiveAt: utc,
  })
  const callbacks = view()
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Hẹn ngày hiệu lực cho phiên bản mới',
    }),
  )
  const save = screen.getByRole('button', {
    name: 'Lưu lịch hiệu lực',
  })
  expect(save.disabled).toBe(true)
  fill('Ngày và giờ hiệu lực', local)
  fill('Lý do thay đổi (bắt buộc)', 'Hẹn thời điểm mới')
  fireEvent.click(save)
  await waitFor(() =>
    expect(callbacks.onSaved).toHaveBeenCalledWith({
      scheduled: true,
    }),
  )
  expect(mocks.apiRequest.mock.calls[0][1].body).toMatchObject({
    effectiveAt: utc,
    expectedPolicyId: policy.id,
    expectedPolicyVersion: 7,
    priceMinCoins: 200,
    orderExpiryHours: 12,
    claimExpiryHours: 48,
  })
})
it('saves expiry-only changes without replacing unrelated policy terms', async () => {
  mocks.apiRequest.mockResolvedValue({
    policyId: '555555555555555555555555',
    version: 0,
  })
  const callbacks = view()
  fill('Thời hạn đơn nạp (giờ)', '0')
  fill('Thời hạn nhận xử lý (giờ)', '36')
  fill('Lý do thay đổi (bắt buộc)', 'Cập nhật thời hạn')
  fireEvent.click(button())
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledOnce())
  expect(mocks.apiRequest.mock.calls[0][1].body).toMatchObject({
    orderExpiryHours: 0,
    claimExpiryHours: 36,
    priceMinCoins: 200,
    expectedPolicyId: policy.id,
    expectedPolicyVersion: policy.version,
  })
})
it('blocks missing, fractional, negative and unsafe expiry values before sending', () => {
  view()
  fill('Lý do thay đổi (bắt buộc)', 'Kiểm tra thời hạn')
  for (const label of ['Thời hạn đơn nạp (giờ)', 'Thời hạn nhận xử lý (giờ)']) {
    for (const value of ['', '-1', '1.5', String(Number.MAX_SAFE_INTEGER + 1)]) {
      fill(label, value)
      expect(button().disabled).toBe(true)
    }
    fill(label, '24')
  }
  expect(button().disabled).toBe(false)
  expect(mocks.apiRequest).not.toHaveBeenCalled()
})
it('blocks past/empty schedules and requires an existing current policy', () => {
  view()
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Hẹn ngày hiệu lực cho phiên bản mới',
    }),
  )
  fill('Lý do thay đổi (bắt buộc)', 'Lịch không hợp lệ')
  expect(
    screen.getByRole('button', {
      name: 'Lưu lịch hiệu lực',
    }).disabled,
  ).toBe(true)
  fill('Ngày và giờ hiệu lực', '2020-01-01T07:00')
  expect(
    screen.getByRole('button', {
      name: 'Lưu lịch hiệu lực',
    }).disabled,
  ).toBe(true)
  expect(mocks.apiRequest).not.toHaveBeenCalled()
  cleanup()
  view(null)
  expect(
    screen.getByRole('checkbox', {
      name: 'Hẹn ngày hiệu lực cho phiên bản mới',
    }).disabled,
  ).toBe(true)
})
it('rejects a schedule success response that does not confirm the requested effective time', async () => {
  mocks.apiRequest.mockResolvedValue({
    policyId: '444444444444444444444444',
    version: 0,
    effectiveAt: '2099-02-01T00:00:00.000Z',
  })
  const callbacks = view()
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Hẹn ngày hiệu lực cho phiên bản mới',
    }),
  )
  fill('Ngày và giờ hiệu lực', '2099-01-01T07:00')
  fill('Lý do thay đổi (bắt buộc)', 'Hẹn lịch')
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Lưu lịch hiệu lực',
    }),
  )
  await screen.findByRole('alert')
  expect(callbacks.onSaved).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', {
      name: 'Lưu lịch hiệu lực',
    }).disabled,
  ).toBe(true)
})
it('rechecks the clock on submit if a previously future time has already passed', () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00Z').getTime())
  try {
    view()
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Hẹn ngày hiệu lực cho phiên bản mới',
      }),
    )
    fill('Ngày và giờ hiệu lực', '2040-01-01T07:00')
    fill('Lý do thay đổi (bắt buộc)', 'Thời gian đã qua')
    clock.mockReturnValue(new Date('2041-01-01T00:00:00Z').getTime())
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lưu lịch hiệu lực',
      }),
    )
    expect(mocks.apiRequest).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', {
        name: 'Lưu lịch hiệu lực',
      }).disabled,
    ).toBe(true)
  } finally {
    clock.mockRestore()
  }
})
