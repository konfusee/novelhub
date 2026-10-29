import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { SubmissionQueuePage } from '../../../src/pages/moderator/SubmissionQueuePage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const SUBMISSION_ID = '507f1f77bcf86cd799439011'
const feed = {
  items: [
    {
      id: SUBMISSION_ID,
      version: 3,
      status: 'pending-review',
      submittedAt: '2026-10-29T00:00:00Z',
      type: 'chapter',
      title: 'Chương 1',
      storyTitle: 'Truyện A',
      revisionNumber: 2,
      author: { id: 'a1', displayName: 'Tác giả A' },
      claim: null,
      evidence: {
        batchId: 'b1',
        batchVersion: 5,
        status: 'available-for-human-review',
        stage: 'llm',
        failedStage: null,
        findingsCount: 2,
        maxScore: 0.91,
        llmStatus: 'succeeded',
      },
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  pageCount: 1,
}
const view = () =>
  render(
    <MemoryRouter initialEntries={['/moderator/submissions']}>
      <LocaleProvider>
        <SubmissionQueuePage />
      </LocaleProvider>
    </MemoryRouter>,
  )
const serve = (post = () => Promise.resolve({ submission: {} })) =>
  mocks.apiRequest.mockImplementation((path, options) =>
    options?.method === 'POST' ? post(path, options) : Promise.resolve(feed),
  )

it('loads the live queue and claims with the current version', async () => {
  serve()
  view()
  expect(await screen.findByText('Chương 1')).toBeTruthy()
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/moderator/submissions?view=queue&page=1')
  for (const text of ['Truyện A', 'Tác giả A', '2 đoạn tương đồng', 'Sẵn sàng cho kiểm duyệt viên'])
    expect(screen.getByText(text)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Nhận hồ sơ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(`/moderator/submissions/${SUBMISSION_ID}/claim`, {
      method: 'POST',
      body: { expectedVersion: 3 },
    }),
  )
})

it('shows a held-claim conflict instead of success', async () => {
  serve(() =>
    Promise.reject(Object.assign(new Error('conflict'), { status: 409, code: 'claim_held' })),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Nhận hồ sơ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Hồ sơ đang được kiểm duyệt viên khác giữ.',
  )
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('releases my claims and keeps processing items read-only', async () => {
  serve()
  view()
  await screen.findByText('Chương 1')
  fireEvent.click(screen.getByRole('button', { name: 'Tôi đang giữ' }))
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.map(call => call[0])).toContain(
      '/moderator/submissions?view=mine&page=1',
    ),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Trả hồ sơ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      `/moderator/submissions/${SUBMISSION_ID}/release`,
      { method: 'POST', body: { expectedVersion: 3 } },
    ),
  )
  expect(await screen.findByText('Đã trả hồ sơ về hàng đợi.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Đang chờ AI' }))
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.map(call => call[0])).toContain(
      '/moderator/submissions?view=processing&page=1',
    ),
  )
  await screen.findByText('Chương 1')
  expect(screen.queryByRole('button', { name: 'Nhận hồ sơ' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Trả hồ sơ' })).toBeNull()
})
