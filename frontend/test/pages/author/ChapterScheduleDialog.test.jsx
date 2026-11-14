import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ChapterScheduleDialog } from '../../../src/pages/author/ChapterScheduleDialog'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const prepared = {
  target: {
    storyId: 'story',
    chapterId: 'chapter',
    revisionId: 'revision',
    submissionId: 'submission',
    version: 3,
    storyVersion: 7,
    title: 'Chương đã duyệt',
  },
  status: 'approved',
  requestedReleaseAt: null,
  ready: true,
  canCancel: false,
  checks: [{ code: 'approval', ok: true }],
  waiting: [],
}
function view() {
  const saved = vi.fn()
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ChapterScheduleDialog
          storyId="story"
          chapterId="chapter"
          onClose={vi.fn()}
          onSaved={saved}
        />
      </LocaleProvider>
    </MemoryRouter>,
  )
  return saved
}
const chooseTime = async () => {
  await screen.findByRole('heading', { name: 'Chương đã duyệt' })
  const input = screen.getByLabelText('Thời gian phát hành')
  fireEvent.change(input, { target: { value: '2030-10-20T10:30' } })
  return new Date(input.value).toISOString()
}
it('converts local input to UTC and saves only after confirmation with exact source versions', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? {
          chapter: {
            id: 'chapter',
            status: 'scheduled',
            requestedReleaseAt: options.body.requestedReleaseAt,
          },
        }
      : prepared,
  )
  const saved = view()
  const utc = await chooseTime()
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options.method === 'PUT')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch phát hành' }))
  await waitFor(() => expect(saved).toHaveBeenCalledWith(false))
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/story/chapters/chapter/schedule', {
    method: 'PUT',
    body: {
      revisionId: 'revision',
      submissionId: 'submission',
      expectedVersion: 3,
      expectedStoryVersion: 7,
      requestedReleaseAt: utc,
    },
  })
})
it('shows order waiting without blocking an otherwise valid schedule', async () => {
  mocks.apiRequest.mockResolvedValue({ ...prepared, waiting: ['order'] })
  view()
  await chooseTime()
  expect(screen.getByText(/Truyện này hoặc chương đứng trước chưa đủ điều kiện/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Lưu lịch phát hành' }).disabled).toBe(false)
})
it('can cancel a due schedule even when its package no longer passes release checks', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? { chapter: { id: 'chapter', status: 'approved', requestedReleaseAt: null } }
      : {
          ...prepared,
          ready: false,
          status: 'due',
          canCancel: true,
          requestedReleaseAt: '2026-10-01T00:00:00Z',
        },
  )
  const saved = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Hủy lịch phát hành' }))
  await waitFor(() => expect(saved).toHaveBeenCalledWith(true))
  expect(
    mocks.apiRequest.mock.calls.find(([, options]) => options.method === 'PUT')[1].body
      .requestedReleaseAt,
  ).toBeNull()
})
it('requires an explicit fresh check after a stale response and preserves the selected time meanwhile', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT')
      throw Object.assign(new Error('Chương đã thay đổi.'), { status: 409 })
    return prepared
  })
  const saved = view()
  await chooseTime()
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch phát hành' }))
  await screen.findByText('Chương đã thay đổi.')
  expect(screen.getByLabelText('Thời gian phát hành').value).toBe('2030-10-20T10:30')
  expect(screen.getByRole('button', { name: 'Lưu lịch phát hành' }).disabled).toBe(true)
  expect(saved).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại điều kiện' }))
  await screen.findByRole('heading', { name: 'Chương đã duyệt' })
  expect(screen.getByLabelText('Thời gian phát hành').disabled).toBe(false)
})
it.each(['wrong-id', 'wrong-time', 'wrong-status'])(
  'rejects a malformed success response (%s)',
  async failure => {
    mocks.apiRequest.mockImplementation(async (_path, options) =>
      options?.method === 'PUT'
        ? {
            chapter: {
              id: failure === 'wrong-id' ? 'other' : 'chapter',
              status: failure === 'wrong-status' ? 'published' : 'scheduled',
              requestedReleaseAt:
                failure === 'wrong-time' ? '2000-01-01T00:00:00Z' : options.body.requestedReleaseAt,
            },
          }
        : prepared,
    )
    const saved = view()
    await chooseTime()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch phát hành' }))
    await screen.findByRole('alert')
    expect(saved).not.toHaveBeenCalled()
  },
)
it('supports recovery from a load failure without allowing a write', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('Mất kết nối.')).mockResolvedValue(prepared)
  view()
  await screen.findByText('Mất kết nối.')
  expect(screen.queryByRole('button', { name: 'Lưu lịch phát hành' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại điều kiện' }))
  await screen.findByRole('heading', { name: 'Chương đã duyệt' })
})
