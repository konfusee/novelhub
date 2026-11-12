import { z } from 'zod'
import { ContentRevision } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'

export const MAX_STORY_TAGS = 10
const TAG = /^[\p{L}\p{N}_-]{2,30}$/u

/** Author spelling of a tag: trimmed, without a leading `#` or any whitespace, NFC. */
export const tagSpelling = value =>
  value.trim().replace(/^#/, '').replace(/\s+/gu, '').normalize('NFC')

/** Case-insensitive identity of a tag, used for uniqueness, search and counts. */
export const tagKey = tag => tag.normalize('NFC').toLowerCase()

/** Story fields for `tags`; `tagKeys` is derived and never accepted from clients. */
export const storyTagFields = tags => ({ tags, tagKeys: tags.map(tagKey) })

/** Tags as stored in a story revision: valid spellings, unique by key, at most ten. */
export const storedTags = z
  .array(z.string().regex(TAG))
  .max(MAX_STORY_TAGS)
  .refine(tags => new Set(tags.map(tagKey)).size === tags.length)

const invalidTags = () =>
  new HttpError(
    400,
    'invalid_tags',
    'Thẻ dài 2–30 ký tự, chỉ gồm chữ, số, gạch nối hoặc gạch dưới; tối đa 10 thẻ, không trùng nhau.',
  )

/**
 * Normalizes Author input into stored tags: each item becomes its spelling, repeats of a key
 * keep the first spelling. Throws `invalid_tags` for a non-array, an invalid tag or more than
 * ten distinct tags.
 */
export function parseStoryTags(value) {
  if (!Array.isArray(value)) throw invalidTags()
  const tags = []
  const keys = new Set()
  for (const item of value) {
    if (typeof item !== 'string') throw invalidTags()
    const tag = tagSpelling(item)
    if (!TAG.test(tag)) throw invalidTags()
    const key = tagKey(tag)
    if (keys.has(key)) continue
    keys.add(key)
    tags.push(tag)
  }
  if (tags.length > MAX_STORY_TAGS) throw invalidTags()
  return tags
}

/** Search key for free text: the tag key of its spelling, or null when it cannot be a tag. */
export function searchTagKey(value) {
  const tag = tagSpelling(value ?? '')
  return TAG.test(tag) ? tagKey(tag) : null
}

/**
 * Tags the Author is editing: those of the story's draft or current metadata revision. A
 * revision written before tags existed has none.
 */
export async function metadataTags(story, session) {
  const revisionId = story.draftRevisionId ?? story.currentRevisionId
  const revision = revisionId
    ? await ContentRevision.findById(revisionId)
        .select('content.tags')
        .session(session ?? null)
        .lean()
    : null
  return revision?.content?.tags ?? []
}
