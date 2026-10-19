import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { CategoriesConfigurationPage } from '../../../src/pages/admin/CategoriesConfigurationPage'
const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const category = {
  id: '000000000000000000000002',
  name: 'Thể loại MongoDB',
  sortKey: 2,
  status: 'active',
  version: 4,
  storyCount: 7,
}
function view() {
  render(
    <LocaleProvider>
      <CategoriesConfigurationPage />
    </LocaleProvider>,
  )
}
function mockFeed() {
  api.mockImplementation(async (path, options) =>
    options?.method
      ? {
          category: {
            ...category,
            name: options.body.name,
            version: 5,
            status: options.body.status ?? 'active',
          },
        }
      : { items: [category], total: 1, page: 1, pageSize: 20 },
  )
}
it('reads real category counts and sends filters to the server without demo rows', async () => {
  mockFeed()
  view()
  await screen.findByText(category.name)
  expect(screen.getByText('7')).toBeTruthy()
  expect(screen.queryByText('Fantasy & Mythic')).toBeNull()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Lọc danh mục' }), {
    target: { value: 'kỳ ảo' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Lọc', exact: true }))
  await waitFor(() =>
    expect(
      api.mock.calls.some(([path]) => new URLSearchParams(path.split('?')[1]).get('q') === 'kỳ ảo'),
    ).toBe(true),
  )
})
it('saves an edited category with its current version and required reason', async () => {
  mockFeed()
  view()
  await screen.findByText(category.name)
  fireEvent.click(screen.getByRole('button', { name: 'Sửa danh mục' }))
  fireEvent.change(screen.getByLabelText('Tên thể loại'), { target: { value: 'Tên đã sửa' } })
  expect(screen.getByRole('button', { name: 'Lưu danh mục' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Chỉnh tên' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu danh mục' }))
  await waitFor(() =>
    expect(
      api.mock.calls.some(
        ([path, options]) =>
          path.endsWith(category.id) &&
          options?.method === 'PUT' &&
          options.body.expectedVersion === 4 &&
          options.body.name === 'Tên đã sửa' &&
          options.body.reason === 'Chỉnh tên',
      ),
    ).toBe(true),
  )
  await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Lý do thay đổi' })).toBeNull())
})
it('keeps entered values when saving fails and shows unsupported groups without fabricated data', async () => {
  api.mockImplementation(async (path, options) => {
    if (options?.method) throw new Error('Tên thể loại đã tồn tại.')
    return { items: [], total: 0, page: 1, pageSize: 20 }
  })
  view()
  await screen.findByText('Không có danh mục phù hợp')
  fireEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
  fireEvent.change(screen.getByLabelText('Tên thể loại'), { target: { value: 'Bản mới' } })
  fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Thêm thể loại' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu danh mục' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Tên thể loại đã tồn tại.')
  expect(screen.getByLabelText('Tên thể loại').value).toBe('Bản mới')
  fireEvent.click(screen.getByRole('button', { name: 'Hủy', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Thể loại phụ và thẻ', exact: true }))
  await screen.findByText('Chức năng chưa được triển khai')
  expect(screen.queryByText('#SlowBurn')).toBeNull()
})
