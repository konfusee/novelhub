import { expect, it } from 'vitest';
import { chapterParagraphs } from './chapterParagraphs';

it.each([19998, 19999, 20000, 39999])('preserves emoji at UTF-16 boundary %i', (offset) => {
  const text = 'a'.repeat(offset) + '🌸' + 'Cuối đoạn';
  const paragraphs = chapterParagraphs(text);
  expect(paragraphs.join('')).toBe(text);
  expect(
    paragraphs.every((paragraph) => paragraph.length <= 20000 && paragraph.isWellFormed()),
  ).toBe(true);
});
it('preserves meaningful spaces at chunk boundaries and allows editing past 20,000 characters', () => {
  const text = 'a'.repeat(19999) + ' hai từ ' + 'b'.repeat(20000);
  expect(chapterParagraphs(text).join('')).toBe(text);
  expect(chapterParagraphs('a'.repeat(20001)).map((paragraph) => paragraph.length)).toEqual([
    20000, 1,
  ]);
});
it('keeps the existing blank-line and empty-draft behavior', () => {
  expect(chapterParagraphs(' Đoạn một.\r\n\r\nĐoạn hai. ')).toEqual([' Đoạn một.', 'Đoạn hai. ']);
  expect(chapterParagraphs(' \n\n ')).toEqual([]);
});
it('keeps boundary spaces after reopening and saving the generated paragraphs again', () => {
  const text = 'a'.repeat(19999) + '  🌸 Kết thúc.';
  const reopened = chapterParagraphs(text).join('\n\n');
  expect(chapterParagraphs(reopened).join('')).toBe(text);
});
it.each(['a\u0301', '👨‍👩‍👧‍👦', '🇻🇳', '👍🏽', '❤️'])(
  'keeps a complete grapheme %s at the boundary',
  (cluster) => {
    const text = 'b'.repeat(19999) + cluster + 'Kết thúc';
    const paragraphs = chapterParagraphs(text);
    expect(paragraphs.join('')).toBe(text);
    expect(paragraphs.some((paragraph) => paragraph.includes(cluster))).toBe(true);
    expect(paragraphs.every((paragraph) => paragraph.length <= 20000)).toBe(true);
  },
);
it('rejects a single cluster exceeding the paragraph limit without looping or truncating', () => {
  expect(() => chapterParagraphs('a' + '\u0301'.repeat(20000))).toThrow('longGrapheme');
});
it('rejects too many paragraphs without silently truncating the draft', () => {
  expect(() => chapterParagraphs(Array(1001).fill('Nội dung').join('\n\n'))).toThrow(
    'tooManyParagraphs',
  );
});
it.each(['Text\ud83c', '\udf38text'])(
  'rejects malformed Unicode instead of saving replacement characters',
  (text) => {
    expect(() => chapterParagraphs(text)).toThrow('invalidUnicode');
  },
);
