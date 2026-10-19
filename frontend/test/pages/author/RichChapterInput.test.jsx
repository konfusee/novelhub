import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RichChapterInput } from '../../../src/pages/author/RichChapterInput'
afterEach(cleanup)
it('changes only selected block types and supports undo/redo without flattening headings or marks', () => {
  const document = {
    title: 'Chương',
    blocks: [
      { type: 'heading', level: 2, inlines: [{ text: 'Mở đầu', marks: ['bold'] }] },
      { type: 'paragraph', inlines: [{ text: 'Nội dung', marks: ['italic'] }] },
    ],
  }
  const ref = createRef()
  const onChange = vi.fn()
  render(
    <RichChapterInput
      ref={ref}
      initialDocument={document}
      label="Bản thảo"
      onChange={onChange}
      onSave={() => {}}
      onError={() => {}}
    />,
  )
  const input = screen.getByRole('textbox')
  const range = window.document.createRange()
  range.setStart(input.children[0].querySelector('strong').firstChild, 'Mở đầu'.length)
  range.setEnd(input.children[1], input.children[1].childNodes.length)
  window.getSelection().removeAllRanges()
  window.getSelection().addRange(range)
  act(() => ref.current.format('quote'))
  expect(onChange.mock.calls.at(-1)[0].blocks).toEqual([
    document.blocks[0],
    { ...document.blocks[1], type: 'quote' },
  ])
  expect(input.children[0].tagName).toBe('H2')
  fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })
  expect(onChange.mock.calls.at(-1)[0].blocks).toEqual(document.blocks)
  fireEvent.keyDown(input, { ctrlKey: true, shiftKey: true, key: 'z' })
  expect(input.children[1].tagName).toBe('BLOCKQUOTE')
  input.textContent = 'Đoạn mới thay toàn bộ'
  const replacementRange = window.document.createRange()
  replacementRange.selectNodeContents(input.firstChild)
  window.getSelection().removeAllRanges()
  window.getSelection().addRange(replacementRange)
  fireEvent.input(input)
  act(() => ref.current.format('heading2'))
  expect(onChange.mock.calls.at(-1)[0].blocks).toEqual([
    { type: 'heading', level: 2, inlines: [{ text: 'Đoạn mới thay toàn bộ', marks: [] }] },
  ])
})
it('keeps image blocks and captions across text edits and undo, and removes them without deleting library assets', () => {
  const ref = createRef()
  const onChange = vi.fn()
  const block = {
    type: 'image',
    mediaId: '6ad218e46c26c31ff0ed423c',
    alt: 'Rừng',
    caption: 'Minh họa',
  }
  const initialDocument = {
    title: 'Chương',
    blocks: [{ type: 'paragraph', inlines: [{ text: 'Nội dung', marks: [] }] }],
  }
  render(
    <RichChapterInput
      ref={ref}
      initialDocument={initialDocument}
      label="Bản thảo"
      onChange={onChange}
    />,
  )
  act(() => ref.current.changeImage(null, block))
  const input = screen.getByRole('textbox')
  expect(input.querySelector('img').alt).toBe('Rừng')
  input.querySelector('p').textContent = 'Chỉnh văn bản'
  fireEvent.input(input)
  expect(onChange.mock.calls.at(-1)[0].blocks[1]).toEqual(block)
  act(() => ref.current.changeImage(1, { caption: 'Chú thích đã sửa' }))
  expect(input.querySelector('figcaption').textContent).toBe('Chú thích đã sửa')
  act(() => ref.current.changeImage(1, null))
  expect(input.querySelector('img')).toBeNull()
  fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })
  expect(input.querySelector('img').alt).toBe('Rừng')
})
