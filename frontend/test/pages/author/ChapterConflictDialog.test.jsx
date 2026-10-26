import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ChapterConflictDialog } from '../../../src/pages/author/ChapterConflictDialog'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
const latest = {
  id: 'chapter',
  storyId: 'story',
  version: 12,
  title: 'Tiêu đề mới',
  paragraphs: ['Thay đổi từ thẻ khác.'],
  canEdit: true,
}
function view(richDocument) {
  const callbacks = { onClose: vi.fn(), onApply: vi.fn() }
  render(
    <LocaleProvider>
      <ChapterConflictDialog
        chapter={{ id: 'chapter', storyId: 'story' }}
        title="Tiêu đề đang viết"
        body="Nội dung chưa lưu."
        richDocument={richDocument}
        {...callbacks}
      />
    </LocaleProvider>,
  )
  return callbacks
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('preserves structured local edits and allows explicit adoption of the structured server version', async () => {
  const local = {
    title: 'Đang viết',
    blocks: [{ type: 'quote', inlines: [{ text: 'Bản tôi', marks: ['italic'] }] }],
  }
  const remote = {
    title: 'Bản mới',
    blocks: [{ type: 'heading', level: 2, inlines: [{ text: 'Bản máy chủ', marks: ['bold'] }] }],
  }
  mocks.apiRequest.mockResolvedValue({ chapter: { ...latest, document: remote } })
  const callbacks = view(local)
  const input = await screen.findByRole('textbox', { name: 'Nội dung sau khi gộp' })
  await waitFor(() => expect(input.querySelector('em')?.textContent).toBe('Bản tôi'))
  const checked = screen.getByRole('checkbox')
  fireEvent.click(checked)
  fireEvent.click(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }))
  expect(callbacks.onApply.mock.calls[0][0].document.blocks).toEqual(local.blocks)
  fireEvent.click(screen.getByRole('button', { name: 'Dùng bản mới làm bản gộp' }))
  await waitFor(() => expect(input.querySelector('h2 strong')?.textContent).toBe('Bản máy chủ'))
  expect(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }).disabled).toBe(true)
  fireEvent.click(checked)
  fireEvent.click(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }))
  expect(callbacks.onApply.mock.calls[1][0]).toMatchObject({ document: remote, version: 12 })
})
it('compares full text and applies only the reviewed merge with the fetched version, without writing', async () => {
  mocks.apiRequest.mockResolvedValue({ chapter: latest })
  const callbacks = view()
  const remote = await screen.findByRole('textbox', { name: 'Nội dung đã lưu', exact: true })
  expect(remote.readOnly).toBe(true)
  expect(remote.value).toBe(latest.paragraphs[0])
  const local = screen.getByRole('textbox', { name: 'Nội dung sau khi gộp' })
  expect(local.value).toBe('Nội dung chưa lưu.')
  const apply = screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' })
  expect(apply.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.change(local, { target: { value: 'Thay đổi từ thẻ khác.\n\nNội dung chưa lưu.' } })
  expect(apply.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(apply)
  expect(callbacks.onApply).toHaveBeenCalledWith({
    title: 'Tiêu đề đang viết',
    body: 'Thay đổi từ thẻ khác.\n\nNội dung chưa lưu.',
    version: 12,
  })
  expect(mocks.apiRequest.mock.calls.every(([, o]) => !o.method)).toBe(true)
})
it('retains local merge edits across refresh errors and requires checking the refreshed version again', async () => {
  mocks.apiRequest.mockResolvedValueOnce({ chapter: latest })
  const callbacks = view()
  const local = await screen.findByRole('textbox', { name: 'Nội dung sau khi gộp' })
  fireEvent.change(local, { target: { value: 'Bản đang gộp được giữ.' } })
  fireEvent.click(screen.getByRole('checkbox'))
  mocks.apiRequest.mockRejectedValueOnce(new Error('network unavailable'))
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại bản đã lưu' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }).disabled).toBe(true)
  mocks.apiRequest.mockResolvedValueOnce({ chapter: { ...latest, version: 15 } })
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại bản đã lưu' }))
  expect((await screen.findByRole('textbox', { name: 'Nội dung sau khi gộp' })).value).toBe(
    'Bản đang gộp được giữ.',
  )
  expect(screen.getByRole('checkbox').checked).toBe(false)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }))
  expect(callbacks.onApply).toHaveBeenCalledWith(expect.objectContaining({ version: 15 }))
})
it.each(['locked', 'wrong-chapter', 'unsupported', 'missing'])(
  'never applies a %s response and keeps cancellation available',
  async kind => {
    if (kind === 'unsupported')
      mocks.apiRequest.mockRejectedValue(Object.assign(new Error('format'), { status: 409 }))
    else
      mocks.apiRequest.mockResolvedValue({
        chapter:
          kind === 'missing'
            ? null
            : { ...latest, ...(kind === 'locked' ? { canEdit: false } : { id: 'other' }) },
      })
    const callbacks = view()
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hủy gộp' }))
    expect(callbacks.onClose).toHaveBeenCalledOnce()
    expect(callbacks.onApply).not.toHaveBeenCalled()
  },
)
it('cannot apply until the latest request finishes', async () => {
  mocks.apiRequest.mockReturnValue(new Promise(() => {}))
  view()
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledOnce())
  expect(screen.getByRole('status').textContent).toContain('Đang tải')
  expect(screen.getByRole('button', { name: 'Đưa bản đã gộp về editor' }).disabled).toBe(true)
})
