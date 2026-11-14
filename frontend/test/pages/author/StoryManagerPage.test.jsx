import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { StoryManagerPage } from '../../../src/pages/author/StoryManagerPage'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}))
const workspace = {
  story: {
    id: 'owned',
    title: 'Truyện thuộc tài khoản',
    description: 'Tóm tắt được lưu thực tế và đủ dài để kiểm tra việc sửa thông tin.',
    genre: 'Kỳ ảo',
    author: 'Tác giả thật',
    status: 'published',
    version: 7,
    canEdit: true,
    canEditMetadata: true,
  },
  chapters: [
    {
      id: 'seven',
      number: 7,
      title: 'Chương bảy thật',
      status: 'draft',
      words: 23,
      reads: 0,
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ],
  stats: { availableWords: 23, publishedChapters: 0, reads: 0, rating: '—', ratings: 0 },
}
function EditDestination() {
  const location = useLocation()
  return (
    <p>
      {location.pathname}
      {location.search}
    </p>
  )
}
const view = () =>
  render(
    <MemoryRouter initialEntries={['/author/stories/owned']}>
      <LocaleProvider>
        <Routes>
          <Route path="/author/stories/:storyId" element={<StoryManagerPage />} />
          <Route
            path="/author/stories/:storyId/chapters/:chapterId/edit"
            element={<EditDestination />}
          />
          <Route path="/author/stories" element={<EditDestination />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const openChapterActions = async () => {
  const row = await screen.findByRole('row', { name: /Chương 7: Chương bảy thật/ })
  fireEvent.click(within(row).getByRole('button', { name: 'Thao tác khác cho chương' }))
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('uses server lifecycle flags and refreshes the chapter row after archive and restore', async () => {
  let archived = false
  let version = 3
  let storyVersion = 7
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      archived = options.body.action === 'archive'
      version++
      storyVersion++
      return {}
    }
    return {
      ...workspace,
      story: { ...workspace.story, status: 'draft', version: storyVersion },
      chapters: [
        {
          ...workspace.chapters[0],
          version,
          status: archived ? 'archived' : 'draft',
          canArchive: !archived,
          canRestore: archived,
        },
      ],
    }
  })
  view()
  await openChapterActions()
  expect(
    (
      await screen.findByRole('link', { name: 'Xem phân tích chương 7: Chương bảy thật' })
    ).getAttribute('href'),
  ).toBe('/author/analytics?storyId=owned&chapterId=seven')
  expect(screen.getByRole('link', { name: 'Xem phân tích truyện' }).getAttribute('href')).toBe(
    '/author/analytics?storyId=owned',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Đóng menu thao tác' }))
  await openChapterActions()
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu trữ chương nháp' }))
  expect(mocks.apiRequest.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }))
  expect(await screen.findByRole('link', { name: 'Xem nội dung' })).toBeTruthy()
  await openChapterActions()
  const restore = await screen.findByRole('button', { name: 'Khôi phục chương nháp' })
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven/lifecycle', {
    method: 'POST',
    body: { action: 'archive', expectedVersion: 3, expectedStoryVersion: 7 },
  })
  fireEvent.click(restore)
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }))
  await screen.findByRole('link', { name: 'Viết tiếp' })
  await openChapterActions()
  await screen.findByRole('button', { name: 'Lưu trữ chương nháp' })
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven/lifecycle', {
    method: 'POST',
    body: { action: 'restore', expectedVersion: 4, expectedStoryVersion: 8 },
  })
}, 15000)
it('loads a story submission history once and renders its submitted version', async () => {
  mocks.apiRequest.mockImplementation(async path => {
    if (path.startsWith('/author/submissions?'))
      return {
        items: [
          {
            id: 'submission-1',
            title: 'Truyện đã gửi duyệt',
            status: 'approved',
            submittedAt: '2026-10-01T00:00:00Z',
            revisionNumber: 2,
            history: [
              {
                id: 'history-1',
                action: 'submitted',
                outcome: 'validated',
                feedback: 'Đã nhận bản gửi.',
                occurredAt: '2026-10-01T00:00:00Z',
              },
            ],
          },
        ],
        stories: [],
        page: 1,
        pageCount: 1,
        total: 1,
        pageSize: 5,
      }
    return workspace
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt & phản hồi' }))
  expect(await screen.findByText('Truyện đã gửi duyệt')).toBeTruthy()
  expect(screen.getByText('Đã nhận bản gửi.')).toBeTruthy()
  expect(screen.getByText('Đã kiểm tra')).toBeTruthy()
  await waitFor(() =>
    expect(
      mocks.apiRequest.mock.calls.filter(([path]) => path.startsWith('/author/submissions?')),
    ).toHaveLength(1),
  )
})
it('enables chapter ordering only when the backend confirms the private draft is eligible', async () => {
  mocks.apiRequest.mockResolvedValue(workspace)
  view()
  expect(
    (await screen.findByRole('button', { name: 'Sắp xếp chương', exact: true })).disabled,
  ).toBe(true)
  cleanup()
  mocks.apiRequest.mockResolvedValue({
    ...workspace,
    story: { ...workspace.story, status: 'draft', canReorder: true },
    chapters: [
      ...workspace.chapters,
      { ...workspace.chapters[0], id: 'second', title: 'Chương thứ hai', number: 8 },
    ],
  })
  view()
  const button = await screen.findByRole('button', { name: 'Sắp xếp chương', exact: true })
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.click(button)
  expect(await screen.findByRole('dialog', { name: 'Sắp xếp chương' })).toBeTruthy()
  expect(screen.getByRole('list', { name: 'Thứ tự chương dự kiến' }).textContent).toContain(
    'Chương thứ hai',
  )
})
it('confirms archive and restore using persisted versions without deleting the work', async () => {
  let archived = false
  let version = 7
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories') return { items: [] }
    if (options?.method === 'POST') {
      archived = options.body.action === 'archive'
      version++
      return { story: { id: 'owned', status: archived ? 'archived' : 'draft', version } }
    }
    return {
      ...workspace,
      story: {
        ...workspace.story,
        status: archived ? 'archived' : 'draft',
        version,
        canEdit: !archived,
        canEditMetadata: !archived,
        canArchive: !archived,
        canRestore: archived,
      },
    }
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu trữ bản nháp', exact: true }))
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận', exact: true }))
  const restore = await screen.findByRole('button', { name: 'Khôi phục bản nháp', exact: true })
  expect(screen.getByRole('textbox', { name: 'Tên truyện' }).disabled).toBe(true)
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/lifecycle', {
    method: 'POST',
    body: { action: 'archive', expectedVersion: 7 },
  })
  fireEvent.click(restore)
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận', exact: true }))
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Tên truyện' }).disabled).toBe(false),
  )
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/lifecycle', {
    method: 'POST',
    body: { action: 'restore', expectedVersion: 8 },
  })
})
it('shows delete for an eligible draft and deletes it only after confirmation', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') return { story: { id: 'owned', status: 'archived' } }
    return {
      ...workspace,
      story: {
        ...workspace.story,
        status: 'draft',
        canEdit: true,
        canDelete: true,
        canArchive: true,
      },
    }
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Xóa truyện', exact: true }))
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa', exact: true }))
  await screen.findByText('/author/stories')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/lifecycle', {
    method: 'POST',
    body: { action: 'delete', expectedVersion: 7 },
  })
})
it('prevents archiving unsaved edits and retains the form when archive conflicts', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories') return { items: [] }
    if (options?.method === 'POST') throw new Error('Truyện đã thay đổi')
    return { ...workspace, story: { ...workspace.story, status: 'draft', canArchive: true } }
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }))
  const title = screen.getByRole('textbox', { name: 'Tên truyện' })
  fireEvent.change(title, { target: { value: 'Chưa lưu' } })
  expect(screen.getByRole('button', { name: 'Lưu trữ bản nháp', exact: true }).disabled).toBe(true)
  fireEvent.change(title, { target: { value: workspace.story.title } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ bản nháp', exact: true }))
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận', exact: true }))
  await screen.findByText('Truyện đã thay đổi')
  expect(title.value).toBe(workspace.story.title)
  expect(screen.queryByRole('button', { name: 'Khôi phục bản nháp', exact: true })).toBeNull()
})
it('loads real categories and saves the single selected main category in the next draft revision', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories')
      return {
        items: [
          { id: 'fantasy', name: 'Kỳ ảo' },
          { id: 'mystery', name: 'Bí ẩn' },
        ],
      }
    if (options?.method === 'PUT')
      return { story: { ...workspace.story, categoryId: options.body.categoryId, version: 8 } }
    return { ...workspace, story: { ...workspace.story, categoryId: 'fantasy' } }
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }))
  const mystery = await screen.findByRole('radio', { name: 'Bí ẩn', exact: true })
  expect(screen.getByRole('radio', { name: 'Kỳ ảo', exact: true }).checked).toBe(true)
  fireEvent.click(mystery)
  expect(screen.getByRole('radio', { name: 'Kỳ ảo', exact: true }).checked).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
  await screen.findByText('Đã lưu thông tin truyện.')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned', {
    method: 'PUT',
    body: {
      title: workspace.story.title,
      description: workspace.story.description,
      expectedVersion: 7,
      categoryId: 'mystery',
      coverMediaId: null,
      coverBannerMediaId: null,
    },
  })
})
it('edits tags with the shared rules and sends them only when they changed', async () => {
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path === '/catalog/categories') return { items: [{ id: 'fantasy', name: 'Kỳ ảo' }] }
    if (options?.method === 'PUT')
      return { story: { ...workspace.story, tags: options.body.tags, version: 8 } }
    return {
      ...workspace,
      story: { ...workspace.story, categoryId: 'fantasy', tags: ['CoDai', 'slow-burn'] },
    }
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin' }))
  await screen.findByRole('radio', { name: 'Kỳ ảo', exact: true })
  fireEvent.click(screen.getByRole('button', { name: 'Xóa thẻ slow-burn' }))
  const tagInput = screen.getByRole('textbox', { name: 'Thẻ khám phá' })
  fireEvent.change(tagInput, { target: { value: 'codai' } })
  fireEvent.keyDown(tagInput, { key: 'Enter' })
  expect(screen.getByRole('alert').textContent).toBe('Thẻ này đã có trong danh sách.')
  fireEvent.change(tagInput, { target: { value: '#Hồi Hộp' } })
  fireEvent.keyDown(tagInput, { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
  await screen.findByText('Đã lưu thông tin truyện.')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned', {
    method: 'PUT',
    body: {
      title: workspace.story.title,
      description: workspace.story.description,
      expectedVersion: 7,
      tags: ['CoDai', 'HồiHộp'],
      coverMediaId: null,
      coverBannerMediaId: null,
    },
  })
})
it('reads owned chapters with exact IDs and saves versioned metadata from the existing form', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? {
          story: {
            ...workspace.story,
            title: options.body.title,
            description: options.body.description,
            version: 8,
          },
        }
      : workspace,
  )
  view()
  expect(await screen.findByText('Chương 7: Chương bảy thật')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Viết tiếp' }).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/seven/edit',
  )
  expect(screen.queryByText('184.200')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên truyện' }), {
    target: { value: 'Tên bản nháp mới' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
  expect(await screen.findByText('Đã lưu thông tin truyện.')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tên bản nháp mới')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned', {
    method: 'PUT',
    body: {
      title: 'Tên bản nháp mới',
      description: workspace.story.description,
      expectedVersion: 7,
      coverMediaId: null,
      coverBannerMediaId: null,
    },
  })
})
it('creates a real chapter draft and reloads the server list', async () => {
  let created = false
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      created = true
      return { chapter: { id: 'new-real' } }
    }
    return created
      ? {
          ...workspace,
          chapters: [
            ...workspace.chapters,
            {
              id: 'new-real',
              number: 8,
              title: 'Chương mới thật',
              status: 'draft',
              words: 0,
              reads: 0,
            },
          ],
        }
      : workspace
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm chương mới' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên chương' }), {
    target: { value: 'Chương mới thật' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }))
  expect(await screen.findByText('Chương 8: Chương mới thật')).toBeTruthy()
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters', {
    method: 'POST',
    body: { title: 'Chương mới thật', paragraphs: [''] },
  })
})
it('keeps unsaved metadata after a conflict and never claims a successful save', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') throw new Error('Phiên bản đã thay đổi')
    return workspace
  })
  view()
  await screen.findByText('Chương 7: Chương bảy thật')
  fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên truyện' }), {
    target: { value: 'Chưa lưu' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
  expect(await screen.findByText('Phiên bản đã thay đổi')).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'Tên truyện' }).value).toBe('Chưa lưu')
  expect(screen.queryByText('Đã lưu thông tin truyện.')).toBeNull()
})
it('shows an error instead of exposing a fallback story and disables creation for locked works', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('offline'))
  view()
  expect(await screen.findByText('Không tải được thông tin quản lý truyện')).toBeTruthy()
  expect(screen.queryByText('The Silent Forest')).toBeNull()
  mocks.apiRequest.mockResolvedValue({
    ...workspace,
    story: { ...workspace.story, canEdit: false },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Thêm chương mới' }).disabled).toBe(true),
  )
})
it('uploads a story cover using the current story ID', async () => {
  const file = new File(['image'], 'cover.png', { type: 'image/png' })
  mocks.apiRequest.mockImplementation(async path => {
    if (path === '/catalog/categories') return { items: [] }
    if (path.startsWith('/author/media?')) return { asset: { id: 'cover' } }
    return workspace
  })
  view()
  await screen.findByText('Chương 7: Chương bảy thật')
  fireEvent.click(screen.getByRole('button', { name: 'Sửa thông tin', exact: true }))
  const coverInput = document.querySelector('input[type="file"]')
  fireEvent.change(coverInput, { target: { files: [file] } })
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/media?name=cover.png&kind=cover&storyId=owned',
      {
        method: 'POST',
        body: file,
        binary: true,
      },
    ),
  )
})
it.each([false, true])(
  'uses the server metadata-release flag on an already published story: %s',
  async canReleaseMetadata => {
    mocks.apiRequest.mockResolvedValue({
      ...workspace,
      story: { ...workspace.story, status: 'published', canReleaseMetadata },
    })
    view()
    await screen.findByRole('heading', { name: 'Truyện thuộc tài khoản' })
    expect(Boolean(screen.queryByRole('button', { name: 'Phát hành truyện', exact: true }))).toBe(
      canReleaseMetadata,
    )
    expect(screen.getByRole('link', { name: 'Xem truyện đã công khai' }).getAttribute('href')).toBe(
      '/stories/owned',
    )
  },
)
it('opens chapter release using only the server eligibility hint and refreshes after confirmation', async () => {
  let released = false
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      released = true
      return { chapter: { id: 'seven', status: 'published' } }
    }
    if (path.endsWith('/release'))
      return {
        target: {
          chapterId: 'seven',
          version: 3,
          storyVersion: 7,
          revisionId: 'rev',
          submissionId: 'sub',
          title: 'Chương bảy thật',
        },
        ready: true,
        checks: [],
      }
    return {
      ...workspace,
      chapters: [
        {
          ...workspace.chapters[0],
          status: released ? 'published' : 'approved',
          canRelease: !released,
        },
      ],
    }
  })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành chương', exact: true }))
  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành ngay' }))
  await screen.findByText('Đã phát hành chương. Độc giả có thể đọc phiên bản đã duyệt.')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Phát hành chương', exact: true })).toBeNull(),
  )
  expect(
    (await screen.findByRole('row', { name: /Chương 7: Chương bảy thật/ })).textContent,
  ).toContain('Đã xuất bản')
})
it('unpublishes through server eligibility, refreshes the row and retains it in the unpublished filter', async () => {
  let unpublished = false
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      unpublished = true
      return { chapter: { id: 'seven', status: 'unpublished' } }
    }
    return {
      ...workspace,
      chapters: [
        {
          ...workspace.chapters[0],
          status: unpublished ? 'unpublished' : 'published',
          canUnpublish: !unpublished,
          version: 3,
        },
      ],
    }
  })
  view()
  await openChapterActions()
  fireEvent.click(await screen.findByRole('button', { name: 'Gỡ xuất bản chương', exact: true }))
  expect(unpublished).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }))
  await screen.findByText('Đã gỡ xuất bản chương. Nội dung và lịch sử vẫn được giữ lại.')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Gỡ xuất bản chương', exact: true })).toBeNull(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Đã gỡ xuất bản', exact: true }))
  expect(screen.getByRole('row', { name: /Chương 7: Chương bảy thật/ }).textContent).toContain(
    'Đã gỡ xuất bản',
  )
})
it('opens a new rich correction from the exact unpublished chapter source after confirmation', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'POST'
      ? {
          revision: {
            id: 'fresh',
            storyId: 'owned',
            chapterId: 'seven',
            formatVersion: 'blocks-v3',
          },
        }
      : {
          ...workspace,
          chapters: [
            {
              ...workspace.chapters[0],
              status: 'unpublished',
              reviseSource: { id: 'source', version: 12 },
            },
          ],
        },
  )
  view()
  await openChapterActions()
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo bản sửa chương', exact: true }))
  expect(
    mocks.apiRequest.mock.calls.filter(([, options]) => options.method === 'POST'),
  ).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }))
  await screen.findByText('/author/stories/owned/chapters/seven/edit')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/submissions/source/revise', {
    method: 'POST',
    body: { expectedVersion: 12 },
  })
})
it('opens real schedule controls from the chapter row and refreshes status after saving', async () => {
  let scheduled = false
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') {
      scheduled = true
      return {
        chapter: {
          id: 'seven',
          status: 'scheduled',
          requestedReleaseAt: options.body.requestedReleaseAt,
        },
      }
    }
    if (path.endsWith('/schedule'))
      return {
        target: {
          chapterId: 'seven',
          revisionId: 'rev',
          submissionId: 'sub',
          version: 3,
          storyVersion: 7,
          title: 'Gói chương đã duyệt',
        },
        status: 'approved',
        ready: true,
        canCancel: false,
        checks: [],
        waiting: [],
        requestedReleaseAt: null,
      }
    return {
      ...workspace,
      chapters: [
        {
          ...workspace.chapters[0],
          status: scheduled ? 'scheduled' : 'approved',
          canManageSchedule: true,
          requestedReleaseAt: scheduled ? '2030-10-20T10:30:00Z' : null,
        },
      ],
    }
  })
  view()
  await openChapterActions()
  fireEvent.click(await screen.findByRole('button', { name: 'Lên lịch phát hành' }))
  await screen.findByRole('heading', { name: 'Gói chương đã duyệt' })
  fireEvent.change(screen.getByLabelText('Thời gian phát hành'), {
    target: { value: '2030-10-20T10:30' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch phát hành' }))
  await screen.findByText('Đã lưu lịch phát hành trên máy chủ.')
  await openChapterActions()
  expect(await screen.findByRole('button', { name: 'Đổi hoặc hủy lịch' })).toBeTruthy()
})

it('blocks story withdrawal while metadata edits are unsaved', async () => {
  mocks.apiRequest.mockImplementation(async path =>
    path === '/catalog/categories'
      ? { items: [] }
      : {
          ...workspace,
          story: { ...workspace.story, canUnpublish: true, publishedRevisionId: 'revision' },
        },
  )
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa thông tin', exact: true }))
  const button = await screen.findByRole('button', { name: 'Ngừng phát hành truyện', exact: true })
  expect(button.disabled).toBe(false)
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên truyện' }), {
    target: { value: 'Unsaved title' },
  })
  expect(button.disabled).toBe(true)
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
})
