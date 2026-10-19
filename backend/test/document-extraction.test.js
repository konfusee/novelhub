import { describe, expect, it } from 'vitest';
import { extractDocument } from '../src/modules/document-extraction.js';
import { pdfDocument, docxDocument } from './fixtures/documents.js';

describe('real document extraction', () => {
  it('identifies numbered titles only in root Markdown paragraphs', async () => {
    const result = await extractDocument(
      Buffer.from(
        'Chương 1: Mở đầu\nNội dung.\n\n```text\nChương 2: Trong mã\nVí dụ.\n```\n\n> Chương 3: Trích dẫn\n\n- Chương 4: Danh sách\n\n| Chapter 5 |\n| --- |\n| Ví dụ |\n\nChương 6: Kết thúc\nNội dung sau.',
      ),
      'md',
    );
    expect(result.headings).toEqual([]);
    expect(result.numberedHeadings).toEqual(['Chương 1: Mở đầu', 'Chương 6: Kết thúc']);
    expect(result.text).toContain('Chương 2: Trong mã');
    expect(result.text).toContain('Chương 3: Trích dẫn');
  });
  it.each([
    ['```text\nĐoạn mã cuối\n```', 'Đoạn mã cuối'],
    ['    Đoạn mã thụt lề', 'Đoạn mã thụt lề'],
    ['- Mục đầu\n- Mục cuối', 'Mục cuối'],
    ['| Cột |\n| --- |\n| Ô cuối |', 'Ô cuối'],
  ])('keeps the chapter after a Markdown block on its own line: %s', async (block, lastText) => {
    const source = `## Mở đầu\nNội dung đầu.\n\n${block}\n## Kết thúc\nNội dung sau.`;
    const result = await extractDocument(Buffer.from(source), 'md');
    expect(result.headings).toEqual([
      { level: 2, title: 'Mở đầu' },
      { level: 2, title: 'Kết thúc' },
    ]);
    expect(result.text).toContain(lastText);
    expect(result.text.slice(result.text.indexOf(lastText) + lastText.length)).toMatch(
      /^\n{2,}Kết thúc\n\nNội dung sau\./,
    );
    expect(result.text.split('\n').filter((line) => line === 'Kết thúc')).toHaveLength(1);
  });
  it('returns Markdown root heading metadata while keeping existing plain text and ignoring code/quotes', async () => {
    const source =
      '# Sách\nLời tựa.\n## Một\n**Văn bản** đầu.\n~~~md\n## Mã giả\n~~~\n> ## Trích dẫn\n### Cảnh nhỏ\nChi tiết.\n## Hai\nKết thúc.';
    const result = await extractDocument(Buffer.from(source), 'md');
    expect(result.headings).toEqual([
      { level: 1, title: 'Sách' },
      { level: 2, title: 'Một' },
      { level: 3, title: 'Cảnh nhỏ' },
      { level: 2, title: 'Hai' },
    ]);
    expect(result.text).toContain('Văn bản đầu.');
    expect(result.text).toContain('## Mã giả');
    expect(result.text).not.toContain('**');
  });
  it('does not treat YAML frontmatter comments as Markdown chapter headings', async () => {
    const result = await extractDocument(
      Buffer.from(
        '---\ntitle: Sách\n# Chú thích\n---\n## Một\nNội dung đầu.\n## Hai\nNội dung sau.',
      ),
      'md',
    );
    expect(result.headings).toEqual([
      { level: 2, title: 'Một' },
      { level: 2, title: 'Hai' },
    ]);
  });
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
  it('clears an already cancelled input without consuming a parser slot', async () => {
    const controller = new AbortController();
    controller.abort();
    const buffer = Buffer.from('Bản thảo đã hủy.');
    await expect(
      extractDocument(buffer, 'txt', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'import_cancelled' });
    expect(buffer.every((byte) => byte === 0)).toBe(true);
    expect((await extractDocument(Buffer.from('Lần nhập mới.'), 'txt')).text).toBe('Lần nhập mới.');
  });
  it('clears rejected busy input and releases both slots after cancellation', async () => {
    const controllers = [new AbortController(), new AbortController()];
    const buffers = [Buffer.from('Bản thảo thứ nhất.'), Buffer.from('Bản thảo thứ hai.')];
    const pending = Promise.allSettled(
      buffers.map((buffer, index) =>
        extractDocument(buffer, 'txt', { signal: controllers[index].signal }),
      ),
    );
    try {
      const busy = Buffer.from('Bản thảo đang chờ.');
      await expect(extractDocument(busy, 'txt')).rejects.toMatchObject({ code: 'import_busy' });
      expect(busy.every((byte) => byte === 0)).toBe(true);
    } finally {
      controllers.forEach((controller) => controller.abort());
      await pending;
    }
    expect(buffers.every((buffer) => buffer.every((byte) => byte === 0))).toBe(true);
    const next = await Promise.all([
      extractDocument(Buffer.from('Lần nhập mới một.'), 'txt'),
      extractDocument(Buffer.from('Lần nhập mới hai.'), 'txt'),
    ]);
    expect(next.map((result) => result.text)).toEqual(['Lần nhập mới một.', 'Lần nhập mới hai.']);
  });
});
