import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../context/LocaleContext'
import { AuthorApplyPage } from './AuthorApplyPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), applyForAuthor: vi.fn() }))
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { name: 'Reader', email: 'reader@example.test', roles: ['reader'] },
    applyForAuthor: mocks.applyForAuthor,
  }),
}))
vi.mock('../../components/public/PublicHeader', () => ({ PublicHeader: () => null }))
vi.mock('../../components/auth/AuthShowcase', () => ({ AuthShowcase: () => null }))
vi.mock('../system/LegalPage', () => ({ LegalContent: () => null }))
beforeEach(() => {
  mocks.apiRequest.mockReset().mockResolvedValue({ application: null })
  mocks.applyForAuthor.mockReset().mockResolvedValue({})
})
afterEach(cleanup)
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorApplyPage />
      </LocaleProvider>
    </MemoryRouter>,
  )

describe('Author applicant feedback', () => {
  it('announces a successful refresh even when the application is still pending', async () => {
    mocks.apiRequest.mockResolvedValue({ application: { status: 'submitted' } })
    view()
    await screen.findByRole('heading', { name: 'Đơn đăng ký đang chờ xét duyệt' })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }))
    expect(await screen.findByText(/Đã kiểm tra lúc/)).toBeTruthy()
    expect(mocks.apiRequest).toHaveBeenCalledTimes(2)
  })

  it('preserves the previous status and clearly reports an unsuccessful refresh', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ application: { status: 'submitted' } })
    view()
    await screen.findByRole('heading', { name: 'Đơn đăng ký đang chờ xét duyệt' })
    mocks.apiRequest.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Đơn đăng ký đang chờ xét duyệt' })).toBeTruthy()
    expect(screen.queryByText(/Đã kiểm tra lúc/)).toBeNull()
  })
  it('allows resubmission after receiving a rejection through status refresh', async () => {
    view()
    await screen.findByText('Thỏa thuận tác giả')
    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn đăng ký Tác giả' }))
    await screen.findByRole('heading', { name: 'Đơn đăng ký đang chờ xét duyệt' })
    mocks.apiRequest.mockResolvedValueOnce({
      application: { status: 'rejected', decisionReason: 'Bổ sung hồ sơ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }))
    expect(await screen.findByText('Bổ sung hồ sơ')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Gửi đơn đăng ký Tác giả' }).disabled).toBe(false)
    expect(screen.queryByText('80%')).toBeNull()
  })

  it('directs the applicant to sign in again when role grant invalidates the old session', async () => {
    mocks.apiRequest.mockRejectedValueOnce({ status: 401 })
    view()
    expect(await screen.findByText(/Phiên đăng nhập không còn hiệu lực/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/login')
  })

  it('can retry a failed status load', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('offline'))
    view()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }))
    await screen.findByRole('button', { name: 'Gửi đơn đăng ký Tác giả' })
    expect(mocks.apiRequest).toHaveBeenCalledTimes(2)
  })
})
