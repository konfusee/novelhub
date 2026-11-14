/*
 * Reading progress is saved as a paragraph: the index of a chapter block (`chapter.blocks`).
 * The index does not change with font size or screen width, unlike a scroll position.
 * The narration reads the blocks in order, so the share of the audio played is about the
 * share of the characters read: that converts a paragraph to a playback second and back.
 */

/* Plain text of a block: legacy `blocks-v1` paragraphs carry `text`, rich blocks carry `inlines`. */
export const blockText = block =>
  typeof block.text === 'string'
    ? block.text
    : (block.inlines ?? []).map(span => span.text).join('')

/* Characters of each block; images and scene breaks count 0 (they are not read aloud). */
const blockSizes = blocks => blocks.map(block => blockText(block).length)

/* The paragraph being heard `seconds` into a track of `duration` seconds. */
export function paragraphAtTime(blocks, seconds, duration) {
  const sizes = blockSizes(blocks)
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (!total || !duration) return 0
  let left = (Math.min(seconds, duration) / duration) * total
  for (let index = 0; index < sizes.length; index += 1) {
    if (left < sizes[index]) return index
    left -= sizes[index]
  }
  return sizes.length - 1
}

/* The playback second where `paragraph` starts in a track of `duration` seconds. */
export function timeAtParagraph(blocks, paragraph, duration) {
  const sizes = blockSizes(blocks)
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (!total || !duration) return 0
  const before = sizes.slice(0, paragraph).reduce((sum, size) => sum + size, 0)
  return (before / total) * duration
}
