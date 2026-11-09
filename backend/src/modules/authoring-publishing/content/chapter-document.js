import { z } from 'zod'
import { HttpError } from '../../../middleware/errors.js'

export const chapterParagraphText = z
  .string()
  .max(20000)
  .refine(text => text.isWellFormed())

// The current textarea editor round-trips only plain paragraphs. Never flatten
// richer/unknown documents into a partial string and accept it as a full save.
export const textChapterDocument = z
  .object({
    title: z.string().trim().min(1).max(200),
    blocks: z
      .array(z.object({ type: z.literal('paragraph'), text: chapterParagraphText }).strict())
      .min(1)
      .max(1000),
  })
  .strict()

export function supportsTextEditor(revision) {
  return (
    revision?.formatVersion === 'blocks-v1' &&
    textChapterDocument.safeParse(revision.content).success
  )
}

export function assertTextEditorRevision(revision) {
  if (!supportsTextEditor(revision))
    throw new HttpError(
      409,
      'unsupported_editor_format',
      'Bản nội dung có định dạng mà trình soạn hiện tại chưa hỗ trợ. Nội dung gốc được giữ nguyên, không thể lưu đè bằng đoạn văn thuần.',
    )
}
