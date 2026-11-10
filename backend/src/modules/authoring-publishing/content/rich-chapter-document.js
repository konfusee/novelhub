import { z } from 'zod'
import { HttpError } from '../../../middleware/errors.js'
import { chapterParagraphText, supportsTextEditor } from './chapter-document.js'

const span = z
  .object({
    text: chapterParagraphText.min(1),
    marks: z
      .array(z.enum(['bold', 'italic', 'underline']))
      .max(3)
      .refine(marks => new Set(marks).size === marks.length)
      .transform(marks => [...marks].sort()),
  })
  .strict()
const inlines = z
  .array(span)
  .max(1000)
  .refine(items => items.reduce((length, item) => length + item.text.length, 0) <= 20000)
const textBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), inlines }).strict(),
  z
    .object({ type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3)]), inlines })
    .strict(),
  z.object({ type: z.literal('quote'), inlines }).strict(),
  z.object({ type: z.literal('scene-break') }).strict(),
])

// Explicit text AST: no raw HTML, arbitrary attributes, URLs, or media references.
// Media must acquire an ownership/rights contract before being supported here.
export const richChapterDocument = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(text => text.isWellFormed()),
    blocks: z.array(textBlock).min(1).max(1000),
  })
  .strict()

const imageBlock = z
  .object({
    type: z.literal('image'),
    mediaId: z
      .string()
      .regex(/^[a-f\d]{24}$/iu)
      .transform(value => value.toLowerCase()),
    alt: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(value => value.isWellFormed()),
    caption: z
      .string()
      .max(1000)
      .refine(value => value.isWellFormed())
      .default(''),
  })
  .strict()
export const editableChapterDocument = richChapterDocument.extend({
  blocks: z
    .array(z.union([textBlock, imageBlock]))
    .min(1)
    .max(1000)
    .refine(blocks => blocks.filter(block => block.type === 'image').length <= 20),
})
export const chapterMediaIds = document => [
  ...new Set(
    (document?.blocks ?? []).filter(block => block.type === 'image').map(block => block.mediaId),
  ),
]
export const chapterDocumentFormat = document =>
  chapterMediaIds(document).length ? 'blocks-v3' : 'blocks-v2'

export function readRichChapter(revision) {
  if (revision?.mediaIds?.length && revision?.formatVersion !== 'blocks-v3') {
    throw new HttpError(
      409,
      'unsupported_editor_format',
      'Nội dung có hình ảnh chưa được hỗ trợ bởi trình soạn văn bản.',
    )
  }
  if (supportsTextEditor(revision)) {
    return {
      title: revision.content.title,
      blocks: revision.content.blocks.map(({ text }) => ({
        type: 'paragraph',
        inlines: text ? [{ text, marks: [] }] : [],
      })),
    }
  }
  const parsed = ['blocks-v2', 'blocks-v3'].includes(revision?.formatVersion)
    ? (revision.formatVersion === 'blocks-v3'
        ? editableChapterDocument
        : richChapterDocument
      ).safeParse(revision.content)
    : null
  if (!parsed?.success) {
    throw new HttpError(
      409,
      'unsupported_editor_format',
      'Định dạng nội dung chưa được hỗ trợ. Bản gốc được giữ nguyên.',
    )
  }
  if (
    revision.formatVersion === 'blocks-v3' &&
    JSON.stringify(chapterMediaIds(parsed.data).sort()) !==
      JSON.stringify([...new Set((revision.mediaIds ?? []).map(String))].sort())
  )
    throw new HttpError(
      409,
      'unsupported_editor_format',
      'Tham chiếu ảnh không khớp phiên bản chương. Bản gốc được giữ nguyên.',
    )
  return parsed.data
}

export function chapterTextProjection(revision) {
  if (['blocks-v2', 'blocks-v3'].includes(revision?.formatVersion)) {
    const parsed = (
      revision.formatVersion === 'blocks-v3' ? editableChapterDocument : richChapterDocument
    ).safeParse(revision.content)
    if (!parsed.success) return []
    return parsed.data.blocks
      .filter(block => block.type !== 'scene-break' && block.type !== 'image')
      .map(block => block.inlines.map(item => item.text).join(''))
  }
  return (revision?.content?.blocks ?? [])
    .filter(block => block.type === 'paragraph' && typeof block.text === 'string')
    .map(block => block.text)
}
