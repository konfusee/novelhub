import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { SubmittedPackagePage } from '../../../src/pages/author/SubmittedPackagePage'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const snapshot = {
  submission: {
    id: 'package-old',
    status: 'revision-requested',
    submittedAt: '2026-10-17T00:00:00Z',
  },
  story: { id: 'story', title: 'Tên truyện trong gói' },
  revision: { id: 'revision-old', number: 1, formatVersion: 'blocks-v3' },
  rights: {
    basis: 'licensed',
    asserted: true,
    sourceLicenceNote: 'Giấy phép đã lưu của lần gửi này.',
  },
  media: [{ mediaId: 'image-old' }],
  chapter: {
    id: 'chapter',
    document: {
      title: 'Chương của gói cũ',
      blocks: [
        {
          type: 'paragraph',
          inlines: [{ text: 'Nội dung của bản đã gửi <script>x</script>', marks: ['bold'] }],
        },
        {
          type: 'image',
          mediaId: 'image-old',
          alt: 'Ảnh của gói cũ',
          caption: 'Chú thích bất biến',
        },
      ],
    },
  },
}
const view = () =>
  render(
    <MemoryRouter initialEntries={['/author/submissions/package-old/preview']}>
      <LocaleProvider>
        <Routes>
          <Route
            path="/author/submissions/:submissionId/preview"
            element={<SubmittedPackagePage />}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
it('reads only the exact package and uses the checksum-protected image endpoint without draft requests or writes', async () => {
  mocks.apiRequest.mockResolvedValue(snapshot)
  view()
  const article = await screen.findByRole('article', { name: 'Nội dung chương xem trước' })
  expect(article.textContent).toContain('Nội dung của bản đã gửi <script>x</script>')
  expect(article.querySelector('script')).toBeNull()
  expect(article.querySelector('strong')).not.toBeNull()
  const image = screen.getByRole('img', { name: 'Ảnh của gói cũ' })
  expect(image.getAttribute('src')).toBe(
    '/api/author/submissions/package-old/media/image-old/content',
  )
  expect(image.getAttribute('crossorigin')).toBe('use-credentials')
  expect(screen.getByText('Giấy phép đã lưu của lần gửi này.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Về lịch sử gửi duyệt' }).getAttribute('href')).toBe(
    '/author/submissions?storyId=story&chapterId=chapter',
  )
  fireEvent.change(screen.getByRole('slider', { name: 'Cỡ chữ' }), { target: { value: '26' } })
  expect(article.style.fontSize).toBe('26px')
  fireEvent.error(image)
  expect(screen.queryByRole('img', { name: 'Ảnh của gói cũ' })).toBeNull()
  expect(screen.getByText('Chú thích bất biến')).toBeTruthy()
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    '/author/submissions/package-old/package',
    expect.anything(),
  )
  expect(screen.queryByRole('link', { name: 'Chỉnh sửa bản nháp' })).toBeNull()
})
it('renders submitted story metadata without loading chapter or workspace content', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...snapshot,
    chapter: undefined,
    media: [],
    metadata: { title: 'Tên cũ đã gửi', description: 'Mô tả đã gửi' },
  })
  view()
  await screen.findByRole('heading', { name: 'Tên cũ đã gửi' })
  expect(screen.getByText('Mô tả đã gửi')).toBeTruthy()
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
})
it('keeps integrity errors visible and retries the same package instead of substituting another revision', async () => {
  mocks.apiRequest
    .mockRejectedValueOnce(new Error('Gói không toàn vẹn.'))
    .mockResolvedValueOnce(snapshot)
  view()
  expect((await screen.findByRole('alert')).textContent).toBe('Gói không toàn vẹn.')
  expect(screen.queryByRole('article')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái' }))
  await screen.findByRole('article')
  expect(
    mocks.apiRequest.mock.calls.every(
      ([path, options]) => path === '/author/submissions/package-old/package' && !options.method,
    ),
  ).toBe(true)
})
it('shows unavailable state for a private package that is not found', async () => {
  mocks.apiRequest.mockRejectedValue(
    Object.assign(new Error('Không tìm thấy gói đã gửi.'), { status: 404 }),
  )
  view()
  expect((await screen.findByRole('alert')).textContent).toContain('Không tìm thấy gói đã gửi.')
  expect(screen.queryByRole('article')).toBeNull()
})
