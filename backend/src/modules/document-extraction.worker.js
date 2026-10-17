import { parentPort, workerData } from 'node:worker_threads';
import WordExtractor from 'word-extractor';
import { getDocumentProxy } from 'unpdf';
import { marked } from 'marked';

const bytes = new Uint8Array(workerData.bytes);
const limit = 200000;
function check(text) {
  if (!text.trim()) throw new Error('empty_document');
  if (text.length > limit) throw new Error('document_too_long');
  return text.replace(/\r\n?/g, '\n');
}
function markdown(tokens, depth = 0) {
  if (depth > 64) throw new Error('unsupported_markdown');
  return tokens
    .map((token) => {
      if (['html', 'image'].includes(token.type)) throw new Error('unsupported_markdown');
      if (token.type === 'code') return token.text + '\n\n';
      if (token.type === 'list')
        return token.items.map((item) => markdown(item.tokens, depth + 1)).join('\n') + '\n\n';
      if (token.type === 'table')
        return (
          [token.header, ...token.rows]
            .map((row) => row.map((cell) => markdown(cell.tokens, depth + 1)).join('\t'))
            .join('\n') + '\n\n'
        );
      if (['space', 'br', 'hr'].includes(token.type)) return '\n';
      if (token.type === 'def') return '';
      if (token.tokens)
        return (
          markdown(token.tokens, depth + 1) +
          (['paragraph', 'heading', 'blockquote'].includes(token.type) ? '\n\n' : '')
        );
      if (typeof token.text === 'string') return token.text;
      throw new Error('unsupported_markdown');
    })
    .join('');
}
async function extract() {
  const { format } = workerData;
  if (format === 'pdf') {
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-')
      throw new Error('invalid_document');
    const pdf = await getDocumentProxy(Uint8Array.from(bytes), {
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      maxImageSize: 0,
      verbosity: 0,
    });
    try {
      if (pdf.numPages > 100) throw new Error('document_too_long');
      const pages = [];
      let length = 0;
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' '))
          .join('')
          .trim();
        if (!text) throw new Error('pdf_no_text');
        length += text.length;
        if (length > limit) throw new Error('document_too_long');
        pages.push(text);
        page.cleanup();
      }
      return { text: check(pages.join('\n\n')), pageCount: pdf.numPages };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
  if (format === 'doc' || format === 'docx') {
    const signature = Buffer.from(bytes.subarray(0, 8)).toString('hex');
    if (format === 'doc' ? signature !== 'd0cf11e0a1b11ae1' : !signature.startsWith('504b0304'))
      throw new Error('invalid_document');
    const document = await new WordExtractor().extract(Buffer.from(bytes.buffer));
    return {
      text: check(
        [
          document.getBody(),
          document.getFootnotes(),
          document.getEndnotes(),
          document.getTextboxes({ includeHeadersAndFooters: false }),
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
    };
  }
  let encoding = 'utf-8';
  if (bytes[0] === 255 && bytes[1] === 254) encoding = 'utf-16le';
  if (bytes[0] === 254 && bytes[1] === 255) encoding = 'utf-16be';
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error('invalid_encoding');
  }
  if (text.includes('\0')) throw new Error('invalid_document');
  text = check(text);
  if (format !== 'md') return { text };
  const plain = check(markdown(marked.lexer(text)));
  // Suggestions only: preserve the existing plain-text output and expose root headings separately.
  const outlineSource = text.replace(
    /^\uFEFF?---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(?:\n|$)/,
    '',
  );
  const rootHeadings = marked.lexer(outlineSource).filter((token) => token.type === 'heading');
  const headings =
    rootHeadings.length <= 1000
      ? rootHeadings.map((token) => ({
          level: token.depth,
          title: markdown(token.tokens).trim(),
        }))
      : [];
  return { text: plain, headings };
}
try {
  const result = await extract();
  bytes.fill(0);
  parentPort.postMessage({ result });
} catch (error) {
  bytes.fill(0);
  const codes = [
    'invalid_document',
    'invalid_encoding',
    'empty_document',
    'document_too_long',
    'pdf_no_text',
    'unsupported_markdown',
  ];
  parentPort.postMessage({
    error: codes.includes(error.message) ? error.message : 'invalid_document',
  });
}
