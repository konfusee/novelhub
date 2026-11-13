import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { CreateStoryPage } from '../../../src/pages/author/CreateStoryPage'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}))
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { name: 'Tác giả đăng nhập' } }),
}))
const categories = { items: [{ id: 'real-category', name: 'Kỳ ảo trong DB' }] }
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <CreateStoryPage />
      </LocaleProvider>
    </MemoryRouter>,
  )
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const completeBasicsAndOpenGenres = async (title, synopsis) => {
  fireEvent.change(screen.getByRole('textbox', { name: /Tên truyện/ }), {
    target: { value: title },
  })
  fireEvent.change(screen.getByRole('textbox', { name: /Tóm tắt truyện/ }), {
    target: { value: synopsis },
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục đến bước 2' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục đến bước 3' }))
}
it('creates a real private draft with the chosen category ID and links the confirmed story', async () => {
  const synopsis = 'Tóm tắt truyện mới.'
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { story: { id: 'created-real' } } : categories,
  )
  view()
  expect(screen.queryByRole('button', { name: 'Gợi ý trau chuốt bằng AI' })).toBeNull()
  expect(screen.getByRole('textbox', { name: /Tên truyện/ }).value).toBe('')
  await completeBasicsAndOpenGenres('Truyện mới của tôi', synopsis)
  fireEvent.click(await screen.findByRole('radio', { name: 'Kỳ ảo trong DB', exact: true }))
  const tagInput = screen.getByRole('textbox', { name: 'Thẻ khám phá' })
  fireEvent.change(tagInput, { target: { value: ' #Bí Ẩn Cổ Đại ' } })
  fireEvent.keyDown(tagInput, { key: 'Enter' })
  fireEvent.change(tagInput, { target: { value: 'bíẩncổđại' } })
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thẻ', exact: true }))
  expect(screen.getByRole('alert').textContent).toBe('Thẻ này đã có trong danh sách.')
  fireEvent.change(tagInput, { target: { value: 'x' } })
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thẻ', exact: true }))
  expect(screen.getByRole('alert').textContent).toContain('2–30 ký tự')
  fireEvent.change(tagInput, { target: { value: 'slow-burn' } })
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thẻ', exact: true }))
  expect(screen.getByRole('list', { name: 'Thẻ đã thêm' }).textContent).toContain('#slow-burn')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }))
  expect(
    (await screen.findByRole('link', { name: 'Quản lý truyện', exact: true })).getAttribute('href'),
  ).toBe('/author/stories/created-real')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories', {
    method: 'POST',
    body: {
      title: 'Truyện mới của tôi',
      description: synopsis,
      categoryId: 'real-category',
      tags: ['BíẨnCổĐại', 'slow-burn'],
    },
  })
  expect(screen.queryByText('The Whisper of Sunken Stars')).toBeNull()
  expect(screen.queryByText('Mira Lane')).toBeNull()
})
it('does not claim success when persistence fails and retains the entered fields', async () => {
  const title = 'Bản còn đang viết'
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') throw new Error('MongoDB tạm thời không phản hồi')
    return categories
  })
  view()
  await completeBasicsAndOpenGenres(title, 'Tóm tắt bản thảo.')
  fireEvent.click(await screen.findByRole('radio', { name: 'Kỳ ảo trong DB', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'MongoDB tạm thời không phản hồi',
  )
  fireEvent.click(screen.getByRole('button', { name: /Thông tin cơ bản/ }))
  expect(screen.getByRole('textbox', { name: /Tên truyện/ }).value).toBe(title)
  expect(screen.queryByRole('link', { name: 'Quản lý truyện', exact: true })).toBeNull()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }).disabled).toBe(
      false,
    ),
  )
})
it('requires an active category before writing and allows selecting a cover for the new draft', async () => {
  mocks.apiRequest.mockResolvedValue(categories)
  view()
  await completeBasicsAndOpenGenres('Truyện có bìa', 'Tóm tắt truyện có bìa.')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu làm bản nháp', exact: true }))
  expect(mocks.apiRequest.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Bìa và hình ảnh/ }))
  expect(screen.getByRole('button', { name: 'Tải ảnh bìa lên', exact: true }).disabled).toBe(false)
})
