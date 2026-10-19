import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { FormerAuthorStoriesPage } from '../../../src/pages/admin/FormerAuthorStoriesPage'
const api = vi.hoisted(() => vi.fn())
vi.mock('../../../src/api/client', () => ({ apiRequest: api }))
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const story = {
  id: 'story-id',
  title: 'Truyện của cựu Author',
  description: 'Nội dung gốc.',
  status: 'published',
  authorId: 'former-author',
  version: 8,
  publishedRevisionId: 'source-revision',
  categoryIds: ['category-id'],
}
function setup({ saveError = false, blocked = false } = {}) {
  api.mockImplementation(async (path, options) => {
    if (options?.method) {
      if (saveError) throw new Error('Truyện đã thay đổi')
      return { story: { id: story.id, status: 'published', version: 9 } }
    }
    if (path === '/catalog/categories') return { items: [{ id: 'category-id', name: 'Kỳ ảo' }] }
    if (path.endsWith(story.id)) {
      if (blocked) throw new Error('Không còn đủ điều kiện cựu Author')
      return { story }
    }
    return { items: [story], total: 1, page: 1, pageSize: 20 }
  })
  render(
    <LocaleProvider>
      <MemoryRouter>
        <FormerAuthorStoriesPage />
      </MemoryRouter>
    </LocaleProvider>,
  )
}
it('loads the frozen story and saves an explicit versioned correction with a reason', async () => {
  setup()
  await screen.findByText(story.title)
  fireEvent.click(screen.getByRole('button', { name: 'Quản trị truyện' }))
  await screen.findByLabelText('Tên truyện')
  fireEvent.change(screen.getByLabelText('Tên truyện'), { target: { value: 'Tên đã sửa' } })
  fireEvent.change(screen.getByLabelText('Lý do quản trị'), { target: { value: 'Sửa metadata' } })
  await screen.findByLabelText('Kỳ ảo')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sửa và công khai' }))
  await waitFor(() =>
    expect(
      api.mock.calls.some(
        ([path, options]) =>
          path.endsWith(story.id) &&
          options?.body?.expectedVersion === 8 &&
          options.body.expectedPublishedRevisionId === 'source-revision' &&
          options.body.title === 'Tên đã sửa' &&
          options.body.reason === 'Sửa metadata' &&
          options.body.categoryIds[0] === 'category-id',
      ),
    ).toBe(true),
  )
  await waitFor(() => expect(screen.queryByLabelText('Lý do quản trị')).toBeNull())
})
it('preserves the entered correction when the server refuses a stale write', async () => {
  setup({ saveError: true })
  await screen.findByText(story.title)
  fireEvent.click(screen.getByRole('button', { name: 'Quản trị truyện' }))
  await screen.findByLabelText('Tên truyện')
  fireEvent.change(screen.getByLabelText('Tên truyện'), { target: { value: 'Bản đang sửa' } })
  fireEvent.change(screen.getByLabelText('Lý do quản trị'), { target: { value: 'Lý do' } })
  await screen.findByLabelText('Kỳ ảo')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sửa và công khai' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Truyện đã thay đổi')
  expect(screen.getByLabelText('Tên truyện').value).toBe('Bản đang sửa')
})
it('shows eligibility failure without offering a write form', async () => {
  setup({ blocked: true })
  await screen.findByText(story.title)
  fireEvent.click(screen.getByRole('button', { name: 'Quản trị truyện' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Không còn đủ điều kiện cựu Author')
  expect(screen.queryByLabelText('Lý do quản trị')).toBeNull()
})
