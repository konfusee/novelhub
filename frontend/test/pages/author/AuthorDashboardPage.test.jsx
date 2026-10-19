import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { AuthorDashboardPage } from '../../../src/pages/author/AuthorDashboardPage'
const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))
vi.mock('../../../src/api/client', () => ({
  apiRequest: mocks.apiRequest,
}))
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}))
const dashboard = {
  stats: {
    views: 1234,
    followers: 2,
    audioPlays: null,
  },
  stories: [
    {
      id: 'owned-story',
      title: 'Truyện của tác giả thật',
      status: 'published',
      chapters: 7,
      reads: '1234',
      rating: '4.0',
    },
    {
      id: 'draft-story',
      title: 'Truyện đang soạn',
      status: 'draft',
      chapters: 1,
      reads: '0',
      rating: '—',
    },
  ],
  drafts: [
    {
      id: 'owned-story',
      title: 'Truyện của tác giả thật',
      chapterId: 'draft-seven',
      chapter: 'Chương nháp thật',
      written: 123,
    },
  ],
  draftCount: 1,
  draftWords: 123,
  feedback: [
    {
      id: 'root-comment',
      storyId: 'owned-story',
      author: 'Độc giả thật',
      body: 'Phản hồi trong MongoDB',
      canReply: true,
    },
  ],
  feedbackTotal: 1,
}
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorDashboardPage />
      </LocaleProvider>
    </MemoryRouter>,
  )
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('shows owner metrics/drafts and filters story state without mock goals, AI claims or demo links', async () => {
  mocks.apiRequest.mockResolvedValue(dashboard)
  view()
  expect(await screen.findByText('Chương nháp thật')).toBeTruthy()
  expect(
    screen
      .getByRole('link', {
        name: 'Viết tiếp',
      })
      .getAttribute('href'),
  ).toBe('/author/stories/owned-story/chapters/draft-seven/edit')
  expect(
    screen.queryByRole('heading', {
      name: 'Trợ lý sáng tác AI',
    }),
  ).toBeNull()
  expect(screen.queryByText('1.2M')).toBeNull()
  expect(screen.queryByText('Đang hoạt động 4.5')).toBeNull()
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Bản nháp',
      exact: true,
    }),
  )
  expect(
    screen
      .getAllByRole('link', {
        name: 'Quản lý truyện',
      })
      .every(link => link.getAttribute('href') === '/author/stories/draft-story'),
  ).toBe(true)
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Cài đặt mục tiêu',
    }),
  )
  expect(
    screen.getByText(
      'Chưa hỗ trợ lưu mục tiêu sáng tác. Số liệu này sẽ xuất hiện khi có dữ liệu từ hệ thống.',
    ),
  ).toBeTruthy()
  expect(
    screen.queryByRole('button', {
      name: 'Lưu mục tiêu',
    }),
  ).toBeNull()
})
it('requires selecting a reader comment and persists a targeted reply, preserving failed input', async () => {
  let fail = true
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method) {
      if (fail) throw new Error('offline')
      return {
        ok: true,
      }
    }
    return dashboard
  })
  view()
  expect(await screen.findByText('“Phản hồi trong MongoDB”')).toBeTruthy()
  expect(
    screen.getByRole('textbox', {
      name: 'Trả lời độc giả',
    }).disabled,
  ).toBe(true)
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Trả lời',
      exact: true,
    }),
  )
  fireEvent.change(
    screen.getByRole('textbox', {
      name: 'Trả lời độc giả',
    }),
    {
      target: {
        value: 'Trả lời từ tác giả',
      },
    },
  )
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Gửi phản hồi',
    }),
  )
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(
    screen.getByRole('textbox', {
      name: 'Trả lời độc giả',
    }).value,
  ).toBe('Trả lời từ tác giả')
  fail = false
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Gửi phản hồi',
    }),
  )
  expect(await screen.findByText('Đã lưu trả lời vào bình luận đã chọn.')).toBeTruthy()
  expect(mocks.apiRequest).toHaveBeenCalledWith('/community/stories/owned-story/comments', {
    method: 'POST',
    body: {
      body: 'Trả lời từ tác giả',
      parentId: 'root-comment',
    },
  })
})
it('retries API errors to an actual empty author account without fixture fallback', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'))
  view()
  expect(await screen.findByText('Không tải được chỉ số tổng quan')).toBeTruthy()
  mocks.apiRequest.mockResolvedValue({
    ...dashboard,
    stories: [],
    drafts: [],
    feedback: [],
    feedbackTotal: 0,
    draftWords: 0,
    draftCount: 0,
  })
  fireEvent.click(
    screen.getAllByRole('button', {
      name: 'Thử lại',
    })[0],
  )
  expect(await screen.findByText('Bạn chưa có truyện nào')).toBeTruthy()
  expect(screen.queryByText('The Silent Forest')).toBeNull()
})
