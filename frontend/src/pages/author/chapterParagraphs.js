export class ChapterTextError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const graphemes = new Intl.Segmenter('vi', { granularity: 'grapheme' });

// Match blocks-v1 limits while keeping combining accents and emoji together.
export function chapterParagraphs(text) {
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) {
    throw new ChapterTextError('invalidUnicode');
  }
  const paragraphs = [];
  for (const paragraph of text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/u)
    .filter((part) => part.trim())) {
    const segments = paragraph.length > 20000 ? graphemes.segment(paragraph) : null;
    let offset = 0;
    while (offset < paragraph.length) {
      let end = Math.min(offset + 20000, paragraph.length);
      if (end < paragraph.length) end = segments.containing(end).index;
      if (end === offset) throw new ChapterTextError('longGrapheme');
      paragraphs.push(paragraph.slice(offset, end));
      if (paragraphs.length > 1000) throw new ChapterTextError('tooManyParagraphs');
      offset = end;
    }
  }
  return paragraphs;
}
