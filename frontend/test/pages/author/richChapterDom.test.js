import { expect, it } from 'vitest';
import {
  readChapterDom,
  writeChapterDom,
  richChapterBody,
} from '../../../src/pages/author/richChapterDom';
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
  };
  const root = window.document.createElement('div');
  writeChapterDom(root, document);
  expect(root.querySelector('script')).toBeNull();
  expect(readChapterDom(root)).toEqual(document.blocks);
  expect(richChapterBody(document)).toContain('Tiếng Việt 🌸');
});
it('accepts browser paragraph/blockquote structures and does not leak styled marks to sibling text', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<div><span style="font-weight:bold">Đậm</span> thường</div><blockquote><p>Trích dẫn</p></blockquote><p><br></p>';
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
  ]);
});
it('never persists raw HTML nodes, image references, script bodies or style declarations', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<p>Văn bản<img src="x" onerror="alert(1)"><script>bad()</script><style>p{color:red}</style><a href="javascript:bad()">liên kết</a></p>';
  expect(readChapterDom(root)).toEqual([
    { type: 'paragraph', inlines: [{ text: 'Văn bảnliên kết', marks: [] }] },
  ]);
});
