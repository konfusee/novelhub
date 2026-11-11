import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { RolesPermissionsPage } from '../../../src/pages/admin/RolesPermissionsPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }))
vi.mock('../../../src/components/admin/AuthorRoleManagement', () => ({
  AuthorRoleManagement: () => null,
}))
const reader = {
  id: '111111111111111111111111',
  name: 'Reader thực',
  email: 'reader@example.test',
  roles: [],
  status: 'active',
  version: 4,
}
beforeEach(() => {
  mocks.apiRequest.mockReset().mockImplementation(async path => {
    if (path === '/admin/roles') return { roles: [{ role: 'reader', count: 1 }] }
    if (path.startsWith('/admin/accounts?')) return { items: [reader], total: 1 }
    return { account: { id: reader.id, role: 'moderator', version: 5 } }
  })
})
afterEach(cleanup)
const view = () =>
  render(
    <LocaleProvider>
      <RolesPermissionsPage />
    </LocaleProvider>,
  )

it('loads actual accounts and requires reason and explicit role confirmation before mutation', async () => {
  view()
  await screen.findByText('Reader thực')
  fireEvent.click(screen.getByRole('button', { name: 'Đổi vai trò' }))
  expect(screen.getByRole('button', { name: 'Xác nhận thay đổi' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(screen.getByRole('option', { name: 'Kiểm duyệt viên' }))
  fireEvent.change(screen.getByLabelText('Lý do thay đổi (bắt buộc)'), {
    target: { value: 'Phân công mới' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thay đổi' }))
  await screen.findByText('Đã cập nhật vai trò.')
  expect(mocks.apiRequest).toHaveBeenCalledWith(`/admin/accounts/${reader.id}/role`, {
    method: 'POST',
    body: { role: 'moderator', expectedVersion: 4, reason: 'Phân công mới' },
  })
})

it('shows a failed role save and keeps the confirmation open', async () => {
  view()
  await screen.findByText('Reader thực')
  mocks.apiRequest.mockRejectedValueOnce(new Error('Quyền đã thay đổi'))
  fireEvent.click(screen.getByRole('button', { name: 'Đổi vai trò' }))
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(screen.getByRole('option', { name: 'Kiểm duyệt viên' }))
  fireEvent.change(screen.getByLabelText('Lý do thay đổi (bắt buộc)'), {
    target: { value: 'Phân công mới' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thay đổi' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Quyền đã thay đổi'))
  expect(screen.queryByText('Đã cập nhật vai trò.')).toBeNull()
})

it('reports an unavailable API without using mock accounts', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'))
  view()
  await screen.findByRole('alert')
  expect(screen.queryByText('Reader thực')).toBeNull()
})
