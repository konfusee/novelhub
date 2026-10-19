import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ChapterReleaseDialog } from '../../../src/pages/author/StoryReleaseDialog'
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
    version: 5,
    storyVersion: 8,
    revisionId: 'revision',
    submissionId: 'submission',
    title: 'Chương đã duyệt',
  },
  ready: true,
  checks: [
    'approval',
    'integrity',
    'evidence',
    'parent',
    'order',
    'free',
    'format',
    'media',
    'editable',
  ].map(code => ({ code, ok: true })),
}
function view() {
  const released = vi.fn()
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ChapterReleaseDialog
          storyId="story"
          chapterId="chapter"
          onClose={vi.fn()}
          onReleased={released}
        />
      </LocaleProvider>
    </MemoryRouter>,
  )
  return released
}
it('confirms the exact approved chapter and parent version and requires a real published result', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { chapter: { id: 'chapter', status: 'published' } } : prepared,
  )
  const released = view()
  await screen.findByRole('heading', { name: 'Chương đã duyệt' })
  expect(mocks.apiRequest.mock.calls).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Xem gói đã gửi' }).getAttribute('href')).toBe(
    '/author/submissions/submission/preview',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành ngay' }))
  await waitFor(() => expect(released).toHaveBeenCalledTimes(1))
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/story/chapters/chapter/release', {
    method: 'POST',
    body: {
      revisionId: 'revision',
      submissionId: 'submission',
      expectedVersion: 5,
      expectedStoryVersion: 8,
    },
  })
})
it.each(['order', 'parent', 'free', 'format', 'media'])(
  'cannot override the failed %s condition',
  async code => {
    mocks.apiRequest.mockResolvedValue({
      ...prepared,
      ready: false,
      checks: prepared.checks.map(check => ({ ...check, ok: check.code !== code })),
    })
    view()
    await screen.findByRole('heading', { name: 'Chương đã duyệt' })
    expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
    expect(screen.getByText('Chưa đạt')).toBeTruthy()
  },
)
it('retains stale errors and retries readiness without automatically republishing', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') throw new Error('Truyện hoặc chương đã thay đổi.')
    return prepared
  })
  const released = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }))
  await screen.findByText('Truyện hoặc chương đã thay đổi.')
  expect(released).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại điều kiện' }))
  await waitFor(() => expect(mocks.apiRequest.mock.calls).toHaveLength(3))
  expect(
    mocks.apiRequest.mock.calls.filter(([, options]) => options.method === 'POST'),
  ).toHaveLength(1)
})
it('rejects a malformed success response and keeps the confirmation open', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST' ? { chapter: { id: 'chapter', status: 'approved' } } : prepared,
  )
  const released = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }))
  await screen.findByRole('alert')
  expect(released).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it.each([
  ['approval', 'Xem duyệt và gửi lại', '/author/submissions?storyId=story&chapterId=chapter'],
  ['parent', 'Hoàn thiện truyện cha', '/author/stories/story?tab=details'],
  ['order', 'Xem các chương đứng trước', '/author/stories/story?tab=chapters'],
  ['free', 'Xem cài đặt đọc sớm', '/author/stories/story?tab=chapters'],
  ['format', 'Kiểm tra định dạng gói', '/author/submissions?storyId=story&chapterId=chapter'],
  ['media', 'Kiểm tra media', '/author/submissions?storyId=story&chapterId=chapter'],
])(
  'offers the correct chapter recovery path for %s without publishing',
  async (code, label, href) => {
    mocks.apiRequest.mockResolvedValue({
      ...prepared,
      ready: false,
      checks: prepared.checks.map(check => ({ ...check, ok: check.code !== code })),
    })
    view()
    expect((await screen.findByRole('link', { name: label })).getAttribute('href')).toBe(href)
    expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
    expect(mocks.apiRequest.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  },
)
it('rejects publication confirmation for a different chapter', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST'
      ? { chapter: { id: 'other-chapter', status: 'published' } }
      : prepared,
  )
  const released = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }))
  await screen.findByRole('alert')
  expect(released).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Phát hành ngay' }).disabled).toBe(true)
})
