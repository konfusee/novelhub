import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import { chapterParagraphText, supportsTextEditor } from './chapter-document.js';

const span = z
  .object({
    text: chapterParagraphText.min(1),
    marks: z
      .array(z.enum(['bold', 'italic', 'underline']))
      .max(3)
      .refine((marks) => new Set(marks).size === marks.length)
      .transform((marks) => [...marks].sort()),
  })
  .strict();
const inlines = z
  .array(span)
  .max(1000)
  .refine((items) => items.reduce((length, item) => length + item.text.length, 0) <= 20000);
const textBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), inlines }).strict(),
  z
    .object({ type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3)]), inlines })
    .strict(),
  z.object({ type: z.literal('quote'), inlines }).strict(),
  z.object({ type: z.literal('scene-break') }).strict(),
]);

// Explicit text AST: no raw HTML, arbitrary attributes, URLs, or media references.
// Media must acquire an ownership/rights contract before being supported here.
export const richChapterDocument = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((text) => text.isWellFormed()),
    blocks: z.array(textBlock).min(1).max(1000),
  })
  .strict();

export function readRichChapter(revision) {
  if (revision?.mediaIds?.length) {
    throw new HttpError(
      409,
      'unsupported_editor_format',
      'Nội dung có hình ảnh chưa được hỗ trợ bởi trình soạn văn bản.',
    );
  }
  if (supportsTextEditor(revision)) {
    return {
      title: revision.content.title,
      blocks: revision.content.blocks.map(({ text }) => ({
        type: 'paragraph',
        inlines: text ? [{ text, marks: [] }] : [],
      })),
    };
  }
  const parsed =
    revision?.formatVersion === 'blocks-v2'
      ? richChapterDocument.safeParse(revision.content)
      : null;
  if (!parsed?.success) {
    throw new HttpError(
      409,
      'unsupported_editor_format',
      'Định dạng nội dung chưa được hỗ trợ. Bản gốc được giữ nguyên.',
    );
  }
  return parsed.data;
}

export function chapterTextProjection(revision) {
  if (revision?.formatVersion === 'blocks-v2') {
    const parsed = richChapterDocument.safeParse(revision.content);
    if (!parsed.success) return [];
    return parsed.data.blocks
      .filter((block) => block.type !== 'scene-break')
      .map((block) => block.inlines.map((item) => item.text).join(''));
  }
  return (revision?.content?.blocks ?? [])
    .filter((block) => block.type === 'paragraph' && typeof block.text === 'string')
    .map((block) => block.text);
}
