import { describe, expect, it } from 'vitest';
import { extractDocument } from '../src/modules/document-extraction.js';
import { pdfDocument, docxDocument } from './fixtures/documents.js';

describe('real document extraction', () => {
  it.each([
    ['txt', Buffer.from('Chương một\r\nNội dung tiếng Việt.'), 'Chương một\nNội dung tiếng Việt.'],
    [
      'txt',
      Buffer.concat([Buffer.from([255, 254]), Buffer.from('Văn bản UTF-16.', 'utf16le')]),
      'Văn bản UTF-16.',
    ],
    [
      'md',
      Buffer.from('# Chương một\n\n**Nội dung** và [liên kết](https://example.com).'),
      'Nội dung và liên kết.',
    ],
    ['pdf', pdfDocument(), 'A real chapter from a PDF.'],
    ['docx', docxDocument(), 'Chương Word thực tế.'],
  ])('extracts %s bytes without a mock parser', async (format, input, expected) => {
    const buffer = Buffer.from(input);
    const result = await extractDocument(buffer, format);
    expect(result.text).toContain(expected);
    expect(buffer.every((byte) => byte === 0)).toBe(true);
  });
  it.each([
    ['pdf', pdfDocument(''), 'pdf_no_text'],
    ['pdf', Buffer.from('not pdf'), 'invalid_document'],
    ['doc', Buffer.from('not doc'), 'invalid_document'],
    ['docx', Buffer.from('not zip'), 'invalid_document'],
    ['txt', Buffer.from([0xff, 0xff]), 'invalid_encoding'],
    ['txt', Buffer.from('  '), 'empty_document'],
    ['txt', Buffer.from('a'.repeat(200001)), 'document_too_long'],
    ['md', Buffer.from('<script>alert(1)</script>'), 'unsupported_markdown'],
    ['md', Buffer.from('![image](https://example.com/a.png)'), 'unsupported_markdown'],
  ])('rejects unsupported %s input explicitly', async (format, buffer, code) => {
    await expect(extractDocument(buffer, format)).rejects.toMatchObject({ code });
    expect(buffer.every((byte) => byte === 0)).toBe(true);
  });
  it('terminates a timed out parser and permits a subsequent request', async () => {
    await expect(extractDocument(Buffer.from('Text'), 'txt', { timeout: 1 })).rejects.toMatchObject(
      { code: 'import_timeout' },
    );
    expect((await extractDocument(Buffer.from('New text'), 'txt')).text).toBe('New text');
  });
  it('cancels an active parser', async () => {
    const controller = new AbortController();
    const buffer = Buffer.from('Text');
    const pending = extractDocument(buffer, 'txt', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'import_cancelled' });
    expect(buffer.every((byte) => byte === 0)).toBe(true);
  });
});
