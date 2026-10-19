import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { SecurityPanel } from '../../../src/components/account/SecurityPanel'
const mocks = vi.hoisted(() => ({ user: null, updateSecurity: vi.fn(), apiRequest: vi.fn() }))
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: mocks.user, updateSecurity: mocks.updateSecurity }),
}))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
beforeEach(() => {
  mocks.user = { email: 'reader@example.test', hasPassword: false, twoFactorEnabled: false }
  mocks.apiRequest
    .mockReset()
    .mockResolvedValue({ challenge: 'a'.repeat(43), expiresInSeconds: 600 })
  mocks.updateSecurity.mockReset().mockResolvedValue({})
})
afterEach(cleanup)
const view = () =>
  render(
    <LocaleProvider>
      <SecurityPanel />
    </LocaleProvider>,
  )
describe('shared security panel', () => {
  it('lets a Google account create a password only after email confirmation', async () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mật khẩu' }))
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).toBeNull()
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
      target: { value: 'new password 123' },
    })
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'new password 123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác minh' }))
    expect(await screen.findByLabelText('Mã xác minh gồm 6 chữ số')).toBeTruthy()
    expect(mocks.updateSecurity).not.toHaveBeenCalled()
    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/security/challenge', {
      method: 'POST',
      body: { action: 'password' },
    })
    fireEvent.change(screen.getByLabelText('Mã xác minh gồm 6 chữ số'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() =>
      expect(mocks.updateSecurity).toHaveBeenCalledWith('password', {
        challenge: 'a'.repeat(43),
        otp: '123456',
        password: 'new password 123',
        passwordConfirmation: 'new password 123',
      }),
    )
    expect(await screen.findByText(/Đã cập nhật mật khẩu/)).toBeTruthy()
  })
  it('shows server two-factor state and sends proof before enabling', async () => {
    const { rerender } = view()
    fireEvent.click(screen.getByRole('button', { name: 'Thiết lập' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác minh' }))
    const input = await screen.findByLabelText('Mã xác minh gồm 6 chữ số')
    expect(screen.getByText('Chưa bật')).toBeTruthy()
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() =>
      expect(mocks.updateSecurity).toHaveBeenCalledWith('two-factor', {
        challenge: 'a'.repeat(43),
        otp: '123456',
        enabled: true,
      }),
    )
    await screen.findByText(/Đã bật xác thực hai bước qua email/)
    mocks.user = { ...mocks.user, twoFactorEnabled: true }
    rerender(
      <LocaleProvider>
        <SecurityPanel />
      </LocaleProvider>,
    )
    expect(screen.getByText('Đã bật')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tắt xác thực hai bước' })).toBeTruthy()
  })
})
