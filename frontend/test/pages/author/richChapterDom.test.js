import { expect, it } from 'vitest'
import {
  readChapterDom,
  writeChapterDom,
  richChapterBody,
} from '../../../src/pages/author/richChapterDom'
it('round-trips every supported block, combined mark, Unicode and literal HTML without executing markup', () => {
  const document = {
    title: 'Bản thảo',
    blocks: [
      {
        type: 'heading',
        level: 2,
        inlines: [{ text: 'Tiếng Việt 🌸', marks: ['bold', 'italic', 'underline'] }],
      },
      { type: 'heading', level: 3, inlines: [] },
      { type: 'paragraph', inlines: [{ text: '<script>alert(1)</script>', marks: [] }] },
      { type: 'quote', inlines: [{ text: 'Lời\nxuống dòng', marks: ['italic'] }] },
      { type: 'scene-break' },
      { type: 'paragraph', inlines: [] },
    ],
  }
  const root = window.document.createElement('div')
  writeChapterDom(root, document)
  expect(root.querySelector('script')).toBeNull()
  expect(readChapterDom(root)).toEqual(document.blocks)
  expect(richChapterBody(document)).toContain('Tiếng Việt 🌸')
})
it('accepts browser paragraph/blockquote structures and does not leak styled marks to sibling text', () => {
  const root = document.createElement('div')
  root.innerHTML =
    '<div><span style="font-weight:bold">Đậm</span> thường</div><blockquote><p>Trích dẫn</p></blockquote><p><br></p>'
  expect(readChapterDom(root)).toEqual([
    {
      type: 'paragraph',
      inlines: [
        { text: 'Đậm', marks: ['bold'] },
        { text: ' thường', marks: [] },
      ],
    },
    { type: 'quote', inlines: [{ text: 'Trích dẫn', marks: [] }] },
    { type: 'paragraph', inlines: [] },
  ])
})
it('never persists raw HTML nodes, image references, script bodies or style declarations', () => {
  const root = document.createElement('div')
  root.innerHTML =
    '<p>Văn bản<img src="x" onerror="alert(1)"><script>bad()</script><style>p{color:red}</style><a href="javascript:bad()">liên kết</a></p>'
  expect(readChapterDom(root)).toEqual([
    { type: 'paragraph', inlines: [{ text: 'Văn bảnliên kết', marks: [] }] },
  ])
})
it('round-trips private image references and escaped captions without persisting URLs or HTML', () => {
  const block = {
    type: 'image',
    mediaId: '6ad218e46c26c31ff0ed423c',
    alt: 'Rừng Việt Nam',
    caption: '<script>nội dung chú thích</script>',
  }
  const root = document.createElement('div')
  writeChapterDom(root, { title: 'Ảnh', blocks: [block] })
  expect(root.querySelector('script')).toBeNull()
  expect(root.querySelector('img').crossOrigin).toBe('use-credentials')
  expect(readChapterDom(root)).toEqual([block])
  expect(richChapterBody({ blocks: [block] })).toBe('')
})
it('preserves image references when the browser nests a figure inside a formatted text block', () => {
  const block = {
    type: 'image',
    mediaId: '6ad218e46c26c31ff0ed423c',
    alt: 'Ảnh riêng',
    caption: 'Chú thích',
  }
  const root = document.createElement('div')
  writeChapterDom(root, { blocks: [block] })
  const figure = root.firstChild
  const heading = document.createElement('h2')
  const bold = document.createElement('b')
  bold.append(figure)
  heading.append(document.createTextNode('Tiêu đề'), bold)
  root.replaceChildren(heading)
  expect(readChapterDom(root)).toEqual([
    { type: 'heading', level: 2, inlines: [{ text: 'Tiêu đề', marks: [] }] },
    block,
  ])
})
