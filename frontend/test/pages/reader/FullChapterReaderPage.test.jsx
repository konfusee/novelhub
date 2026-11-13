import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { FullChapterReaderPage } from '../../../src/pages/reader/FullChapterReaderPage'

vi.mock('../../../src/layouts', () => ({
  ReaderLayout: ({ children }) => <main>{children}</main>,
}))
vi.mock('../../../src/components/community/CommentThread', () => ({ CommentThread: () => null }))
vi.mock('../../../src/components/community/ReportDialog', () => ({ ReportDialog: () => null }))
vi.mock('../../../src/components/community/FollowButton', () => ({ FollowButton: () => null }))

const STORY = '507f1f77bcf86cd799439011'
const CH1 = '507f1f77bcf86cd799439021'
const CH2 = '507f1f77bcf86cd799439022'
const story = {
  story: { id: STORY, title: 'Truyện A', author: 'Tác giả A', followers: 3 },
  chapters: [
    { id: CH1, title: 'Mở đầu', orderKey: 1, locked: false },
    { id: CH2, title: 'Bí mật', orderKey: 2, locked: true },
  ],
  viewer: { following: false, rating: null, resume: null },
}
const chapterOne = {
  chapter: {
    id: CH1,
    title: 'Mở đầu',
    orderKey: 1,
    revisionId: '507f1f77bcf86cd799439031',
    publishedAt: '2026-10-01T00:00:00Z',
    blocks: [{ type: 'paragraph', text: 'Sương sớm phủ kín khu rừng im lặng.' }],
    story: { id: STORY, title: 'Truyện A', author: 'Tác giả A' },
    prev: null,
    next: { id: CH2, orderKey: 2, title: 'Bí mật', locked: true },
    commentCount: 0,
  },
}
const reply = (status, data) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) })
const fetchMock = vi.fn((url, options = {}) => {
  const path = url.replace(/^\/api/, '')
  if (options.method === 'PUT' && path === '/reader/progress')
    return reply(200, { progress: JSON.parse(options.body) })
  if (path === `/catalog/stories/${STORY}`) return reply(200, story)
  if (path === `/catalog/stories/${STORY}/chapters/${CH1}`) return reply(200, chapterOne)
  if (path === `/catalog/stories/${STORY}/chapters/${CH2}`)
    return reply(403, {
      error: { code: 'chapter_locked', message: 'Chương đang trong thời gian truy cập sớm.' },
    })
  if (path === `/reader/progress/${STORY}`) return reply(200, { resume: null })
  return reply(404, { error: { code: 'not_found', message: 'Không tìm thấy.' } })
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  fetchMock.mockClear()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const view = chapterId =>
  render(
    <MemoryRouter initialEntries={[`/read/${STORY}/${chapterId}`]}>
      <LocaleProvider>
        <Routes>
          <Route path="/read/:storyId/:chapterId" element={<FullChapterReaderPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const progressCalls = () =>
  fetchMock.mock.calls.filter(
    ([url, options]) => url === '/api/reader/progress' && options?.method === 'PUT',
  )

it('renders the chapter text and saves reading progress for that chapter', async () => {
  view(CH1)
  expect(await screen.findByText('Sương sớm phủ kín khu rừng im lặng.')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chương 1: Mở đầu')
  await waitFor(() => expect(progressCalls()).toHaveLength(1))
  const body = JSON.parse(progressCalls()[0][1].body)
  expect(body).toMatchObject({ storyId: STORY, chapterId: CH1, paragraph: 0, paragraphCount: 1 })
  /* The early-access next chapter is shown as locked instead of being loaded. */
  expect(await screen.findByText('Chương 2: Bí mật đang khóa')).toBeTruthy()
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith(`/chapters/${CH2}`))).toBe(false)
})

it('shows the unlock-needed notice for a locked early-access chapter', async () => {
  view(CH2)
  expect(await screen.findByText('Chương 2: Bí mật đang khóa')).toBeTruthy()
  expect(
    screen.getByText(
      'Chương này đang trong thời gian truy cập sớm. Bạn cần mở khóa chương để đọc.',
    ),
  ).toBeTruthy()
  expect(screen.queryByText('Sương sớm phủ kín khu rừng im lặng.')).toBeNull()
  await waitFor(() =>
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(`/api/reader/progress/${STORY}`),
  )
  expect(progressCalls()).toHaveLength(0)
})

it('links the locked next chapter so it opens on its unlock prompt', async () => {
  view(CH1)
  await screen.findByText('Sương sớm phủ kín khu rừng im lặng.')
  const link = await screen.findByRole('link', { name: 'Mở chương để mở khóa' })
  expect(link.getAttribute('href')).toBe(`/read/${STORY}/${CH2}`)
})
