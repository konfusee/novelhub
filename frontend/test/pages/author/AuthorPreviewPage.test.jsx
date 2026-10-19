import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { AuthorPreviewPage } from '../../../src/pages/author/AuthorPreviewPage'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
function view(path = '/author/stories/owned/preview') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>
        <Routes>
          <Route path="/author/stories/:storyId/preview" element={<AuthorPreviewPage />} />
          <Route
            path="/author/stories/:storyId/chapters/:chapterId/preview"
            element={<AuthorPreviewPage />}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
}
it('loads complete owner content, renders escaped marks, changes reading size and navigates chapters without writes', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    expect(options?.method).not.toBe('POST')
    if (path.endsWith('/workspace'))
      return {
        story: {},
        chapters: [
          { id: 'second', title: 'Hai', number: 2, status: 'draft' },
          { id: 'first', title: 'Một', number: 1, status: 'draft' },
        ],
      }
    return {
      chapter: {
        storyTitle: 'Truyện riêng',
        document: {
          title: path.includes('/second?') ? 'Hai' : 'Một',
          blocks: [
            {
              type: 'paragraph',
              inlines: [
                {
                  text: 'Nội dung cuối chương vượt trích đoạn',
                  marks: ['bold', 'italic', 'underline'],
                },
              ],
            },
            { type: 'quote', inlines: [{ text: '<script>alert(1)</script>', marks: [] }] },
          ],
        },
      },
    }
  })
  view()
  const article = await screen.findByRole('article', { name: 'Nội dung chương xem trước' })
  expect(article.textContent).toContain('Nội dung cuối chương vượt trích đoạn')
  expect(article.querySelector('strong em u, u em strong, u em, em strong')).not.toBeNull()
  expect(article.querySelector('script')).toBeNull()
  expect(article.textContent).toContain('<script>alert(1)</script>')
  fireEvent.change(screen.getByRole('slider', { name: 'Cỡ chữ' }), { target: { value: '26' } })
  expect(article.style.fontSize).toBe('26px')
  fireEvent.click(screen.getByRole('link', { name: 'Chương sau' }))
  await screen.findByRole('heading', { name: 'Hai', level: 1 })
  expect(screen.getByRole('link', { name: 'Chương trước' }).getAttribute('href')).toContain(
    '/first/preview',
  )
})
it('shows empty state without requesting a nonexistent chapter', async () => {
  mocks.apiRequest.mockResolvedValue({ story: {}, chapters: [] })
  view()
  await screen.findByText(/Truyện chưa có chương để xem trước/)
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
})
it('keeps owner API errors visible instead of falling back to public/mock content', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Không tìm thấy truyện.'))
  view()
  expect((await screen.findByRole('alert')).textContent).toContain('Không tìm thấy truyện.')
})
