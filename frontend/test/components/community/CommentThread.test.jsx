import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { CommentThread } from '../../../src/components/community/CommentThread'

const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: true } }))
vi.mock('../../../src/context/AuthContext', () => ({ useAuth: () => mocks.auth }))

const STORY_ID = '507f1f77bcf86cd799439011'
const PARENT_ID = '507f1f77bcf86cd799439021'
const REPLY_ID = '507f1f77bcf86cd799439022'
const comment = (overrides = {}) => ({
  id: PARENT_ID,
  body: 'Chương này hay quá',
  author: { id: 'a1', displayName: 'Alice' },
  createdAt: '2026-10-28T10:00:00Z',
  edited: false,
  deleted: false,
  likeCount: 3,
  liked: false,
  mine: false,
  parentId: null,
  version: 1,
  replies: [],
  ...overrides,
})
const feed = {
  items: [
    comment({
      edited: true,
      replies: [
        comment({
          id: REPLY_ID,
          parentId: PARENT_ID,
          body: 'Đồng ý!',
          author: { id: 'a2', displayName: 'Deleted user' },
          likeCount: 7,
        }),
      ],
    }),
  ],
  total: 1,
  page: 1,
  pageSize: 20,
}

const json = (status, data) => ({ ok: status < 400, status, json: async () => data })
let fetchMock
beforeEach(() => {
  mocks.auth = { isAuthenticated: true }
  fetchMock = vi.fn(async () => json(200, feed))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const view = () =>
  render(
    <MemoryRouter initialEntries={[`/story/${STORY_ID}`]}>
      <LocaleProvider>
        <CommentThread targetType="story" targetId={STORY_ID} />
      </LocaleProvider>
    </MemoryRouter>,
  )

it('renders comments and their replies from the API', async () => {
  view()
  expect(await screen.findByText('Chương này hay quá')).toBeTruthy()
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/community/stories/${STORY_ID}/comments?page=1`)
  expect(screen.getByText('Đồng ý!')).toBeTruthy()
  expect(screen.getByText('Alice')).toBeTruthy()
  expect(screen.getByText('Deleted user')).toBeTruthy()
  expect(screen.getByText('(đã chỉnh sửa)')).toBeTruthy()
  // One level only: replies have no reply action.
  expect(screen.getAllByRole('button', { name: 'Trả lời' })).toHaveLength(1)
})

it('posts a reply with the parent comment id', async () => {
  const reply = comment({
    id: '507f1f77bcf86cd799439023',
    parentId: PARENT_ID,
    body: 'Mình cũng thấy vậy',
    mine: true,
    likeCount: 0,
  })
  fetchMock.mockImplementation(async (url, options) =>
    options?.method === 'POST' ? json(201, { comment: reply }) : json(200, feed),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Trả lời' }))
  fireEvent.change(screen.getByLabelText('Trả lời Alice'), {
    target: { value: '  Mình cũng thấy vậy  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }))
  expect(await screen.findByText('Mình cũng thấy vậy')).toBeTruthy()
  const [url, options] = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(url).toBe(`/api/community/stories/${STORY_ID}/comments`)
  expect(JSON.parse(options.body)).toEqual({ body: 'Mình cũng thấy vậy', parentId: PARENT_ID })
})

it('rolls back an optimistic like when the request fails', async () => {
  let fail
  fetchMock.mockImplementation((url, options) =>
    options?.method === 'PUT'
      ? new Promise(resolve => {
          fail = () =>
            resolve(json(500, { error: { code: 'server_error', message: 'Máy chủ đang bận.' } }))
        })
      : Promise.resolve(json(200, feed)),
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: /Thích bình luận \(3/ }))
  expect(await screen.findByRole('button', { name: /Bỏ thích bình luận \(4/ })).toBeTruthy()
  const [url, options] = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(url).toBe(`/api/community/comments/${PARENT_ID}/like`)
  expect(JSON.parse(options.body)).toEqual({ liked: true })
  await act(async () => fail())
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Thích bình luận \(3/ })).toBeTruthy(),
  )
  expect(screen.getByRole('alert').textContent).toBe('Máy chủ đang bận.')
})

it('shows a login prompt instead of the composer when signed out', async () => {
  mocks.auth = { isAuthenticated: false }
  view()
  expect(await screen.findByText('Chương này hay quá')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/login')
  expect(screen.queryByLabelText('Viết bình luận')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Trả lời' })).toBeNull()
})
