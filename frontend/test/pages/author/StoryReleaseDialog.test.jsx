import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { StoryReleaseDialog } from '../../../src/pages/author/StoryReleaseDialog'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const prepared = {
  target: {
    storyId: 'story',
    version: 5,
    revisionId: 'approved-revision',
    submissionId: 'approved-submission',
    title: 'Thông tin đã duyệt',
  },
  ready: true,
  checks: ['approval', 'integrity', 'evidence', 'rights', 'categories', 'media', 'editable'].map(
    code => ({ code, ok: true }),
  ),
}
function view(onReleased = vi.fn(), onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <LocaleProvider>
        <StoryReleaseDialog storyId="story" onClose={onClose} onReleased={onReleased} />
      </LocaleProvider>
    </MemoryRouter>,
  )
  return onReleased
}
it('publishes only after explicit confirmation using the exact prepared approval and version', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { story: { id: 'story', status: 'published' } } : prepared,
  )
  const released = view()
  await screen.findByRole('heading', { name: 'Thông tin đã duyệt' })
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  expect(screen.getByText(/Các chương vẫn cần gửi duyệt và phát hành riêng/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Xem bản đã gửi duyệt' }).getAttribute('href')).toBe(
    '/author/submissions/approved-submission/preview',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành ngay' }))
  await waitFor(() => expect(released).toHaveBeenCalledTimes(1))
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/story/release', {
    method: 'POST',
    body: {
      revisionId: 'approved-revision',
      submissionId: 'approved-submission',
      expectedVersion: 5,
    },
  })
})
it('cannot override a failed server gate and retries only the readiness check', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...prepared,
    ready: false,
    checks: prepared.checks.map(check => ({ ...check, ok: check.code !== 'evidence' })),
  })
  view()
  await screen.findByRole('heading', { name: 'Thông tin đã duyệt' })
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
  expect(screen.getByText('Chưa đạt')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại điều kiện' }))
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledTimes(2))
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options.method)).toBe(true)
})
it('keeps stale publication errors visible and never reports success', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') throw new Error('Truyện đã thay đổi.')
    return prepared
  })
  const released = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }))
  await screen.findByText('Truyện đã thay đổi.')
  expect(released).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeTruthy()
})
it('shows recoverable load errors without offering publication', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Không tải được điều kiện phát hành.'))
  view()
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
})

it('labels restoration explicitly while retaining every server release gate', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...prepared,
    target: { ...prepared.target, restoring: true },
  })
  view()
  expect(await screen.findByRole('heading', { name: 'Phát hành lại truyện' })).toBeTruthy()
  expect(screen.getByText(/Những chương đã phát hành sẽ hiển thị lại/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(false)
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true)
})

it.each([
  ['approval', 'Xem duyệt và gửi lại', '/author/submissions?storyId=story'],
  ['integrity', 'Kiểm tra gói đã gửi', '/author/submissions?storyId=story'],
  ['rights', 'Kiểm tra khai báo quyền', '/author/submissions?storyId=story'],
  ['categories', 'Chỉnh thể loại truyện', '/author/stories/story?tab=details'],
  ['media', 'Kiểm tra media', '/author/stories/story?tab=details'],
  ['editable', 'Xem trạng thái và phản hồi', '/author/stories/story?tab=reviews'],
])('links failed %s to its owned recovery destination', async (code, label, href) => {
  mocks.apiRequest.mockResolvedValue({
    ...prepared,
    ready: false,
    checks: prepared.checks.map(check => ({ ...check, ok: check.code !== code })),
  })
  view()
  expect((await screen.findByRole('link', { name: label })).getAttribute('href')).toBe(href)
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
  expect(mocks.apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true)
})
it('requires a fresh readiness check after an uncertain mutation and rejects another story response', async () => {
  let writes = 0
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      writes++
      return { story: { id: writes === 1 ? 'another-story' : 'story', status: 'published' } }
    }
    return prepared
  })
  const released = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }))
  await screen.findByRole('alert')
  expect(released).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành ngay' }))
  expect(writes).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại điều kiện' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(false),
  )
  expect(writes).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành ngay' }))
  await waitFor(() => expect(released).toHaveBeenCalledTimes(1))
})

it('closes the release overlay when navigating to a recovery tab on the same story', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...prepared,
    ready: false,
    checks: [{ code: 'categories', ok: false }],
  })
  const close = vi.fn()
  view(vi.fn(), close)
  fireEvent.click(await screen.findByRole('link', { name: 'Chỉnh thể loại truyện' }))
  expect(close).toHaveBeenCalledTimes(1)
})
