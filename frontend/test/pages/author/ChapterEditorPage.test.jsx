import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ChapterEditorPage } from '../../../src/pages/author/ChapterEditorPage'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}))
const chapter = {
  id: 'seven',
  storyId: 'owned',
  storyTitle: 'Truyện của tôi',
  number: 7,
  title: 'Chương thật',
  paragraphs: ['Đoạn được lưu trong MongoDB.'],
  version: 9,
  canEdit: true,
  canCreate: true,
  outline: [
    { id: 'seven', number: 7, title: 'Chương thật' },
    { id: 'thirteen', number: 13, title: 'Chương sau' },
  ],
}
function SubmissionDestination() {
  return <p>submission-destination{useLocation().search}</p>
}
const view = (query = '') =>
  render(
    <MemoryRouter initialEntries={[`/author/stories/owned/chapters/seven/edit${query}`]}>
      <LocaleProvider>
        <Routes>
          <Route path="/author/submissions" element={<SubmissionDestination />} />
          <Route
            path="/author/stories/:storyId/chapters/:chapterId/edit"
            element={<ChapterEditorPage />}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const getEditor = () => screen.findByRole('textbox', { name: 'Nội dung chương có định dạng' })
const setEditorParagraphs = (editor, paragraphs) => {
  editor.replaceChildren(
    ...paragraphs.map(text => {
      const paragraph = document.createElement('p')
      paragraph.textContent = text
      return paragraph
    }),
  )
  fireEvent.input(editor)
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('loads structured editing explicitly, keeps marks when saving and previews the same document', async () => {
  const document = {
    title: chapter.title,
    blocks: [{ type: 'paragraph', inlines: [{ text: 'Nội dung đậm', marks: ['bold'] }] }],
  }
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT'
      ? { chapter: { version: 10 } }
      : { chapter: { ...chapter, document } },
  )
  view('?mode=rich')
  const editor = await screen.findByRole('textbox', { name: 'Nội dung chương có định dạng' })
  expect(screen.queryByText('Trợ lý AI', { exact: true })).toBeNull()
  await waitFor(() => expect(editor.querySelector('strong')?.textContent).toBe('Nội dung đậm'))
  expect(screen.getByRole('button', { name: 'In đậm', exact: true }).disabled).toBe(false)
  expect(screen.getByRole('button', { name: 'Hình ảnh', exact: true }).disabled).toBe(false)
  editor.querySelector('strong').textContent = 'Nội dung đậm vừa sửa'
  fireEvent.input(editor)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: {
        document: {
          ...document,
          blocks: [
            { type: 'paragraph', inlines: [{ text: 'Nội dung đậm vừa sửa', marks: ['bold'] }] },
          ],
        },
        expectedVersion: 9,
      },
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước', exact: true }))
  expect(
    screen.getByRole('article', { name: 'Nội dung chương xem trước' }).querySelector('strong')
      .textContent,
  ).toBe('Nội dung đậm vừa sửa')
})
it('does not alter rich content when formatting is requested without a selection', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter })
  view()
  const body = await getEditor()
  await waitFor(() => expect(body.textContent).toBe(chapter.paragraphs[0]))
  const original = body.textContent
  for (const name of ['In đậm', 'In nghiêng', 'Gạch chân', 'Tiêu đề 2', 'Tiêu đề 3', 'Trích dẫn']) {
    const button = screen.getByRole('button', { name, exact: true })
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-describedby')).toBe('editor-format-support')
    fireEvent.click(button)
  }
  expect(body.textContent).toBe(original)
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true)
})
it('retains structured paragraph, quote and scene-break edits', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: 10 } } : { chapter },
  )
  view()
  const body = await getEditor()
  setEditorParagraphs(body, ['Lời thoại', '*     *     *', 'Trích dẫn'])
  body.children[1].replaceWith(document.createElement('hr'))
  body.children[2].replaceWith(
    Object.assign(document.createElement('blockquote'), { textContent: 'Trích dẫn' }),
  )
  fireEvent.input(body)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: {
        document: {
          title: 'Chương thật',
          blocks: [
            { type: 'paragraph', inlines: [{ text: 'Lời thoại', marks: [] }] },
            { type: 'scene-break' },
            { type: 'quote', inlines: [{ text: 'Trích dẫn', marks: [] }] },
          ],
        },
        expectedVersion: 9,
      },
    }),
  )
})
it('saves edits beyond 20,000 characters without breaking an emoji', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: 10 } } : { chapter },
  )
  view()
  const text = 'a'.repeat(19999) + '🌸' + 'Nội dung vừa sửa.'
  const body = await getEditor()
  setEditorParagraphs(body, [text])
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true),
  )
  const document = mocks.apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1]
    .body.document
  expect(document.blocks[0].inlines[0].text).toBe(text)
  expect(document.blocks[0].inlines[0].text.isWellFormed()).toBe(true)
})
it('keeps an oversized paragraph count editable and explains how to resolve it before saving', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter })
  view()
  const editor = await getEditor()
  setEditorParagraphs(editor, Array(1001).fill('Đoạn'))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  expect((await screen.findByRole('alert')).textContent).toContain('tối đa 1.000 đoạn')
  expect(editor.querySelectorAll(':scope > p')).toHaveLength(1001)
  expect(mocks.apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
})
it('explains unsupported content without opening a truncated editable body', async () => {
  mocks.apiRequest.mockRejectedValue(
    Object.assign(new Error('Unsupported'), { code: 'unsupported_editor_format', status: 409 }),
  )
  view()
  await screen.findByText(/Định dạng của bản nội dung này chưa được trình soạn hiện tại hỗ trợ/)
  expect(screen.queryByRole('textbox', { name: 'Nội dung chương có định dạng' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Về trang quản lý truyện' }).getAttribute('href')).toBe(
    '/author/stories/owned',
  )
})
it('saves dirty paragraphs before opening the exact chapter submission package', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: 10 } } : { chapter },
  )
  view()
  const editor = await getEditor()
  setEditorParagraphs(editor, ['Bản cần lưu trước khi gửi'])
  fireEvent.click(screen.getByRole('button', { name: 'Gửi chương', exact: true }))
  fireEvent.click(await screen.findByRole('button', { name: 'Lưu và kiểm tra gửi duyệt' }))
  await screen.findByText('submission-destination?storyId=owned&chapterId=seven')
  expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
    method: 'PUT',
    body: {
      document: {
        title: 'Chương thật',
        blocks: [
          { type: 'paragraph', inlines: [{ text: 'Bản cần lưu trước khi gửi', marks: [] }] },
        ],
      },
      expectedVersion: 9,
    },
  })
})
it('loads actual paragraphs and uses the next stored chapter ID, then saves successive versions', async () => {
  let version = 9
  mocks.apiRequest.mockImplementation(async (_path, options) =>
    options?.method === 'PUT' ? { chapter: { version: ++version } } : { chapter },
  )
  view()
  const body = await getEditor()
  expect(body.querySelector(':scope > p').textContent).toBe(chapter.paragraphs[0])
  expect(screen.getByRole('link', { name: /Tiếp tục đến Chương 13/ }).getAttribute('href')).toBe(
    '/author/stories/owned/chapters/thirteen/edit',
  )
  setEditorParagraphs(body, ['Nội dung sửa.', 'Đoạn thứ hai.'])
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: {
        document: {
          title: 'Chương thật',
          blocks: [
            { type: 'paragraph', inlines: [{ text: 'Nội dung sửa.', marks: [] }] },
            { type: 'paragraph', inlines: [{ text: 'Đoạn thứ hai.', marks: [] }] },
          ],
        },
        expectedVersion: 9,
      },
    }),
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true),
  )
  setEditorParagraphs(body, ['Lần sửa kế tiếp.'])
  fireEvent.keyDown(body, { key: 's', ctrlKey: true })
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenLastCalledWith('/author/stories/owned/chapters/seven', {
      method: 'PUT',
      body: {
        document: {
          title: 'Chương thật',
          blocks: [{ type: 'paragraph', inlines: [{ text: 'Lần sửa kế tiếp.', marks: [] }] }],
        },
        expectedVersion: 10,
      },
    }),
  )
})
it('merges a stale draft explicitly and saves only on a separate action against the fetched version', async () => {
  let reads = 0
  let writes = 0
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      if (++writes === 1)
        throw Object.assign(new Error('Chương đã thay đổi'), {
          status: 409,
          code: 'stale_content',
        })
      return { chapter: { version: 14 } }
    }
    return {
      chapter:
        ++reads === 1
          ? chapter
          : {
              ...chapter,
              version: 13,
              document: {
                title: chapter.title,
                blocks: [
                  { type: 'paragraph', inlines: [{ text: 'Bản mới ở thẻ khác.', marks: [] }] },
                ],
              },
            },
    }
  })
  view()
  const body = await getEditor()
  setEditorParagraphs(body, ['Bản chưa lưu.'])
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await screen.findByRole('button', { name: 'So sánh với bản mới' })
  expect(body.querySelector(':scope > p').textContent).toBe('Bản chưa lưu.')
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Gửi chương', exact: true }).disabled).toBe(true)
  fireEvent.keyDown(body, { key: 's', ctrlKey: true })
  expect(writes).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: 'So sánh với bản mới' }))
  expect(await screen.findByRole('article', { name: 'Nội dung chương xem trước' })).toBeTruthy()
  const mergedBody = await screen.findByRole('textbox', { name: 'Nội dung sau khi gộp' })
  setEditorParagraphs(mergedBody, ['Bản mới ở thẻ khác.', 'Bản chưa lưu.'])
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }))
  expect(writes).toBe(1)
  expect(body.querySelectorAll(':scope > p')).toHaveLength(2)
  expect(body.querySelector(':scope > p').textContent).toBe('Bản mới ở thẻ khác.')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await waitFor(() => expect(writes).toBe(2))
  expect(mocks.apiRequest).toHaveBeenLastCalledWith('/author/stories/owned/chapters/seven', {
    method: 'PUT',
    body: {
      document: {
        title: 'Chương thật',
        blocks: [
          { type: 'paragraph', inlines: [{ text: 'Bản mới ở thẻ khác.', marks: [] }] },
          { type: 'paragraph', inlines: [{ text: 'Bản chưa lưu.', marks: [] }] },
        ],
      },
      expectedVersion: 13,
    },
  })
})
it('retains unsaved text on a conflict instead of reporting a successful save', async () => {
  mocks.apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') throw new Error('Phiên bản đã thay đổi')
    return { chapter }
  })
  view()
  const body = await getEditor()
  setEditorParagraphs(body, ['Bản chưa được lưu'])
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Phiên bản đã thay đổi')
  expect(body.querySelector(':scope > p').textContent).toBe('Bản chưa được lưu')
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(false)
})
it('opens published chapters read-only and never fabricates a missing chapter', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter: { ...chapter, canEdit: false, canCreate: false } })
  view()
  expect((await getEditor()).getAttribute('aria-disabled')).toBe('true')
  expect(screen.getByRole('button', { name: 'Lưu', exact: true }).disabled).toBe(true)
  cleanup()
  mocks.apiRequest.mockResolvedValue({ chapter: null })
  view()
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Nội dung chương có định dạng' })).toBeNull(),
  )
  expect(await screen.findByRole('link', { name: 'Về trang quản lý truyện' })).toBeTruthy()
})
it('uploads an image, requires alt text, saves its reference and previews the same draft image', async () => {
  const document = {
    title: chapter.title,
    blocks: [{ type: 'paragraph', inlines: [{ text: 'Chữ đậm', marks: ['bold'] }] }],
  }
  const asset = {
    id: '6ad218e46c26c31ff0ed423c',
    name: 'Minh họa.webp',
    url: '/author/media/image/content',
    storyId: chapter.storyId,
  }
  mocks.apiRequest.mockImplementation(async (path, options) => {
    if (path.startsWith('/author/media?') && options?.method === 'POST') return { asset }
    if (options?.method === 'PUT') return { chapter: { version: 10 } }
    return { chapter: { ...chapter, document } }
  })
  view('?mode=rich')
  fireEvent.click(await screen.findByRole('button', { name: 'Hình ảnh', exact: true }))
  const picker = screen.getByRole('dialog', { name: 'Chọn ảnh cho chương' })
  const file = new File(['image bytes'], asset.name, { type: 'image/webp' })
  fireEvent.change(picker.querySelector('input[type="file"]'), { target: { files: [file] } })
  await within(picker).findByText(asset.name)
  const [uploadPath, uploadOptions] = mocks.apiRequest.mock.calls.find(
    ([path, options]) => path.startsWith('/author/media?') && options?.method === 'POST',
  )
  const uploadQuery = new URLSearchParams(uploadPath.split('?')[1])
  expect(uploadQuery.get('storyId')).toBe(chapter.storyId)
  expect(uploadQuery.get('name')).toBe(asset.name)
  expect(uploadOptions).toMatchObject({ method: 'POST', body: file, binary: true })
  fireEvent.click(within(picker).getByRole('button', { name: 'Thêm ảnh cuối chương' }))
  expect(within(picker).getByRole('alert').textContent).toContain('Nhập mô tả ảnh')
  fireEvent.change(
    within(picker).getByRole('textbox', { name: 'Mô tả ảnh cho người đọc (bắt buộc)' }),
    { target: { value: 'Khu rừng xanh' } },
  )
  fireEvent.change(within(picker).getByRole('textbox', { name: 'Chú thích ảnh (tùy chọn)' }), {
    target: { value: 'Minh họa chương' },
  })
  fireEvent.click(within(picker).getByRole('button', { name: 'Thêm ảnh cuối chương' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  const editor = screen.getByRole('textbox', { name: 'Nội dung chương có định dạng' })
  expect(editor.querySelector('strong').textContent).toBe('Chữ đậm')
  expect(editor.querySelector('img').getAttribute('src')).toBe(
    `/api/author/media/${asset.id}/content`,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }))
  await waitFor(() =>
    expect(
      mocks.apiRequest.mock.calls.some(
        ([, options]) =>
          options?.method === 'PUT' && options.body.document.blocks[1]?.mediaId === asset.id,
      ),
    ).toBe(true),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước', exact: true }))
  const preview = screen.getByRole('article', { name: 'Nội dung chương xem trước' })
  expect(
    within(preview).getByRole('img', { name: 'Khu rừng xanh' }).getAttribute('crossorigin'),
  ).toBe('use-credentials')
  expect(within(preview).getByText('Minh họa chương')).toBeTruthy()
})
