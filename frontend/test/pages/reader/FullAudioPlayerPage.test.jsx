import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { FullAudioPlayerPage } from '../../../src/pages/reader/FullAudioPlayerPage'

vi.mock('../../../src/layouts', () => ({
  ReaderLayout: ({ children }) => <main>{children}</main>,
}))

const STORY = '507f1f77bcf86cd799439011'
const CH1 = '507f1f77bcf86cd799439021'
const CH2 = '507f1f77bcf86cd799439022'
const NARRATION = `/reader/narration/${STORY}/${CH1}`
const AUDIO_URL = `${NARRATION}/audio`
const story = {
  story: { id: STORY, title: 'Truyện A', author: 'Tác giả A', genres: ['Kỳ ảo'] },
  chapters: [
    { id: CH1, title: 'Mở đầu', orderKey: 1, locked: false },
    { id: CH2, title: 'Bí mật', orderKey: 2, locked: true },
  ],
  viewer: { following: false, resume: null },
}
const chapterOne = {
  chapter: {
    id: CH1,
    title: 'Mở đầu',
    orderKey: 1,
    blocks: [{ type: 'paragraph', text: 'Sương sớm.' }],
    story: { id: STORY, title: 'Truyện A', author: 'Tác giả A' },
    prev: null,
    next: { id: CH2, orderKey: 2, title: 'Bí mật', locked: true },
  },
}
const view = (status, extra = {}) => ({
  status,
  audioUrl: status === 'available' ? AUDIO_URL : null,
  failure: null,
  updatedAt: null,
  ...extra,
})

/* Narration responses per method; each test sets them. */
let narration
const reply = (status, data) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) })
const fetchMock = vi.fn((url, options = {}) => {
  const path = url.replace(/^\/api/, '')
  const method = options.method ?? 'GET'
  if (path === NARRATION) {
    const next = method === 'POST' ? narration.post : narration.get
    return reply(next.status === 'processing' ? 202 : 200, { narration: next })
  }
  if (method === 'PUT' && path === '/reader/progress')
    return reply(200, { progress: JSON.parse(options.body) })
  if (path === `/catalog/stories/${STORY}`) return reply(200, story)
  if (path === `/catalog/stories/${STORY}/chapters/${CH1}`) return reply(200, chapterOne)
  if (path === `/reader/progress/${STORY}`) return reply(200, { resume: null })
  return reply(404, { error: { code: 'not_found', message: 'Không tìm thấy.' } })
})
const calls = (method, path) =>
  fetchMock.mock.calls.filter(
    ([url, options = {}]) => url === `/api${path}` && (options.method ?? 'GET') === method,
  )

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  fetchMock.mockClear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const renderPlayer = () =>
  render(
    <MemoryRouter initialEntries={[`/listen/${STORY}/${CH1}`]}>
      <LocaleProvider>
        <Routes>
          <Route path="/listen/:storyId/:chapterId" element={<FullAudioPlayerPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )

it('generates on first Play, polls while processing and plays the available audio', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  narration = { get: view('none'), post: view('processing') }
  renderPlayer()
  expect(await screen.findByText('Phát — audio được tạo ở lần phát đầu tiên')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Phát' }))
  expect(await screen.findByText('Đang tạo audio…')).toBeTruthy()
  expect(calls('POST', NARRATION)).toHaveLength(1)
  expect(JSON.parse(calls('POST', NARRATION)[0][1].body)).toEqual({})
  expect(document.querySelector('audio')).toBeNull()

  narration.get = view('available')
  const before = calls('GET', NARRATION).length
  await act(() => vi.advanceTimersByTimeAsync(3000))
  await waitFor(() => expect(document.querySelector('audio')).toBeTruthy())
  expect(calls('GET', NARRATION).length).toBe(before + 1)
  const audio = document.querySelector('audio')
  expect(audio.getAttribute('src')).toBe(`/api${AUDIO_URL}`)
  expect(audio.getAttribute('preload')).toBe('metadata')
  /* Polling stops once the narration is available. */
  await act(() => vi.advanceTimersByTimeAsync(6000))
  expect(calls('GET', NARRATION).length).toBe(before + 1)
})

it('shows the failure message and retries with another POST', async () => {
  narration = {
    get: view('failed', {
      failure: { code: 'provider_error', message: 'Nhà cung cấp lỗi tạm thời.', retryable: true },
    }),
    post: view('processing'),
  }
  renderPlayer()
  expect(await screen.findByText('Nhà cung cấp lỗi tạm thời.')).toBeTruthy()
  expect(calls('POST', NARRATION)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  await waitFor(() => expect(calls('POST', NARRATION)).toHaveLength(1))
  expect(await screen.findByText('Đang tạo audio…')).toBeTruthy()
})

it('shows the not-ready notice when TTS is not configured (HTTP 503)', async () => {
  narration = { get: view('none'), post: view('none') }
  const base = fetchMock.getMockImplementation()
  fetchMock.mockImplementation((url, options) =>
    url === `/api${NARRATION}`
      ? reply(503, { error: { code: 'internal_error', message: 'Internal server error' } })
      : base(url, options),
  )
  try {
    renderPlayer()
    expect((await screen.findAllByText('Chức năng nghe chưa sẵn sàng.')).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Đọc chương này' }).getAttribute('href')).toBe(
      `/read/${STORY}/${CH1}`,
    )
  } finally {
    fetchMock.mockImplementation(base)
  }
})

it('saves the playback second and the paragraph it falls in', async () => {
  narration = { get: view('available'), post: view('available') }
  renderPlayer()
  await waitFor(() => expect(document.querySelector('audio')).toBeTruthy())
  const audio = document.querySelector('audio')
  let position = 0
  Object.defineProperties(audio, {
    duration: { configurable: true, get: () => 120 },
    readyState: { configurable: true, get: () => 1 },
    paused: { configurable: true, get: () => true },
    ended: { configurable: true, get: () => false },
    currentTime: {
      configurable: true,
      get: () => position,
      set: value => {
        position = value
      },
    },
  })
  fireEvent.loadedMetadata(audio)
  fireEvent.play(audio)
  position = 42
  fireEvent.pause(audio)
  await waitFor(() => expect(calls('PUT', '/reader/progress')).toHaveLength(1))
  expect(JSON.parse(calls('PUT', '/reader/progress')[0][1].body)).toEqual({
    storyId: STORY,
    chapterId: CH1,
    paragraph: 0,
    paragraphCount: 1,
    audioSeconds: 42,
    duration: 120,
  })
})
