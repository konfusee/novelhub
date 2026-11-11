import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { StoryDetailPage } from '../../../src/pages/guest/StoryDetailPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), auth: { isAuthenticated: false } }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/context/AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('../../../src/components/public/PublicHeader', () => ({ PublicHeader: () => null }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const STORY_ID = '507f1f77bcf86cd799439011'
const CH1 = '507f1f77bcf86cd799439021'
const CH2 = '507f1f77bcf86cd799439022'
const CH3 = '507f1f77bcf86cd799439023'
const detail = viewer => ({
  story: {
    id: STORY_ID,
    title: 'Rừng Im Lặng',
    author: 'Mira Lane',
    authorId: 'a1',
    categoryId: '',
    genre: 'Kỳ ảo',
    tags: ['BiAnCoDai', 'slow-burn'],
    status: 'Ongoing',
    rating: '4.5',
    ratingCount: 2,
    averageRating: 4.5,
    reads: '10',
    followers: 3,
    synopsis: 'Tóm tắt',
    authorStats: { works: 1, followers: 3, reads: 10 },
    ratingBreakdown: [50, 50, 0, 0, 0],
  },
  chapters: [
    {
      id: CH1,
      title: 'Khởi đầu',
      orderKey: 1,
      locked: false,
      publishedAt: null,
      earlyAccess: null,
    },
    { id: CH2, title: 'Gió lạ', orderKey: 2, locked: false, publishedAt: null, earlyAccess: null },
    {
      id: CH3,
      title: 'Bí mật',
      orderKey: 3,
      locked: true,
      publishedAt: null,
      earlyAccess: { coinPrice: 5, endsAt: '2026-12-01T00:00:00Z' },
    },
  ],
  viewer,
})
const view = payload => {
  mocks.apiRequest.mockResolvedValue(payload)
  return render(
    <MemoryRouter initialEntries={[`/stories/${STORY_ID}`]}>
      <LocaleProvider>
        <Routes>
          <Route path="/stories/:storyId" element={<StoryDetailPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
}

it('loads the story and marks early-access chapters with a lock badge and coin price', async () => {
  mocks.auth = { isAuthenticated: false }
  view(detail(null))
  expect(await screen.findByRole('heading', { level: 1, name: 'Rừng Im Lặng' })).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe(`/catalog/stories/${STORY_ID}`)
  const badges = screen.getAllByTestId('chapter-lock')
  expect(badges).toHaveLength(1)
  expect(within(badges[0]).getByText(/5 xu/)).toBeTruthy()
  expect(
    screen.getByText('Bí mật').closest('li').querySelector('[data-testid="chapter-lock"]'),
  ).toBe(badges[0])
})

it('shows author tags as #tag links to the tag search', async () => {
  mocks.auth = { isAuthenticated: false }
  view(detail(null))
  const tag = await screen.findByRole('link', { name: '#BiAnCoDai' })
  expect(tag.getAttribute('href')).toBe('/search?tag=BiAnCoDai')
  expect(screen.getByRole('link', { name: '#slow-burn' }).getAttribute('href')).toBe(
    '/search?tag=slow-burn',
  )
})

it('sends Guests to the chapter-1 preview', async () => {
  mocks.auth = { isAuthenticated: false }
  view(detail(null))
  const links = await screen.findAllByRole('link', { name: /Đọc thử/ })
  expect(links.length).toBeGreaterThan(0)
  for (const link of links)
    expect(link.getAttribute('href')).toBe(`/stories/${STORY_ID}/preview/${CH1}`)
  expect(screen.queryByRole('link', { name: /Đọc tiếp/ })).toBeNull()
})

it('drives the Continue link from viewer.resume and shows the content-updated notice', async () => {
  mocks.auth = { isAuthenticated: true }
  view(
    detail({
      following: false,
      rating: null,
      resume: {
        chapterId: CH2,
        orderKey: 2,
        title: 'Gió lạ',
        position: 0,
        contentUpdated: true,
        available: true,
        lastReadAt: '2026-10-28T00:00:00Z',
      },
    }),
  )
  const cta = await screen.findByRole('link', { name: /Đọc tiếp: Gió lạ/ })
  expect(cta.getAttribute('href')).toBe(`/read/${STORY_ID}/${CH2}`)
  expect(screen.getByRole('note').textContent).toMatch(/cập nhật/)
})
