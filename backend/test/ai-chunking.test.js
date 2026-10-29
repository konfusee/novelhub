import { describe, expect, it } from 'vitest'
import {
  chunkParagraphs,
  embeddingRequestBatches,
  revisionPassages,
} from '../src/modules/ai/chunking.js'

// Exactly `length` characters of words, with no leading or trailing space.
const words = length => 'abcd '.repeat(Math.ceil(length / 5)).slice(0, length - 1) + 'e'
const chapter = paragraphs => ({
  contentType: 'chapter',
  formatVersion: 'blocks-v1',
  content: { title: 'Chương', blocks: paragraphs.map(text => ({ type: 'paragraph', text })) },
})

describe('chunking v1', () => {
  it('packs short paragraphs into passages of at most 2000 characters without overlap', () => {
    const paragraphs = Array.from({ length: 30 }, (_, i) =>
      (String(i).padStart(2, '0') + 'x'.repeat(148)).slice(0, 150),
    )
    const fullText = paragraphs.join('\n')
    const passages = chunkParagraphs(paragraphs)
    expect(passages.length).toBeGreaterThan(1)
    let previousEnd = 0
    passages.forEach((passage, index) => {
      expect(passage.text.length).toBeLessThanOrEqual(2000)
      expect(passage.text).toBe(fullText.slice(passage.start, passage.end))
      expect(passage.start).toBeGreaterThanOrEqual(previousEnd)
      expect(passage.passageId).toBe('p' + String(index).padStart(4, '0'))
      expect(passage.order).toBe(index)
      previousEnd = passage.end
    })
  })

  it('splits a paragraph longer than the limit at a word boundary', () => {
    const passages = chunkParagraphs([words(5000)])
    expect(passages.length).toBeGreaterThanOrEqual(3)
    for (const passage of passages) {
      expect(passage.text.length).toBeLessThanOrEqual(2000)
      expect(passage.text.startsWith(' ')).toBe(false)
      expect(passage.text.endsWith(' ')).toBe(false)
    }
  })

  it('is deterministic for the same revision', () => {
    const revision = chapter([words(3000), 'Đoạn ngắn.', words(1500)])
    expect(revisionPassages(revision)).toEqual(revisionPassages(revision))
  })

  it('builds story-metadata passages from title and synopsis', () => {
    const passages = revisionPassages({
      contentType: 'story',
      content: { title: 'Tên', description: 'Dòng 1\nDòng 2' },
    })
    expect(passages).toHaveLength(1)
    expect(passages[0].text).toBe('Tên\nDòng 1\nDòng 2')
  })

  it('returns no passages for blank text', () => {
    expect(revisionPassages(chapter(['', '   ', '\n\t']))).toEqual([])
  })

  it('splits embedding requests by input count and estimated tokens in order', () => {
    const short = Array.from({ length: 5000 }, (_, i) => String(i).padEnd(100, 'a'))
    const byCount = embeddingRequestBatches(short)
    expect(byCount.map(group => group.texts.length)).toEqual([2048, 2048, 904])
    expect(byCount.map(group => group.start)).toEqual([0, 2048, 4096])
    expect(byCount.flatMap(group => group.texts)).toEqual(short)
    const long = Array.from({ length: 300 }, (_, i) => String(i).padEnd(2000, 'b'))
    const byTokens = embeddingRequestBatches(long)
    expect(byTokens.map(group => group.texts.length)).toEqual([200, 100])
    expect(byTokens.flatMap(group => group.texts)).toEqual(long)
  })
})
