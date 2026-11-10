import { chapterTextProjection } from '../../authoring-publishing/content/rich-chapter-document.js'
import { estimateTokens } from './pricing.js'

export const CHUNKING_VERSION = 'v1'
export const PASSAGE_MAX_CHARS = 2000
export const MAX_EMBEDDING_INPUTS = 2048
export const MAX_EMBEDDING_REQUEST_TOKENS = 200000
// A long paragraph is cut at the last space within this many characters of the window end.
const WORD_BOUNDARY_CHARS = 200

// Cuts one normalized paragraph into pieces of at most PASSAGE_MAX_CHARS. The space at a
// word-boundary cut belongs to no piece; without a nearby space the cut is hard.
function paragraphPieces(paragraph, offset) {
  const pieces = []
  let start = 0
  while (paragraph.length - start > PASSAGE_MAX_CHARS) {
    const windowEnd = start + PASSAGE_MAX_CHARS
    const space = paragraph.lastIndexOf(' ', windowEnd)
    if (space > start && space >= windowEnd - WORD_BOUNDARY_CHARS) {
      pieces.push({ start: offset + start, end: offset + space })
      start = space + 1
    } else {
      pieces.push({ start: offset + start, end: offset + windowEnd })
      start = windowEnd
    }
  }
  pieces.push({ start: offset + start, end: offset + paragraph.length })
  return pieces
}

/**
 * Chunking v1: normalizes whitespace, splits paragraphs longer than PASSAGE_MAX_CHARS at
 * word boundaries and packs consecutive pieces greedily into passages of at most
 * PASSAGE_MAX_CHARS characters of the newline-joined text. Pure and deterministic.
 */
export function chunkParagraphs(paragraphs) {
  const normalized = paragraphs
    .map(p =>
      String(p ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
  const fullText = normalized.join('\n')
  const pieces = []
  let offset = 0
  for (const paragraph of normalized) {
    pieces.push(...paragraphPieces(paragraph, offset))
    offset += paragraph.length + 1
  }
  const spans = []
  for (const piece of pieces) {
    const current = spans.at(-1)
    if (current && piece.end - current.start <= PASSAGE_MAX_CHARS) current.end = piece.end
    else spans.push({ start: piece.start, end: piece.end })
  }
  return spans.map(({ start, end }, index) => ({
    passageId: 'p' + String(index).padStart(4, '0'),
    order: index,
    start,
    end,
    text: fullText.slice(start, end),
  }))
}

/** Passages of a story-metadata revision (title and synopsis) or of a chapter revision. */
export function revisionPassages(revision) {
  if (revision.contentType === 'story') {
    return chunkParagraphs([
      revision.content?.title,
      ...String(revision.content?.description ?? '').split(/\n+/),
    ])
  }
  return chunkParagraphs(chapterTextProjection(revision))
}

/**
 * Splits texts, in order, into embedding requests of at most `maxInputs` inputs and at most
 * `maxTokens` estimated tokens each. Returns `[{ start, texts }]` with `start` the index of
 * the group's first text in `texts`.
 */
export function embeddingRequestBatches(
  texts,
  { maxInputs = MAX_EMBEDDING_INPUTS, maxTokens = MAX_EMBEDDING_REQUEST_TOKENS } = {},
) {
  const groups = []
  let current = null
  let tokens = 0
  texts.forEach((text, index) => {
    const textTokens = estimateTokens(text.length)
    if (
      current &&
      (current.texts.length >= maxInputs ||
        (current.texts.length && tokens + textTokens > maxTokens))
    ) {
      current = null
    }
    if (!current) {
      current = { start: index, texts: [] }
      groups.push(current)
      tokens = 0
    }
    current.texts.push(text)
    tokens += textTokens
  })
  return groups
}
