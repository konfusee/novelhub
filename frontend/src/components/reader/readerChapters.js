import { chapterPreview, fullChapter } from '../../data/mock/reader'

/*
 * Chapter source for the full reader. The mock ships one chapter of prose (`fullChapter`), so every
 * chapter reuses it with the paragraphs rotated, which keeps adjacent chapters visually distinct
 * in continuous scroll. Titles come from the story's chapter list when it has one. Objects are
 * cached so `useMockResource` receives a stable value. Replace with the chapter API later.
 */
export const READER_CHAPTER_TOTAL = fullChapter.total

const cache = new Map()

export function readerChapterTitle(number) {
  if (number === fullChapter.number) return fullChapter.title
  return chapterPreview.find(item => item.number === number)?.title ?? fullChapter.title
}

export function readerChapter(number) {
  if (!cache.has(number)) {
    const source = fullChapter.paragraphs
    const shift = (((number - fullChapter.number) % source.length) + source.length) % source.length
    cache.set(number, {
      number,
      title: readerChapterTitle(number),
      readTime: fullChapter.readTime,
      paragraphs: [...source.slice(shift), ...source.slice(0, shift)],
    })
  }
  return cache.get(number)
}

export const readerChapterNumberFrom = chapterId => {
  const parsed = Number(chapterId?.match(/\d+/)?.[0])
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= READER_CHAPTER_TOTAL
    ? parsed
    : fullChapter.number
}
