import { expect, it } from 'vitest'
import { suggestDocumentChapters } from '../../../src/pages/author/documentChapters'

it.each([
  'Chương 1: Bắt đầu\nNội dung đầu.\n\nChương 2: Tiếp nối\nNội dung sau.\n',
  'Lời tựa\nNội dung trước chương một.\n\nChapter IX — First\nActual prose.\n\nChapter X — Next\nMore prose.',
  '\n\nCHƯƠNG 01\r\nTiếng Việt có dấu.\r\n\r\nCHƯƠNG 02\r\nĐoạn sau.\r\n',
])('suggests consecutive headings without dropping or duplicating characters', text => {
  const chapters = suggestDocumentChapters(text, 'Phần mở đầu')
  expect(chapters.length).toBeGreaterThanOrEqual(2)
  expect(chapters.map(chapter => chapter.text).join('')).toBe(text)
  expect(chapters.at(-1).title).toMatch(/Chương 2|Chapter X|CHƯƠNG 02/)
})
it.each([
  'Một câu nhắc đến Chương 1 trong đoạn văn.\nChương 2\nNội dung.',
  'Chương 1\n\nChương 2\nNội dung.',
  'Chương 1 .... 3\nChương 2 .... 10\n',
  'Chương 1\n3\nChương 2\n10\n',
  'Chương 1.2\nNội dung.\nChương 2.3\nNội dung.',
  'Chương 2\nNội dung.\nChương 1\nNội dung.',
  'Chương 1\nNội dung.\nChương 1\nNội dung.',
  'Chapter IIII\nProse.\nChapter V\nProse.',
  '> Chương 1\nTrích dẫn.\n> Chương 2\nTrích dẫn.',
  'Chương 1\nNội dung.\nChapter 2\nNội dung.',
])('leaves ambiguous documents intact', text => {
  expect(suggestDocumentChapters(text, 'Phần mở đầu')).toBeNull()
})
it('does not suggest more chapters than the import API accepts', () => {
  const text = Array.from({ length: 101 }, (_, index) => `Chương ${index + 1}\nNội dung.\n`).join(
    '',
  )
  expect(suggestDocumentChapters(text, 'Phần mở đầu')).toBeNull()
})
