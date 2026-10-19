import { expect, it } from 'vitest'
import { suggestDocumentChapters } from '../../../src/pages/author/documentChapters'

const suggest = text => suggestDocumentChapters(text, 'Phần mở đầu', { format: 'md' })
it('rejects numbered titles from extracted code and quotes while preserving real numbered manuscripts', () => {
  const text = 'Chương 1\nNội dung đầu.\nChương 2\nNội dung sau.'
  for (const numberedHeadings of [[], ['Chương 1'], ['Chương 2']]) {
    expect(
      suggestDocumentChapters(text, 'Phần mở đầu', {
        format: 'md',
        headings: [],
        numberedHeadings,
      }),
    ).toBeNull()
  }
  const result = suggestDocumentChapters(text, 'Phần mở đầu', {
    format: 'md',
    headings: [],
    numberedHeadings: ['Chương 1', 'Chương 2'],
  })
  expect(result.map(chapter => chapter.title)).toEqual(['Chương 1', 'Chương 2'])
  expect(result.map(chapter => chapter.text).join('')).toBe(text)
})
it.each([
  [
    { level: 2, title: 'Chương 1' },
    { level: 2, title: 'Tên đã đổi' },
  ],
  [
    { level: 2, title: 'Chương 1' },
    { level: 2, title: 'Chương 1' },
  ],
  [
    { level: 0, title: 'Chương 1' },
    { level: 2, title: 'Chương 2' },
  ],
])('does not fall back to numbered lines when an extracted outline is ambiguous', (...headings) => {
  const text = 'Chương 1\nNội dung đầu.\nChương 2\nNội dung sau.'
  expect(suggestDocumentChapters(text, 'Phần mở đầu', { format: 'md', headings })).toBeNull()
  expect(suggestDocumentChapters(text, 'Phần mở đầu', { format: 'txt' })).toHaveLength(2)
})
it('uses root heading metadata against current plain text edits without treating code titles as chapters', () => {
  const text = 'Sách\n\nLời tựa.\n\nMột\n\nVăn bản đã sửa.\n## Mã giả\n\nHai\n\nKết thúc.'
  const headings = [
    { level: 1, title: 'Sách' },
    { level: 2, title: 'Một' },
    { level: 2, title: 'Hai' },
  ]
  const result = suggestDocumentChapters(text, 'Phần mở đầu', { format: 'md', headings })
  expect(result.map(chapter => chapter.title)).toEqual(['Phần mở đầu', 'Một', 'Hai'])
  expect(result.map(chapter => chapter.text).join('')).toBe(text)
  expect(
    suggestDocumentChapters(text.replace('Một', 'Đã đổi tên'), 'Phần mở đầu', {
      format: 'md',
      headings,
    }),
  ).toBeNull()
})
it.each([
  '# Mở đầu\nVăn bản đầu.\n\n# Hành trình ###\nVăn bản sau.\n',
  '# Tên sách\nLời tựa.\n\n## Mở đầu\r\nNội dung đầu.\r\n### Cảnh nhỏ\r\nChi tiết.\r\n## Kết thúc\r\nNội dung sau.',
  '---\ntitle: Bản thảo\n# Chú thích YAML\n---\n## Chương đầu\nNội dung.\n## Chương sau\nKết thúc.',
])('uses the shallowest repeated Markdown level without losing characters', text => {
  const result = suggest(text)
  expect(result).not.toBeNull()
  expect(result.map(chapter => chapter.text).join('')).toBe(text)
  expect(result.at(-1).title).not.toContain('#')
})
it('ignores fenced headings and comments but preserves them in the chapter text', () => {
  const text =
    '# Một\nNội dung.\n```md\n# Không phải chương\nNội dung ví dụ.\n```\n<!--\n# Tiêu đề ẩn\n-->\n# Hai\nKết thúc.'
  const result = suggest(text)
  expect(result.map(chapter => chapter.title)).toEqual(['Một', 'Hai'])
  expect(result.map(chapter => chapter.text).join('')).toBe(text)
})
it.each([
  '# Một\n# Hai\nNội dung.',
  '# Chỉ một tiêu đề\nNội dung.',
  '    # Mã một\nNội dung.\n    # Mã hai\nNội dung.',
  '> # Trích một\nNội dung.\n> # Trích hai\nNội dung.',
  '~~~md\n# Mã một\nNội dung.\n# Mã hai\nNội dung.\n~~~',
  '# Một\nNội dung.\n~~~\n# Hai\nChưa đóng mã.',
  '## Một\nNội dung.\n# Phần khác\n## Hai\nKết thúc.',
  '# Mục lục .... 1\nNội dung.\n# Mục lục .... 4\nNội dung.',
])('keeps ambiguous Markdown intact', text => expect(suggest(text)).toBeNull())
it('does not reinterpret plain-text files or exceed the import limit with a preamble', () => {
  const text = '# Một\nNội dung.\n# Hai\nNội dung.'
  expect(suggestDocumentChapters(text, 'Phần mở đầu', { format: 'txt' })).toBeNull()
  const large = Array.from({ length: 100 }, (_, i) => `# Tựa ${i}\nNội dung.\n`).join('')
  expect(suggest('Lời tựa.\n' + large)).toBeNull()
})
