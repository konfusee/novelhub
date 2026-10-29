import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ModeratorOverviewPage } from '../../../src/pages/moderator/ModeratorOverviewPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const QUEUE_ID = '507f1f77bcf86cd799439011'
const responses = {
  '/moderator/summary': { queue: 3, mine: 1, processing: 2, decidedToday: 4 },
  '/moderator/submissions?view=queue&page=1': {
    items: [
      {
        id: QUEUE_ID,
        version: 2,
        status: 'pending-review',
        submittedAt: '2026-10-27T00:00:00Z',
        type: 'chapter',
        title: 'Chương chờ lâu',
        storyTitle: 'Truyện chờ',
        revisionNumber: 1,
        author: { id: 'a1', displayName: 'Tác giả A' },
        claim: null,
        evidence: null,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    pageCount: 1,
  },
  '/moderator/decisions?outcome=all&scope=mine&page=1': {
    items: [
      {
        id: 'h1',
        submissionId: '507f1f77bcf86cd799439012',
        revisionId: 'r1',
        title: 'Chương đã duyệt',
        type: 'chapter',
        outcome: 'approved',
        feedback: '',
        occurredAt: '2026-10-29T00:00:00Z',
        moderator: { id: 'm1', displayName: 'Kiểm duyệt viên A' },
        mine: true,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    pageCount: 1,
  },
}

it('shows live counts, the oldest queue items and my recent decisions', async () => {
  mocks.apiRequest.mockImplementation(path =>
    path in responses
      ? Promise.resolve(responses[path])
      : Promise.reject(new Error(`unexpected ${path}`)),
  )
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ModeratorOverviewPage />
      </LocaleProvider>
    </MemoryRouter>,
  )
  const link = await screen.findByRole('link', { name: 'Chương chờ lâu' })
  expect(link.getAttribute('href')).toBe(`/moderator/submissions/${QUEUE_ID}`)
  await screen.findByText('Tôi đang giữ')
  for (const [label, value] of [
    ['Chờ kiểm duyệt', '3'],
    ['Tôi đang giữ', '1'],
    ['Đang chờ AI', '2'],
    ['Tôi đã quyết định hôm nay', '4'],
  ])
    expect(screen.getByText(label).nextElementSibling.textContent).toBe(value)
  expect(await screen.findByText('Chương đã duyệt')).toBeTruthy()
  expect(screen.getByText('Đã phê duyệt')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls.map(call => call[0]).sort()).toEqual(
    Object.keys(responses).sort(),
  )
})
